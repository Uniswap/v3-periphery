// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './PoolTicksLibrary.sol';

library SwapToRatio {
    using SafeCast for uint256;
    using PoolTicksLibrary for IUniswapV3Pool;

    struct PoolParams {
        uint160 sqrtRatioX96;
        uint128 liquidity;
    }

    struct PositionParams {
        uint160 sqrtRatioX96Lower;
        uint160 sqrtRatioX96Upper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    function getPostSwapPrice(PoolParams memory poolParams, PositionParams memory positionParms)
        internal
        pure
        returns (uint160 postSwapSqrtRatioX96)
    {
        // given liquidty / current price / bounds / initialAmounts - calculate how much the price should move
        // so that the token ratios are of equal liquidity.
    }

    function swapToRatio(IUniswapV3Pool pool, PositionParams memory positionParams)
        internal
        view
        returns (uint160 postSwapSqrtRatioX96)
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();

        PoolParams memory poolParams;
        poolParams.sqrtRatioX96 = sqrtRatioX96;
        poolParams.liquidity = pool.liquidity();

        bool zeroForOne;
        int24 nextInitializedTick;
        bool crossedTickBoundary = true; // TODO: awkward naming since this doesn't reeeeally start out as true

        while (crossedTickBoundary) {
            postSwapSqrtRatioX96 = getPostSwapPrice(poolParams, positionParams);
            zeroForOne = postSwapSqrtRatioX96 < poolParams.sqrtRatioX96;

            // returns the next initialized tick or the last tick within one word of the current tick
            // will renew calculation at least on a per word basis for better rounding
            (nextInitializedTick, ) = pool.nextInitializedTickWithinOneWord(tick, tickSpacing, zeroForOne);

            crossedTickBoundary = zeroForOne
                ? postSwapSqrtRatioX96 <= TickMath.getSqrtRatioAtTick(nextInitializedTick)
                : postSwapSqrtRatioX96 >= TickMath.getSqrtRatioAtTick(nextInitializedTick);

            if (crossedTickBoundary) {
                // if crossing tick, get token amounts at crossed tick
                // then run getPostSwapPrice with new amounts + new liquidity + new sqrtRatioX96
                int256 amount0Delta =
                    SqrtPriceMath.getAmount0Delta(
                        postSwapSqrtRatioX96,
                        TickMath.getSqrtRatioAtTick(nextInitializedTick),
                        zeroForOne ? int128(-poolParams.liquidity) : int128(poolParams.liquidity)
                    );
                int256 amount1Delta =
                    SqrtPriceMath.getAmount1Delta(
                        postSwapSqrtRatioX96,
                        TickMath.getSqrtRatioAtTick(nextInitializedTick),
                        zeroForOne ? int128(poolParams.liquidity) : int128(-poolParams.liquidity)
                    );
                (, int128 liquidityNet, , , , , , ) = pool.ticks(nextInitializedTick);

                // overflow desired, but open to better ways to do the addition/subtraction
                positionParams.amount0Desired += uint256(amount0Delta);
                positionParams.amount1Desired += uint256(amount1Delta);
                poolParams.sqrtRatioX96 = postSwapSqrtRatioX96;
                poolParams.liquidity += uint128(liquidityNet);
                tick = nextInitializedTick;
            }
        }
    }
}
