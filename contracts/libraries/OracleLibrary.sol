// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

/// @title Oracle library
/// @notice Provides functions to compute time weighted token conversion rate using the oracle
library OracleLibrary {
    uint32 constant UINT32_MAX = uint32(-1);

    /// @notice Calculate time weighted token conversion rate at a time range from a single pool
    /// @dev This function supports time range that spans across uint32 overflow boundaries
    /// @param currentBlockTimestamp The current block timestamp
    /// @param poolAddress The address of the pool to observe
    /// @param tokenIn The address of the ERC20 token contract of amountIn
    /// @param amountIn The token input amount before conversion
    /// @param startBlockTimestamp The start of the time range to be observed
    /// @param endBlockTimestamp The end of the time range to be observed
    /// @return amountOut The token output amount after conversion
    function consult(
        uint32 currentBlockTimestamp,
        address poolAddress,
        address tokenIn,
        uint256 amountIn,
        uint32 startBlockTimestamp,
        uint32 endBlockTimestamp
    ) internal view returns (uint256 amountOut) {
        require(startBlockTimestamp != endBlockTimestamp, 'Bad range');
        IUniswapV3Pool oracle = IUniswapV3Pool(poolAddress);
        require(tokenIn == oracle.token0() || tokenIn == oracle.token1(), 'Invalid token');

        uint32[] memory secondAgos = new uint32[](2);
        secondAgos[0] = currentBlockTimestamp >= startBlockTimestamp
            ? currentBlockTimestamp - startBlockTimestamp
            : currentBlockTimestamp + (UINT32_MAX - startBlockTimestamp);

        secondAgos[1] = currentBlockTimestamp >= endBlockTimestamp
            ? currentBlockTimestamp - endBlockTimestamp
            : currentBlockTimestamp + (UINT32_MAX - endBlockTimestamp);

        (int56[] memory tickCumulatives, ) = oracle.observe(secondAgos);

        int56 observationTimeDelta =
            startBlockTimestamp < endBlockTimestamp
                ? int56(endBlockTimestamp - startBlockTimestamp)
                : int56(endBlockTimestamp + (UINT32_MAX - startBlockTimestamp));
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 tick = int24(tickCumulativesDelta / observationTimeDelta);

        // Always round to negative infinity
        tick = (tick < 0 && (tickCumulativesDelta % observationTimeDelta != 0)) ? tick - 1 : tick;

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);

        if (tokenIn == oracle.token0()) {
            amountOut = FullMath.mulDiv(ratioX128, amountIn, 1 << 128);
        } else {
            amountOut = FullMath.mulDiv(1 << 128, amountIn, ratioX128);
        }
    }
}
