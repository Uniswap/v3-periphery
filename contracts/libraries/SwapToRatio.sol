// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './PoolTicksLibrary.sol';
import 'hardhat/console.sol';

library SwapToRatio {
    using PoolTicksLibrary for IUniswapV3Pool;

    struct PoolParams {
        uint160 sqrtRatioX96;
        uint128 liquidity;
        uint24 fee;
    }

    struct PositionParams {
        uint160 sqrtRatioX96Lower;
        uint160 sqrtRatioX96Upper;
        uint256 amount0Initial;
        uint256 amount1Initial;
    }

    function calculateConstantLiquidityPostSwapSqrtPrice(
        PoolParams memory poolParams,
        PositionParams memory positionParms
    ) internal pure returns (uint160 postSwapSqrtRatioX96) {
        // given constant liquidty / current price / bounds / initialAmounts - calculate how much the price should move
        // so that the token ratios are of equal liquidity.
    }

    // TODO: Look into rounding things correctly
    // TODO: know exact price to change liquidity at (liquidity changes right of initialized tick?)
    function swapToNextTick(
        PoolParams memory poolParams,
        PositionParams memory positionParams,
        uint160 sqrtRatioX96Target,
        bool zeroForOne
    )
        internal
        view
        returns (
            bool doSwap,
            uint256 amount0Updated,
            uint256 amount1Updated
        )
    {
        if (zeroForOne) {
          if (sqrtRatioX96Target < positionParams.sqrtRatioX96Lower) {
            return (false, 0, 0);
          }
        } else {
          if (sqrtRatioX96Target > positionParams.sqrtRatioX96Upper) {
            return (false, 0, 0);
          }
        }

        int256 token0Delta =
            SqrtPriceMath.getAmount0Delta(
                poolParams.sqrtRatioX96,
                sqrtRatioX96Target,
                zeroForOne ? int128(-poolParams.liquidity) : int128(poolParams.liquidity)
            );
        int256 token1Delta =
            SqrtPriceMath.getAmount1Delta(
                poolParams.sqrtRatioX96,
                sqrtRatioX96Target,
                zeroForOne ? int128(poolParams.liquidity) : int128(-poolParams.liquidity)
            );

        uint256 validDeposit0 =
            SqrtPriceMath.getAmount0Delta(
                sqrtRatioX96Target,
                positionParams.sqrtRatioX96Upper,
                poolParams.liquidity,
                false
            );
        uint256 validDeposit1 =
            SqrtPriceMath.getAmount1Delta(
                sqrtRatioX96Target,
                positionParams.sqrtRatioX96Lower,
                poolParams.liquidity,
                false
            );

        // overflow desired
        if (zeroForOne) {
            amount0Updated = positionParams.amount0Initial + uint256(((token0Delta * 1e6) / (1e6 - poolParams.fee)));
            amount1Updated = positionParams.amount1Initial + uint256(token1Delta);
            // 1e5 to increase precision for small price differences
            doSwap = (amount0Updated * 1e5) / amount1Updated >= (validDeposit0 * 1e5) / validDeposit1;
        } else {
            amount0Updated = positionParams.amount0Initial + uint256(token0Delta);
            amount1Updated = positionParams.amount1Initial + uint256(((token1Delta * 1e6) / (1e6 - poolParams.fee)));
            doSwap = (amount1Updated * 1e5) / amount0Updated >= (validDeposit1 * 1e5) / validDeposit0;
        }
    }

    function getPostSwapPrice(IUniswapV3Pool pool, PositionParams memory positionParams)
        internal
        view
        returns (uint160)
    {
        (PoolParams memory poolParams, int24 tickSpacing, int24 tick) = getPoolInputs(pool);

        bool zeroForOne =
            SqrtPriceMath.getAmount0Delta(
                poolParams.sqrtRatioX96,
                positionParams.sqrtRatioX96Upper,
                poolParams.liquidity,
                false
            ) < positionParams.amount0Initial;
        bool crossTickBoundary = true;
        uint256 amount0Next;
        uint256 amount1Next;
        int24 nextInitializedTick;

        while (crossTickBoundary) {
            // returns the next initialized tick or the last tick within one word of the current tick
            // will renew calculation at least on a per word basis for better rounding
            (nextInitializedTick, ) = pool.nextInitializedTickWithinOneWord(tick, tickSpacing, zeroForOne);
            uint160 sqrtRatioNextX96 = TickMath.getSqrtRatioAtTick(nextInitializedTick);

            (crossTickBoundary, amount0Next, amount1Next) = swapToNextTick(
                poolParams,
                positionParams,
                sqrtRatioNextX96,
                zeroForOne
            );

            // if crossing an initialized tick, update token amounts and other parameters to values at next tick
            if (crossTickBoundary) {
                (, int128 liquidityNet, , , , , , ) = pool.ticks(nextInitializedTick);

                positionParams.amount0Initial = amount0Next;
                positionParams.amount1Initial = amount1Next;
                poolParams.sqrtRatioX96 = sqrtRatioNextX96;
                // overflow desired
                poolParams.liquidity += uint128(liquidityNet);
                tick = nextInitializedTick;
            }
        }
        return calculateConstantLiquidityPostSwapSqrtPrice(poolParams, positionParams);
    }

    function getPoolInputs(IUniswapV3Pool pool)
        private
        view
        returns (
            PoolParams memory poolParams,
            int24 tickSpacing,
            int24 tick
        )
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        uint24 fee = pool.fee();
        poolParams = PoolParams({sqrtRatioX96: sqrtRatioX96, liquidity: pool.liquidity(), fee: fee});
        tickSpacing = pool.tickSpacing();
    }
}
