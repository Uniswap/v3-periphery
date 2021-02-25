// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterSwaps.sol';
import './libraries/PoolAddress.sol';
import './libraries/Path.sol';
import './libraries/SafeCast.sol';
import './libraries/TransferHelper.sol';
import './RouterValidation.sol';

/// @title Logic for trading
abstract contract RouterSwaps is IRouterImmutableState, IRouterSwaps, RouterValidation {
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        bytes memory path,
        address recipient,
        uint256 deadline
    ) external override {
        revert('unimplemented');
    }

    /// @notice Swaps a maximum amount of one token for an exact amount another
    /// @dev zeroForOne The direction of the swap: 0 for 1
    function swapTokensForExactTokens(SwapExactOutParams calldata params) external override {
        (IUniswapV3Pool pool, bytes memory rest) = poolFromPath(params.path, false);
        uint160 limit = params.zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

        SwapCallbackData memory callbackData =
            SwapCallbackData({
                payer: msg.sender,
                buffer: rest,
                zeroForOne: params.zeroForOne,
                maxAmountIn: params.maxAmountIn
            });
        pool.swap(
            params.recipient,
            params.zeroForOne,
            // positive number = exact in
            -params.amountOut.toInt256(),
            limit,
            abi.encode(callbackData)
        );
    }

    struct SwapCallbackData {
        address payer;
        bytes buffer;
        bool zeroForOne;
        uint256 maxAmountIn;
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        // decode the callback data
        SwapCallbackData memory decoded = abi.decode(data, (SwapCallbackData));

        // decide if we need to forward it to the next pair or pay up
        if (decoded.buffer.len() > 1) {
            forward(amount0Delta, amount1Delta, decoded);
        } else {
            pay(decoded.payer, decoded.zeroForOne, amount0Delta, amount1Delta, decoded.maxAmountIn);
        }
    }

    function forward(
        int256 amount0Delta,
        int256 amount1Delta,
        SwapCallbackData memory callbackData
    ) private {
        // get the next pool address
        (IUniswapV3Pool nextPool, bytes memory rest) = poolFromPath(callbackData.buffer, true);

        // figure out if we should send token0 or token1
        address tokenToBePaid =
            amount0Delta > 0 ? IUniswapV3Pool(msg.sender).token0() : IUniswapV3Pool(msg.sender).token1();

        // we send the amount that corresponds to the positive value
        int256 amountToBePaid = amount0Delta > 0 ? amount0Delta : amount1Delta;

        bool zeroForOne = tokenToBePaid == nextPool.token1();
        uint160 limit = zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

        callbackData.buffer = rest;
        nextPool.swap(
            msg.sender,
            zeroForOne,
            -amountToBePaid,
            limit,
            abi.encode(callbackData) // TODO: can we avoid
        );
    }

    function pay(
        address payer,
        bool originZeroForOne,
        int256 amount0Delta,
        int256 amount1Delta,
        uint256 maxAmountIn
    ) private {
        (address token, uint256 amount) =
            originZeroForOne
                ? (IUniswapV3Pool(msg.sender).token0(), uint256(amount0Delta))
                : (IUniswapV3Pool(msg.sender).token1(), uint256(amount1Delta));
        require(maxAmountIn >= amount, 'too much requested');
        TransferHelper.safeTransferFrom(token, payer, msg.sender, amount);
    }

    /// gets a pool from the path and also optionally verifies that the msg.sender for the call
    function poolFromPath(bytes memory path, bool verify) private view returns (IUniswapV3Pool, bytes memory) {
        // get the first element
        (bytes memory poolBytes, bytes memory rest) = path.pop();
        // decode it
        (address token0, address token1, uint24 fee) = poolBytes.decode();
        // get the pool address from it
        PoolAddress.PoolKey memory key = PoolAddress.PoolKey({tokenA: token0, tokenB: token1, fee: fee});
        if (verify) verifyCallback(key);

        address poolAddress = PoolAddress.computeAddress(this.factory(), key);

        return (IUniswapV3Pool(poolAddress), rest);
    }
}
