// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';

import '../interfaces/IRouterSwaps.sol';
import '../interfaces/IPeripheryImmutableState.sol';
import '../interfaces/external/IWETH9.sol';
import '../interfaces/external/IWETH10.sol';
import '../libraries/Path.sol';
import '../libraries/PoolAddress.sol';
import '../libraries/CallbackValidation.sol';
import './PeripheryValidation.sol';
import './RouterPayments.sol';
import './ETHConnector.sol';

/// @title Logic for trading
abstract contract RouterSwaps is
    IRouterSwaps,
    IPeripheryImmutableState,
    PeripheryValidation,
    RouterPayments,
    ETHConnector
{
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick, plus 1
    uint160 private constant MIN_SQRT_RATIO = 4295128739 + 1;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick, minus 1
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;

    struct SwapData {
        bytes path;
        address payer;
        bytes exactOutputData; // optional abi-encoded ExactOutputData
    }

    struct ExactOutputData {
        uint256 amountInMaximum;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), PoolAddress.getPoolKey(tokenA, tokenB, fee)));
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

        uint256 amountToPay = uint256(amount0Delta > 0 ? amount0Delta : amount1Delta);
        if (data.exactOutputData.length == 0) {
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
                uint256 amountInMaximum = abi.decode(data.exactOutputData, (ExactOutputData)).amountInMaximum;
                require(amountToPay <= amountInMaximum, 'Too much requested');
                pay(tokenIn, data.payer, msg.sender, amountToPay);
            }
        }
    }

    /// @dev Performs a single exact input swap. Overloaded to support WETH9<>WETH10 conversion.
    /// @param amountIn The amount to be swapped
    /// @param recipient The recipient of the swap
    function exactInputSingle(
        uint256 amountIn,
        address recipient,
        SwapData memory data
    ) private returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        if (tokenIn == this.WETH9() && tokenOut == this.WETH10()) {
            pay(this.WETH9(), data.payer, address(this), amountIn);
            convertWETH9ToWETH10(amountIn, recipient);
            return amountIn;
        } else if (tokenIn == this.WETH10() && tokenOut == this.WETH9()) {
            pay(this.WETH10(), data.payer, address(this), amountIn);
            convertWETH10ToWETH9(amountIn, recipient);
            return amountIn;
        }

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
                    payer: params.hasPaid ? address(this) : msg.sender, // lying just costs the caller gas
                    exactOutputData: new bytes(0)
                })
            );

            if (!hasPools) break; // terminate if this was the last pair

            params.path = params.path.skipToken();
            params.hasPaid = true;
        }

        amountOut = amountIn;
        require(amountOut >= amountOutMinimum, 'Too little received');
    }

    /// @dev Performs a single exact output swap. Overloaded to support WETH9<>WETH10 conversion.
    /// @param amountOut The amount to be swapped
    /// @param recipient The recipient of the swap
    function exactOutputSingle(
        uint256 amountOut,
        address recipient,
        SwapData memory data
    ) private {
        (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        getPool(tokenOut, tokenIn, fee).swap(
            recipient,
            zeroForOne,
            -amountOut.toInt256(),
            zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
            abi.encode(data)
        );
    }

    /// @inheritdoc IRouterSwaps
    function exactOutput(
        SwapParams calldata params,
        uint256 amountOut,
        uint256 amountInMaximum
    ) external payable override checkDeadline(params.deadline) {
        exactOutputSingle(
            amountOut,
            params.recipient,
            SwapData({
                path: params.path,
                payer: params.hasPaid ? address(this) : msg.sender, // lying just costs gas
                exactOutputData: abi.encode(ExactOutputData({amountInMaximum: amountInMaximum}))
            })
        );
    }
}
