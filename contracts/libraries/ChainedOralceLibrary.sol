// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './PoolAddress.sol';
import '../interfaces/IPeripheryImmutableState.sol';

/// @title ChainedOracleLibrary
/// @notice Returns a time weighted average tick of two tokens which do
/// not share a common pool by chaining the price through an intermediary token.
/// @dev As tokens may have different decimal expressions, weighing twaps by liquidity is insecure unless
/// the decimal expression of each token is included in the calculation. Because of this, this library excludes
/// liquidity weighing.
library ChainedOracleLibrary {
    // struct consultChainedParams {
    //     uint32 period;
    //     address tokenA;
    //     uint24 fee1;
    //     address tokenB;
    //     uint24 fee2;
    //     address tokenC;
    // }

    // hardcode factory for testing
    address constant factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

    function consultChained(
        uint32 period,
        address tokenA,
        uint24 fee1,
        address tokenB,
        uint24 fee2,
        address tokenC
    ) internal view returns (int24 timeWeightedAverageTick) {
        require(period != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        // derive poolA arithmetic mean tick
        (int56[] memory poolATickCumulatives, uint160[] memory poolASecondsPerLiquidityCumulativeX128s) =
            IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee1))).observe(
                secondsAgos
            );

        int56 poolATickCumulativesDelta = poolATickCumulatives[1] - poolATickCumulatives[0];

        int24 poolAArithmeticMeanTick = int24(poolATickCumulativesDelta / period);

        // derive poolB arithmetic mean tick
        (int56[] memory poolBTickCumulatives, uint160[] memory poolBSecondsPerLiquidityCumulativeX128s) =
            IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenB, tokenC, fee2))).observe(
                secondsAgos
            );

        int56 poolBTickCumulativesDelta = poolBTickCumulatives[1] - poolBTickCumulatives[0];

        int24 poolBArithmeticMeanTick = int24(poolBTickCumulativesDelta / period);

        // figure out how to chain the tick reading to get token A in terms of token C
    }
}
