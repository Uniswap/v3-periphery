pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '../libraries/WeightedOracleLibrary.sol';
import '../libraries/OracleLibrary.sol';
import '../libraries/PoolAddress.sol';

contract OpinionatedOracle {
    address internal immutable factory;

    enum ManipulationResistance {
        Dangerous, // Spot price from beginning of the block
        Weak, // 1 minute
        Medium, // 30 minutes
        Strong // 1 day
    }

    uint32[4] quotePeriods = [0, 60 seconds, 30 minutes, 1 days];

    /// @param _factory Address of the UniswapV3 Factory used to look up token pools
    constructor(address _factory) {
        factory = _factory;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (address) {
        return PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee));
    }

    /// @notice Returns a quote for a given token amount according to a desired price manipulation resistance
    /// @notice across a specified list of fee tiers
    /// @param baseToken Address of the input token for the quote
    /// @param quoteToken Address of the output token for the quote
    /// @param baseTokenAmount The amount of token to be converted
    /// @param quotePeriod The time period over which to calculate the price
    /// @param feeTiers An array of fee tiers to gather prices from for the quote
    /// @return quoteTokenAmount The amount of quoteToken received for baseTokenAmount of baseToken
    function quote(
        address baseToken,
        address quoteToken,
        uint128 baseTokenAmount,
        uint32 quotePeriod,
        uint24[] memory feeTiers
    ) public view returns (uint256 quoteTokenAmount) {
        require(feeTiers.length > 0, 'FT');

        address pool;
        int24 meanWeightedTick;

        // If the quote period is more than 0, we can calculate the mean tick over an interval and weight it by
        // each pool's mean liquidity over the same period
        if (quotePeriod > 0) {
            WeightedOracleLibrary.PeriodObservation[] memory poolObservations =
                new WeightedOracleLibrary.PeriodObservation[](feeTiers.length);

            for (uint256 i = 0; i < feeTiers.length; i++) {
                pool = getPool(baseToken, quoteToken, feeTiers[i]);
                require(pool != address(0), 'NP');
                poolObservations[i] = WeightedOracleLibrary.consult(pool, quotePeriod);
            }

            meanWeightedTick = WeightedOracleLibrary.getArithmeticMeanTickWeightedByLiquidity(poolObservations);
        } else {
            // This is a 'Dangerous' quote request where instead of an average price over an interval,
            // a spot price is fetched and used.
            int256 totalWeightedTicks;
            uint128 totalLiquidity;
            int24 tick;
            uint128 liquidity;

            for (uint256 i = 0; i < feeTiers.length; i++) {
                pool = getPool(baseToken, quoteToken, feeTiers[i]);
                require(pool != address(0), 'NP');
                (tick, liquidity) = OracleLibrary.getBlockStartingTickAndLiquidity(pool);
                totalWeightedTicks += int256(liquidity) * tick;
                totalLiquidity += liquidity;
            }

            meanWeightedTick = int24(totalWeightedTicks / totalLiquidity);
            // Always round to negative infinity
            if (totalWeightedTicks < 0 && (totalWeightedTicks % totalLiquidity != 0)) meanWeightedTick--;
        }

        quoteTokenAmount = OracleLibrary.getQuoteAtTick(meanWeightedTick, baseTokenAmount, baseToken, quoteToken);
    }

    /// @notice Returns a quote for a given token amount according to a desired price manipulation resistance.
    /// @notice This function assumes the standard fee tiers of 300, 5000, and 10000 should be used
    /// @param baseToken Address of the input token for the quote
    /// @param quoteToken Address of the output token for the quote
    /// @param baseTokenAmount The amount of token to be converted
    /// @param resistance The desired resistance against price manipulation: Dangerous, Weak, Medium, Strong
    /// @return quoteTokenAmount The amount of quoteToken received for baseTokenAmount of baseToken
    function quoteWithFeeTiersAndManipulationResistance(
        address baseToken,
        address quoteToken,
        uint128 baseTokenAmount,
        ManipulationResistance resistance
    ) external view returns (uint256 quoteTokenAmount) {
        uint24[] memory feeTiers = new uint24[](3);
        feeTiers[0] = 300;
        feeTiers[1] = 5000;
        feeTiers[2] = 10000;

        return quote(baseToken, quoteToken, baseTokenAmount, quotePeriods[uint256(resistance)], feeTiers);
    }

    // @param resistance The desired resistance against price manipulation: Dangerous, Weak, Medium, Strong
    function quoteWithManipulationResistance(
        address baseToken,
        address quoteToken,
        uint128 baseTokenAmount,
        ManipulationResistance resistance,
        uint24[] memory feeTiers
    ) external view returns (uint256 quoteTokenAmount) {
        return quote(baseToken, quoteToken, baseTokenAmount, quotePeriods[uint256(resistance)], feeTiers);
    }
}
