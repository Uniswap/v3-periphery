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
}
