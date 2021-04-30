// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '../libraries/PoolAddress.sol';

/// @title Oracle library
/// @notice Provides functions to commmunicate with V3 pool oracle
library OracleLibrary {
    /// @notice Fetches time-weighted token conversion rate using Uniswap V3 pool oracle
    /// @param factory The Uniswap V3 factory contract address
    /// @param baseToken The ERC20 token contract address of the baseAmount denomination
    /// @param quoteToken The ERC20 token contract address of the quoteAmount denomination
    /// @param fee The fee of the pool we want to observe
    /// @param baseAmount The number of token to be converted
    /// @param period The number of seconds in the past to start calculating tick cumulatives from
    /// @return quoteAmount The number of token received for baseAmount
    function consult(
        address factory,
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint256 baseAmount,
        uint32 period
    ) internal view returns (uint256 quoteAmount) {
        require(period != 0, 'BP');
        IUniswapV3Pool oracle =
            IUniswapV3Pool(PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(baseToken, quoteToken, fee)));

        uint32[] memory secondAgos = new uint32[](2);
        secondAgos[0] = period;
        secondAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = oracle.observe(secondAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 tick = int24(tickCumulativesDelta / period);

        // Always round to negative infinity
        tick = (tick < 0 && (tickCumulativesDelta % period != 0)) ? tick - 1 : tick;

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        uint256 ratioX192 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1);

        quoteAmount = baseToken < quoteToken
            ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
            : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
    }
}
