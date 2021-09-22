// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import './OracleLibrary.sol';

/// @title ChainedOracleLibrary
/// @notice Returns a sqrtPriceX96 representing the price of token A in terms of Token C by chaining the price
/// through an intermediary token B. 
/// @dev As tokens may have different decimal expressions, weighing twaps by liquidity is insecure unless
/// the decimal expression of each token is included in the calculation. Because of this, this library excludes
/// liquidity weighing.
library ChainedOracleLibrary {

    
    function getPriceChained(
        uint32 period,
        address quotePool,
        address basePool
    ) external view returns (uint160 chainedSqrtPriceX96) {
        require(period != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        // derive base pool arithmetic mean tick
        IUniswapV3Pool _basePool = IUniswapV3Pool(basePool);

        (int56[] memory basePoolTickCumulatives, ) =
            IUniswapV3Pool(_basePool).observe(
                secondsAgos
            );

        int56 basePoolTickCumulativesDelta = basePoolTickCumulatives[1] - basePoolTickCumulatives[0];

        int24 basePoolArithmeticMeanTick = int24(basePoolTickCumulativesDelta / period);

        // derive quote pool arithmetic mean tick

        IUniswapV3Pool _quotePool = IUniswapV3Pool(quotePool);

        (int56[] memory quotePoolTickCumulatives, ) =
            IUniswapV3Pool(_quotePool).observe(
                secondsAgos
            );

        int56 quotePoolTickCumulativesDelta = quotePoolTickCumulatives[1] - quotePoolTickCumulatives[0];

        int24 quotePoolArithmeticMeanTick = int24(quotePoolTickCumulativesDelta / period);

        // chain the tick reading to get quoteToken in terms of baseToken

            if (_quotePool.token1.address == _basePool.token0.address) {
            // chain price directly
            // to do - figure out uint overflow potential
             chainedSqrtPriceX96 = (
                TickMath.getSqrtRatioAtTick(basePoolArithmeticMeanTick) * TickMath.getSqrtRatioAtTick(quotePoolArithmeticMeanTick)
                );
            } else {
            // invert price  
            chainedSqrtPriceX96 = (
                TickMath.getSqrtRatioAtTick(basePoolArithmeticMeanTick) / TickMath.getSqrtRatioAtTick(quotePoolArithmeticMeanTick)
             );
        }
    }
}
