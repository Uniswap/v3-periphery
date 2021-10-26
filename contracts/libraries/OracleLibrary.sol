// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '../libraries/PoolAddress.sol';
import 'hardhat/console.sol';

/// @title Oracle library
/// @notice Provides functions to integrate with V3 pool oracle
library OracleLibrary {
    /// @notice The result of calculating time-weighted means of liquidity and tick for a Uniswap V3 pool
    struct TimeWeightedPoolData {
        int24 arithmeticMeanTick;
        uint128 harmonicMeanLiquidity;
    }

    /// @notice Calculates time-weighted means of liquidity and tick for a given Uniswap V3 pool
    /// @param pool Address of the pool that we want to observe
    /// @param secondsAgo Number of seconds in the past calculate the time-weighted means from
    /// @return timeWeightedPoolData The mean liquidity and tick, time-weighted from (block.timestamp - secondsAgo) to block.timestamp
    function consult(address pool, uint32 secondsAgo)
        internal
        view
        returns (TimeWeightedPoolData memory timeWeightedPoolData)
    {
        require(secondsAgo != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
            IUniswapV3Pool(pool).observe(secondsAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        uint160 secondsPerLiquidityCumulativesDelta =
            secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

        timeWeightedPoolData.arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgo);
        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0))
            timeWeightedPoolData.arithmeticMeanTick--;

        uint192 secondsAgoX160 = uint192(secondsAgo) * type(uint160).max;

        // We are shifting the liquidity delta to ensure that the result doesn't overflow uint128
        timeWeightedPoolData.harmonicMeanLiquidity = uint128(
            secondsAgoX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32)
        );
    }

    /// @notice Given a tick and a token amount, calculates the amount of token received in exchange
    /// @param tick Tick value used to calculate the quote
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }

    /// @notice Given a pool, it returns the number of seconds ago of the oldest stored observation
    /// @param pool Address of Uniswap V3 pool that we want to observe
    /// @return The number of seconds ago of the oldest observation stored for the pool
    function getOldestObservationSecondsAgo(address pool) internal view returns (uint32) {
        (, , uint16 observationIndex, uint16 observationCardinality, , , ) = IUniswapV3Pool(pool).slot0();
        require(observationCardinality > 0, 'NI');

        (uint32 observationTimestamp, , , bool initialized) =
            IUniswapV3Pool(pool).observations((observationIndex + 1) % observationCardinality);

        // The next index might not be initialized if the cardinality is in the process of increasing
        // In this case the oldest observation is always in index 0
        if (!initialized) {
            (observationTimestamp, , , ) = IUniswapV3Pool(pool).observations(0);
        }

        return uint32(block.timestamp) - observationTimestamp;
    }

    /// @notice Given a pool, it returns the tick value as of the start of the current block
    /// @param pool Address of Uniswap V3 pool
    /// @return The tick that the pool was in at the start of the current block
    function getBlockStartingTick(address pool) internal view returns (int24) {
        (, int24 tick, uint16 observationIndex, uint16 observationCardinality, , , ) = IUniswapV3Pool(pool).slot0();

        // 2 observations are needed to reliably calculate the block starting tick
        require(observationCardinality > 1, 'NEO');

        // If the latest observation occurred in the past, then no tick-changing trades have happened in this block
        // therefore the tick in `slot0` is the same as at the beginning of the current block.
        // We don't need to check if this observation is initialized - it is guaranteed to be.
        (uint32 observationTimestamp, int56 tickCumulative, , ) = IUniswapV3Pool(pool).observations(observationIndex);
        if (observationTimestamp != uint32(block.timestamp)) {
            return tick;
        }

        uint256 prevIndex = (uint256(observationIndex) + observationCardinality - 1) % observationCardinality;
        (uint32 prevObservationTimestamp, int56 prevTickCumulative, , bool prevInitialized) =
            IUniswapV3Pool(pool).observations(prevIndex);

        require(prevInitialized, 'ONI');

        return int24((tickCumulative - prevTickCumulative) / (observationTimestamp - prevObservationTimestamp));
    }

    /// @notice Given some time-weighted means of liquidity and tick, calculates the arithmetic mean tick, weighted by liquidity
    /// @param timeWeightedPoolDatas A list of time-weighted means
    /// @return arithmeticMeanWeightedTick The arithmetic mean tick, weighted by the pools' time-weighted harmonic mean liquidity
    /// @dev In most scenarios, each entry of `timeWeightedPoolDatas` should share the same `secondsAgo` and underlying `pool` tokens.
    /// If `secondsAgo` differs across TimeWeightedPoolDatas, the result becomes difficult to interpret and is likely biased/manipulable.
    /// If the underlying `pool` tokens differ across TimeWeightedPoolDatas, extreme care must be taken to ensure that both prices and liquidity values are comparable.
    /// Even if prices are commensurate (e.g. two different USD-stable assets against ETH), liquidity values may not be, as decimals can differ between tokens.
    function getArithmeticMeanTickWeightedByLiquidity(TimeWeightedPoolData[] memory timeWeightedPoolDatas)
        internal
        view
        returns (int24 arithmeticMeanWeightedTick)
    {
        // Accumulates the sum of products between each mean tick and harmonic mean liquidity
        // Each product can be stored in a int160, so it would take an array of length approximately 2**96 to overflow this accumulator
        int256 numerator;

        // Accumulates the sum of the harmonic mean liquidities
        // Each mean liquidity can be stored in a uint128, so it would take an array of length approximately 2**128 to overflow this accumulator
        uint256 denominator;

        for (uint256 i; i < timeWeightedPoolDatas.length; i++) {
            numerator +=
                int256(timeWeightedPoolDatas[i].harmonicMeanLiquidity) *
                timeWeightedPoolDatas[i].arithmeticMeanTick;
            denominator += timeWeightedPoolDatas[i].harmonicMeanLiquidity;
        }

        arithmeticMeanWeightedTick = int24(numerator / int256(denominator));

        // Always round to negative infinity
        if (numerator < 0 && (numerator % int256(denominator) != 0)) arithmeticMeanWeightedTick--;
    }

    function getChainedPrice(address[] memory tokens, int24[] memory arithmeticMeanWeightedTicks)
        internal
        view
        returns (int24 syntheticTick)
    {
        require(tokens.length - 1 == arithmeticMeanWeightedTicks.length, 'UEL');
        //require(tokens.length > 2, 'TFT');

        address[2][] memory sortedPairs = new address[2][](2);

        syntheticTick = arithmeticMeanWeightedTicks[0];

        for (uint256 i = 2; i < tokens.length; i++) {
            (sortedPairs[0][0], sortedPairs[0][1]) = tokens[i - 2] < tokens[i - 1]
                ? (tokens[i - 2], tokens[i - 1])
                : (tokens[i - 1], tokens[i - 2]);

            (sortedPairs[1][0], sortedPairs[1][1]) = tokens[i - 1] < tokens[i]
                ? (tokens[i - 1], tokens[i])
                : (tokens[i], tokens[i - 1]);

            sortedPairs[i - 2][1] == sortedPairs[i - 1][0] // Add to synthetic tick
                ? // 1.0001**(Tick_a + Tick_b) = Price_a * Price_b
                syntheticTick = syntheticTick + arithmeticMeanWeightedTicks[i - 1] // invert price by subtracting from synthetic tick // 1.0001**(Tick_a - Tick_b) = Price_a / Price_b
                : syntheticTick = syntheticTick - arithmeticMeanWeightedTicks[i - 1];
        }
    }
}
