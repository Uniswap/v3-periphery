pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '../libraries/WeightedOracleLibrary.sol';
import '../libraries/OracleLibrary.sol';

contract OpinionatedOracle {

    IUniswapV3Factory factory;

    enum ManipulationResistance {
        Dangerous, // Spot price from beginning of the block
        Weak, // 1 minute
        Medium, // 30 minutes
        Strong // 1 day
    }

    uint32[4] quotePeriods = [0, 60 seconds, 30 minutes, 1 days];

    constructor(address _factory) {
        factory = IUniswapV3Factory(_factory);
    }

    function quoteWithFeeTiers(
        address baseToken,
        address quoteToken,
        uint128 baseTokenAmount,
        ManipulationResistance resistance,
        uint24[] memory feeTiers
    ) public view returns (uint256 quoteTokenAmount) {
        require(feeTiers.length > 0, 'FT');

        uint32 quotePeriod = quotePeriods[uint256(resistance)];
        address pool;
        int24 meanWeightedTick;

        // If the quote period is more than 0, we can calculate the tick over an interval and weight it by
        // each pool's liquidity.
        if (quotePeriod > 0) {
            WeightedOracleLibrary.PeriodObservation[] memory poolObservations
                = new WeightedOracleLibrary.PeriodObservation[](feeTiers.length);

            for (uint256 i = 0; i < feeTiers.length; i++) {
                pool = factory.getPool(baseToken, quoteToken, feeTiers[i]);
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
                pool = factory.getPool(baseToken, quoteToken, feeTiers[i]);
                require(pool != address(0), 'NP');
                (tick, liquidity) = OracleLibrary.getBlockStartingTickAndLiquidity(pool);
                totalWeightedTicks += int256(liquidity) * tick;
                totalLiquidity += liquidity;
            }
            meanWeightedTick = int24(totalWeightedTicks / totalLiquidity);
        }

        quoteTokenAmount = OracleLibrary.getQuoteAtTick(meanWeightedTick, baseTokenAmount, baseToken, quoteToken);

    }

    // function 

    // function quote(
    //     address baseToken,
    //     address quoteToken,
    //     uint128 baseTokenAmount,
    //     ManipulationResistance resistance
    // ) external view returns (uint256 quoteTokenAmount) {
    //     uint24[] memory feeTiers = [500, 3000, 10000];
    //     return quoteWithFeeTiers(
    //         baseToken,
    //         quoteToken,
    //         baseTokenAmount,
    //         resistance,
    //         feeTiers
    //     );
    // }

}