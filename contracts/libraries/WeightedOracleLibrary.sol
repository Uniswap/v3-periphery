// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/// @title Weighted Oracle library
/// @notice Provides functions to integrate with different tier oracles of the same V3 pair
library WeightedOracleLibrary {

    struct TimeWeightedObservation {
        int24 arithmeticMeanTick;
        uint128 harmonicMeanLiquidity;
    }

    /// @notice Fetches time-weighted observations across different Uniswap V3 pools. These pools should almost certainly be for the same underlying assets, and differ only in fee tier
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

            observations[i].arithmeticMeanTick = int24(tickCumulativesDelta / period);
            // Always round to negative infinity
            if (tickCumulativesDelta < 0 && (tickCumulativesDelta % period != 0)) observations[i].arithmeticMeanTick--;

            // We are shifting the liquidity delta to ensure that the result doesn't overflow uint128
            observations[i].harmonicMeanLiquidity = uint128(periodX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
        }
    }

    /// @notice Given some time-weighted observations, calculates the arithmetic mean tick, weighted by liquidity
    /// @param observations A list of time-weighted observations
    /// @return arithmeticMeanWeightedTick The arithmetic mean tick, weighted by the observations' time-weighted harmonic average liquidity
    function getArithmeticMeanTickWeightedByLiquidity(TimeWeightedObservation[] memory observations) internal pure returns (int24 arithmeticMeanWeightedTick) {

        // Accumulates the sum of all observations' products between each their own average tick and harmonic average liquidity
        // Each product can be stored in a int160, so it would take approximatelly 2**96 observations to overflow this accumulator
        int256 numerator;

        // Accumulates the sum of the harmonic average liquidities from the given observations
        // Each average liquidity can be stored in a uint128, so it will take approximatelly 2**128 observations to overflow this accumulator
        uint256 denominator;

        for (uint256 i; i < observations.length; i++) {
            numerator += int256(observations[i].harmonicMeanLiquidity) * observations[i].arithmeticMeanTick;
            denominator += observations[i].harmonicMeanLiquidity;
        }

        arithmeticMeanWeightedTick = int24(numerator / int256(denominator));

        // Always round to negative infinity
        if (numerator < 0 && (numerator % int256(denominator) != 0)) arithmeticMeanWeightedTick--;
    }

    /// @notice Given a Uniswap V3 pool, returns the timestamp of the oldest observation available
    /// @param pool Address of Uniswap V3 pool that we want to analyze
    /// @return oldestBlockTimestamp The timestamp of the oldest observation available on the pool
    function getOldestObservationTimestampForPool(address pool) internal view returns (uint32 oldestBlockTimestamp) {
        IUniswapV3Pool uniswapV3Pool = IUniswapV3Pool(pool);
        (, , uint16 observationIndex, uint16 observationCardinality, , ,) = uniswapV3Pool.slot0();
        (uint32 blockTimestampNext, , , bool initialized) = uniswapV3Pool.observations(observationIndex + 1 % observationCardinality);
        if (initialized) {
            oldestBlockTimestamp = blockTimestampNext;
        } else {
            (uint32 blockTimestampZero, , ,) = uniswapV3Pool.observations(0);
            oldestBlockTimestamp = blockTimestampZero;
        }
    }
}
