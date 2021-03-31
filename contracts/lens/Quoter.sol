// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

import '../interfaces/IQuoter.sol';
import '../base/PeripheryImmutableState.sol';
import '../base/PeripheryValidation.sol';
import '../libraries/Path.sol';
import '../libraries/PoolAddress.sol';
import '../libraries/CallbackValidation.sol';

/// @title Uniswap V3 Swap Router
/// @notice Router for stateless execution of swaps against Uniswap V3
contract Quoter is IQuoter, IUniswapV3SwapCallback, PeripheryImmutableState, PeripheryValidation {
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick, plus 1
    uint160 private constant MIN_SQRT_RATIO = 4295128739 + 1;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick, minus 1
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;

    constructor(address _factory, address _WETH9) PeripheryImmutableState(_factory, _WETH9) {}

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes memory path
    ) external view override {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();
        CallbackValidation.verifyCallback(factory, tokenIn, tokenOut, fee);

        (bool isExactInput, uint256 amountToPay, uint256 amountReceived) =
            amount0Delta > 0
                ? (tokenIn < tokenOut, uint256(amount0Delta), uint256(-amount1Delta))
                : (tokenOut < tokenIn, uint256(amount1Delta), uint256(-amount0Delta));
        if (isExactInput) {
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountReceived)
                revert(ptr, 32)
            }
        } else {
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountToPay)
                revert(ptr, 32)
            }
        }
    }

    /// @dev Performs a single exact input swap
    function exactInputSingle(uint256 amountIn, bytes memory path) private returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        try
            getPool(tokenIn, tokenOut, fee).swap(
                address(this), // address(0) might cause issues with some tokens
                zeroForOne,
                amountIn.toInt256(),
                zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
                path
            )
        {} catch (bytes memory reason) {
            if (reason.length != 32) {
                revert('Unexpected error');
            }
            return abi.decode(reason, (uint256));
        }
    }

    /// @inheritdoc IQuoter
    function quoteExactInput(bytes memory path, uint256 amountIn) external override returns (uint256 amountOut) {
        while (true) {
            bool hasPools = path.hasPools();

            // the outputs of prior swaps become the inputs to subsequent ones
            amountIn = exactInputSingle(
                amountIn,
                path.getFirstPool() // only the first pool in the path is necessary
            );

            // decide whether to continue or terminate
            if (hasPools) {
                path = path.skipToken();
            } else {
                return amountIn;
            }
        }
    }

    /// @dev Performs a single exact output swap
    function exactOutputSingle(uint256 amountOut, bytes memory path) private returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        try
            getPool(tokenIn, tokenOut, fee).swap(
                address(this), // address(0) might cause issues with some tokens
                zeroForOne,
                -amountOut.toInt256(),
                zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
                path
            )
        {} catch (bytes memory reason) {
            if (reason.length != 32) {
                revert('Unexpected error');
            }
            return abi.decode(reason, (uint256));
        }
    }

    /// @inheritdoc IQuoter
    function quoteExactOutput(bytes memory path, uint256 amountOut) external override returns (uint256 amountIn) {
        while (true) {
            bool hasPools = path.hasPools();

            // the inputs of prior swaps become the outputs of subsequent ones
            amountOut = exactOutputSingle(
                amountOut,
                path.getFirstPool() // only the first pool in the path is necessary
            );

            // decide whether to continue or terminate
            if (hasPools) {
                path = path.skipToken();
            } else {
                return amountOut;
            }
        }
    }
}
