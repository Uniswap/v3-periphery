// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/// @title Weighted Oracle library
/// @notice Provides functions to integrate with different tier oracles of the same V3 pair
library WeightedOracleLibrary {

    struct TimeWeightedObservation {
        int24 timeWeightedAverageTick;
        uint128 timeWeightedHarmonicAverageLiquidity;
    }

    /// @notice Fetches time-weighted observations across different Uniswap V3 pools
    /// @param pools Addresses of different Uniswap V3 pools that we want to observe
    /// @param period Number of seconds in the past to start calculating the time-weighted observations
    /// @return observations An array of obervations that have been time-weighted from (block.timestamp - period) to block.timestamp
    function consult(address[] calldata pools, uint32 period) internal view returns (TimeWeightedObservation[] memory observations) {
        require(period != 0, 'BP');

        observations = new TimeWeightedObservation[](pools.length);
        uint192 periodX160 = uint192(period) * type(uint160).max;

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        for (uint256 i; i < pools.length; i++) {
            (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) = IUniswapV3Pool(pools[i]).observe(secondsAgos);
            int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
            uint160 secondsPerLiquidityCumulativesDelta = secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

            observations[i].timeWeightedAverageTick = int24(tickCumulativesDelta / period);
            // Always round to negative infinity
            if (tickCumulativesDelta < 0 && (tickCumulativesDelta % period != 0)) observations[i].timeWeightedAverageTick--;

            // We are shifting the liquidity delta to ensure that the result doesn't overflow uint128
            observations[i].timeWeightedHarmonicAverageLiquidity = uint128(periodX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
        }
    }

    /// @notice Given some time-weighted observations, calculates the arithmetic mean tick, weighted by liquidity
    /// @param observations A list of time-weighted observations
    /// @return arithmeticMeanWeightedTick The arithmetic mean tick, weighted by the observations' time-weighted harmonic average liquidity
    function getArithmeticMeanTickWeightedByLiquidity(TimeWeightedObservation[] memory observations) internal pure returns (int24 arithmeticMeanWeightedTick) {

        // Accumulates the sum of all observations' products between each their own average tick and harmonic average liquidity
        // Each product can be stored in a int160, so it would take approximatelly 2**96 observations to overflow this accumulator
        int256 weightedTicksAccumulator;

        // Accumulates the sum of the harmonic average liquidities from the given observations
        // Each average liquidity can be stored in a uint128, so it will take approximatelly 2**128 observations to overflow this accumulator
        uint256 liquidityWeightAccumulator;

        for (uint256 i; i < observations.length; i++) {
            weightedTicksAccumulator += int256(observations[i].timeWeightedHarmonicAverageLiquidity) * observations[i].timeWeightedAverageTick;
            liquidityWeightAccumulator += observations[i].timeWeightedHarmonicAverageLiquidity;
        }

        arithmeticMeanWeightedTick = int24(weightedTicksAccumulator / int256(liquidityWeightAccumulator));
    }
}
