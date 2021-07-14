// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/SwapToRatio.sol';

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
}
