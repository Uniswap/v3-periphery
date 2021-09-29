// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.8.0;

import './OracleLibrary.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';

/// @title ChainedOracleLibrary
library ChainedOracleLibrary {
    /// @notice Returns a synthetic tick representing the price of the outlier tokens in an array of pools, each containing one overlapping token.
    /// I.e., returns synthetic tick representing the price of token_A (tA) in terms of token_D given pools of tA/tB - tB/tC - tC/tD.
    /// @dev Each pool must contain one overlapping token. As tokens may have different decimal expressions, weighing twaps by liquidity is insecure unless
    /// the decimal expression of each token is included in the calculation. Because of this, this library intentionally excludes
    /// liquidity weighing.
    /// @param secondsAgo The number of seconds ago from which to return a time weighted average tick in all pools
    /// @param pools The pools from which to return a chained price
    /// @return syntheticTick The sqrtPriceX96 representing tokenA in terms of tokenC
    function getPriceChained(uint32 secondsAgo, address[] memory pools) external view returns (int24 syntheticTick) {
        require(secondsAgo != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        int24[] memory _arithmeticMeanTicks = new int24[](pools.length);

        // populate an array with an arithmetic mean tick of each pool
        for (uint256 i; i < pools.length; i++) {
            IUniswapV3Pool _pool = IUniswapV3Pool(pools[i]);

            (int56[] memory _poolTickCumulatives, ) = IUniswapV3Pool(_pool).observe(secondsAgos);

            int56 _poolTickCumulativesDelta = _poolTickCumulatives[1] - _poolTickCumulatives[0];

            _arithmeticMeanTicks[i] = int24(_poolTickCumulativesDelta / secondsAgo);
        }

        // create a synthetic tick by chaining together the arithmetic mean ticks of the pools
        for (uint256 i; (i + 1) < pools.length; i++) {
            IUniswapV3Pool _poolA = IUniswapV3Pool(pools[i]);
            IUniswapV3Pool _poolB = IUniswapV3Pool(pools[i + 1]);

            if (_poolA.token1() == _poolB.token0()) {
                // Add to synthetic tick
                // 1.0001**(Tick_a + Tick_b) = Price_a * Price_b

                syntheticTick = syntheticTick + _arithmeticMeanTicks[i];
            } else {
                // invert price by subtracting from synthetic tick
                // 1.0001**(Tick_a - Tick_b) = Price_a / Price_b
                syntheticTick = syntheticTick - _arithmeticMeanTicks[i];
            }
        }
    }
}
