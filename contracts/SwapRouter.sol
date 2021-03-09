// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/ISwapRouter.sol';
import './base/PeripheryImmutableState.sol';
import './base/PeripheryValidation.sol';
import './base/PeripheryPayments.sol';
import './base/Multicall.sol';
import './base/SelfPermit.sol';
import './libraries/Path.sol';
import './libraries/PoolAddress.sol';
import './libraries/CallbackValidation.sol';
import './interfaces/external/IWETH9.sol';
import './interfaces/external/IWETH10.sol';

/// @title Uniswap V3 Swap Router
/// @notice Router for stateless execution of swaps against Uniswap V3
contract SwapRouter is
    ISwapRouter,
    PeripheryImmutableState,
    PeripheryValidation,
    PeripheryPayments,
    Multicall,
    SelfPermit
{
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick, plus 1
    uint160 private constant MIN_SQRT_RATIO = 4295128739 + 1;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick, minus 1
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;

    uint256 private amountInCached; // used for exact output swaps

    constructor(
        address _factory,
        address _WETH9,
        address _WETH10
    ) PeripheryImmutableState(_factory, _WETH9, _WETH10) {}

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    struct SwapData {
        bytes path;
        address payer;
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external override {
        SwapData memory data = abi.decode(_data, (SwapData));
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();
        CallbackValidation.verifyCallback(this.factory(), tokenIn, tokenOut, fee);

        (bool isExactInput, uint256 amountToPay) =
            amount0Delta > 0
                ? (tokenIn < tokenOut, uint256(amount0Delta))
                : (tokenOut < tokenIn, uint256(amount1Delta));
        if (isExactInput) {
            // exact input
            pay(tokenIn, data.payer, msg.sender, amountToPay);
        } else {
            // exact output
            (tokenIn, tokenOut) = (tokenOut, tokenIn);

            // either initiate the next swap or pay
            // TODO the WETH stuff might have to happen here
            if (data.path.hasPools()) {
                data.path = data.path.skipToken();
                exactOutputSingle(amountToPay, msg.sender, data);
            } else {
                amountInCached = amountToPay;
                pay(tokenIn, data.payer, msg.sender, amountToPay);
            }
        }
    }

    /// @dev Performs a single exact input swap
    function exactInputSingle(
        uint256 amountIn,
        address recipient,
        SwapData memory data
    ) private returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) =
            getPool(tokenIn, tokenOut, fee).swap(
                recipient,
                zeroForOne,
                amountIn.toInt256(),
                zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
                abi.encode(data)
            );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    /// @inheritdoc ISwapRouter
    function exactInput(
        SwapParams memory params,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external payable override checkDeadline(params.deadline) returns (uint256 amountOut) {
        while (true) {
            bool hasPools = params.path.hasPools();

            // the outputs of prior swaps become the inputs to subsequent ones
            amountIn = exactInputSingle(
                amountIn,
                hasPools ? address(this) : params.recipient, // for intermediate swaps, this contract custodies
                SwapData({
                    path: params.path.getFirstPool(), // only the first pair in the path is necessary
                    payer: params.hasPaid ? address(this) : msg.sender // lying just costs the caller gas
                })
            );

            // decide whether to continue or terminate
            if (hasPools) {
                params.path = params.path.skipToken();
                params.hasPaid = true;
            } else {
                amountOut = amountIn;
                require(amountOut >= amountOutMinimum, 'Too little received');
                return amountOut;
            }
        }
    }

    /// @dev Performs a single exact output swap
    function exactOutputSingle(
        uint256 amountOut,
        address recipient,
        SwapData memory data
    ) private {
        (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        getPool(tokenIn, tokenOut, fee).swap(
            recipient,
            zeroForOne,
            -amountOut.toInt256(),
            zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
            abi.encode(data)
        );
    }

    /// @inheritdoc ISwapRouter
    function exactOutput(
        SwapParams calldata params,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external payable override checkDeadline(params.deadline) returns (uint256 amountIn) {
        exactOutputSingle(
            amountOut,
            params.recipient,
            SwapData({
                path: params.path,
                payer: params.hasPaid ? address(this) : msg.sender // lying just costs gas
            })
        );

        amountIn = amountInCached;
        delete amountInCached;

        require(amountIn <= amountInMaximum, 'Too much requested');
    }
}
