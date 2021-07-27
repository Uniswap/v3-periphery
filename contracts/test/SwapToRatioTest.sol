// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/SwapToRatio.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';

contract SwapToRatioTest {
    function getPostSwapPrice(IUniswapV3Pool pool, SwapToRatio.PositionParams memory positionParams)
        external
        view
        returns (uint160)
    {
        return SwapToRatio.getPostSwapPrice(pool, positionParams);
    }

    function swapToNextInitializedTick(
        SwapToRatio.PoolParams memory poolParams,
        SwapToRatio.PositionParams memory positionParams,
        uint160 sqrtRatioX96Target,
        bool zeroForOne
    )
        external
        view
        returns (
            bool,
            uint256,
            uint256
        )
    {
        return SwapToRatio.swapToNextInitializedTick(poolParams, positionParams, sqrtRatioX96Target, zeroForOne);
    }

    function calculateConstantLiquidityPostSwapSqrtPrice(
        uint160 sqrtRatioX96,
        uint128 liquidity,
        uint24 fee,
        uint160 sqrtRatioX96Lower,
        uint160 sqrtRatioX96Upper,
        uint256 amount0Initial,
        uint256 amount1Initial
    ) external view returns (uint160) {
        return
            SwapToRatio.calculateConstantLiquidityPostSwapSqrtPrice(
                sqrtRatioX96,
                liquidity,
                fee,
                sqrtRatioX96Lower,
                sqrtRatioX96Upper,
                amount0Initial,
                amount1Initial
            );
    }

    function tickToSqrtRatioX96(int24 tick) external pure returns (uint160) {
        return TickMath.getSqrtRatioAtTick(tick);
    }

    function getAmount0Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256 amount1) {
        return SqrtPriceMath.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp);
    }

    function getAmount1Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256 amount1) {
        return SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp);
    }
}
