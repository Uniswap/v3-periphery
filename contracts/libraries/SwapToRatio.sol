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

    // TODO: Current solving for token1 only
    function tradeToNextTick(
        PoolParams memory poolParams,
        PositionParams memory positionParams,
        uint160 sqrtRatioX96Target,
        bool zeroForOne
    ) internal view returns (bool) {
        int256 token0Delta =
            SqrtPriceMath.getAmount0Delta(poolParams.sqrtRatioX96, sqrtRatioX96Target, int128(poolParams.liquidity));
        int256 token1Delta =
            int256(SqrtPriceMath.getAmount1Delta(poolParams.sqrtRatioX96, sqrtRatioX96Target, int128(poolParams.liquidity)));
        uint256 amount1InitialLessFee =
            FullMath.mulDiv(uint256(positionParams.amount1Initial), 1e6 - poolParams.fee, 1e6);

        console.logInt(token0Delta);
        console.log(uint256(token0Delta));
        console.logInt(token1Delta);
        console.log(amount1InitialLessFee);

        /* uint256 ratioValidDeposit = uint256(-token1Delta) / uint256(token0Delta);
        uint256 ratioAvailableToDeposit =
            (positionParams.amount1Initial + uint256(token1Delta) * (positionParams.amount1Initial / amount1InitialLessFee)) /
                (positionParams.amount0Initial + token0Delta); */
/*
        console.log(ratioValidDeposit);
        console.log(ratioAvailableToDeposit); */

        return false;

        /* return ratioValidDeposit < ratioAvailableToDeposit; */
    }

    // TODO: this function is still in rough shape atm
    function getPostSwapPrice(IUniswapV3Pool pool, PositionParams memory positionParams)
        internal
        view
        returns (uint160 postSwapSqrtRatioX96)
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();
        uint24 fee = pool.fee();

        PoolParams memory poolParams = PoolParams({sqrtRatioX96: sqrtRatioX96, liquidity: pool.liquidity(), fee: fee});

        bool zeroForOne =
            SqrtPriceMath.getAmount0Delta(
                poolParams.sqrtRatioX96,
                positionParams.sqrtRatioX96Upper,
                poolParams.liquidity,
                false
            ) < positionParams.amount0Initial;

        return 5;
    }

    /* // TODO: this function is still in rough shape atm
    function getPostSwapPrice(IUniswapV3Pool pool, PositionParams memory positionParams)
        internal
        view
        returns (uint160 postSwapSqrtRatioX96)
    {
        (uint160 sqrtRatioX96, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();
        uint24 fee = pool.fee();

        PoolParams memory poolParams = PoolParams({sqrtRatioX96: sqrtRatioX96, liquidity: pool.liquidity(), fee: fee});

        bool zeroForOne;
        int24 nextInitializedTick;
        bool crossedTickBoundary = true; // TODO: awkward naming since this doesn't reeeeally start out as true

        // first

        while (crossedTickBoundary) {
            postSwapSqrtRatioX96 = calculateConstantLiquidityPostSwapSqrtPrice(poolParams, positionParams);
            zeroForOne = postSwapSqrtRatioX96 < poolParams.sqrtRatioX96;

            // returns the next initialized tick or the last tick within one word of the current tick
            // will renew calculation at least on a per word basis for better rounding
            (nextInitializedTick, ) = pool.nextInitializedTickWithinOneWord(tick, tickSpacing, zeroForOne);

            crossedTickBoundary = zeroForOne
                ? postSwapSqrtRatioX96 <= TickMath.getSqrtRatioAtTick(nextInitializedTick)
                : postSwapSqrtRatioX96 > TickMath.getSqrtRatioAtTick(nextInitializedTick);

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
                positionParams.amount0Initial += uint256(amount0Delta);
                positionParams.amount1Initial += uint256(amount1Delta);
                poolParams.sqrtRatioX96 = postSwapSqrtRatioX96;
                poolParams.liquidity += uint128(liquidityNet);
                tick = nextInitializedTick;
            }
        }
    } */
}
