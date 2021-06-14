// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/// @title Weighted Oracle library
/// @notice Provides functions to integrate with different tier oracles of the same V3 pair
library WeightedOracleLibrary {

    /// @notice Fetches liquidity-time-weighted average tick across different tiers of the same Uniswap V3 pair
    /// @param pools Addresses of different tiers of the same Uniswap V3 pair that we want to observe
    /// @param period Number of seconds in the past to start calculating liquidity-time-weighted average
    /// @return liquidityTimeWeightedAverageTick The liquidity-time-weighted average tick from (block.timestamp - period) to block.timestamp
    function consult(address[] calldata pools, uint32 period) internal view returns (int24 liquidityTimeWeightedAverageTick) {
        require(period != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;
        uint160 periodX128 = uint160(period) << 128;

        uint136 liquidityWeightAccumulator;
        uint152 liquidityWeightedTickAccumulator;

        for (uint8 i = 0; i < pools.length; i++) {
            (int24 timeWeightedAverageTick, uint128 liquidityWeight) = consultPool(pools[i], period, secondsAgos, periodX128);

            liquidityWeightedTickAccumulator += uint152(timeWeightedAverageTick) * liquidityWeight;
            liquidityWeightAccumulator += liquidityWeight;
        }

        liquidityTimeWeightedAverageTick = int24(liquidityWeightedTickAccumulator / liquidityWeightAccumulator);
    }

    /// @notice Fetches time-weighted average tick and the liquidity weight for a Uniswap V3 pool
    /// @param pool Address of Uniswap V3 pool that we want to observe
    /// @param period Number of seconds in the past to start calculating time-weighted average and liquidity weight
    /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return an observation. Passed as parameter to avoid re-calculating it
    /// @param periodX128 Period << 128. Passed as parameter to avoid re-calculating it
    /// @return timeWeightedAverageTick The time-weighted average tick from (block.timestamp - period) to block.timestamp
    /// @return liquidityWeight A weight value based on the pool's liquidity from (block.timestamp - period) to block.timestamp
    function consultPool(address pool, uint32 period, uint32[] memory secondsAgos, uint160 periodX128) internal view returns (int24 timeWeightedAverageTick, uint128 liquidityWeight) {
        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) = IUniswapV3Pool(pool).observe(secondsAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        uint160 secondsPerLiquidityCumulativesDelta = secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

        timeWeightedAverageTick = int24(tickCumulativesDelta / period);
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % period != 0)) timeWeightedAverageTick--;

        // This value isn't the time-weighted liquidity, but it can still helps us weight the tick based on tier liquidity
        liquidityWeight = uint128(periodX128 / secondsPerLiquidityCumulativesDelta);
    }
}
