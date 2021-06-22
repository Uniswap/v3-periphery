// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/// @title Weighted Oracle library
/// @notice Provides functions to integrate with different tier oracles of the same V3 pair
library WeightedOracleLibrary {

    struct TimeWeightedObservation {
        int24 timeWeightedAverageTick;
        uint256 timeWeightedHarmonicMeanLiquidity;
    }

    /// @notice Fetches time-weighted observations across different tiers of the same Uniswap V3 pair
    /// @param pools Addresses of different tiers of the same Uniswap V3 pair that we want to observe
    /// @param period Number of seconds in the past to start calculating the time-weighted observations
    /// @return observations An array of obervations that have been time-weighted from (block.timestamp - period) to block.timestamp
    function consult(address[] calldata pools, uint32 period) internal view returns (TimeWeightedObservation[] memory observations) {
        require(period != 0, 'BP');

        observations = new TimeWeightedObservation[](pools.length);
        uint256 periodX160 = uint256(period) * type(uint160).max;

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        for (uint256 i; i < pools.length; i++) {
          (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) = IUniswapV3Pool(pools[i]).observe(secondsAgos);
          int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
          uint160 secondsPerLiquidityCumulativesDelta = secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

          observations[i].timeWeightedAverageTick = int24(tickCumulativesDelta / period);
          if (tickCumulativesDelta < 0 && (tickCumulativesDelta % period != 0)) observations[i].timeWeightedAverageTick--;

          observations[i].timeWeightedHarmonicMeanLiquidity = periodX160 / (uint256(secondsPerLiquidityCumulativesDelta) << 32);
        }
    }

    /// @notice Given some time-weighted observations, calculates the arithmetic mean weighted tick average
    /// @param observations A list of time-weighted observations
    /// @return arithmeticMeanWeightedTick The arithmetic mean average tick, weighted by the observations' time-weighted harmonic mean liquidity
    function getArithmeticMeanWeightedTick(TimeWeightedObservation[] memory observations) internal pure returns (int24 arithmeticMeanWeightedTick) {

        int256 weightedTicksAccumulator;
        uint256 liquidityWeightAccumulator;

        for (uint256 i; i < observations.length; i++) {
            weightedTicksAccumulator += int256(observations[i].timeWeightedHarmonicMeanLiquidity) * observations[i].timeWeightedAverageTick;
            liquidityWeightAccumulator += observations[i].timeWeightedHarmonicMeanLiquidity;
        }

        arithmeticMeanWeightedTick = int24(weightedTicksAccumulator / int256(liquidityWeightAccumulator));
    }
}
