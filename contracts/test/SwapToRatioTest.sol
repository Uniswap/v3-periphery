// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/SwapToRatio.sol';

contract SwapToRatioTest {
    function getPostSwapPrice(IUniswapV3Pool pool, SwapToRatio.PositionParams memory positionParams)
        internal
        view
        returns (uint160)
    {
        return SwapToRatio.getPostSwapPrice(pool, positionParams);
    }
}
