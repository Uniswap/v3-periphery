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
        // will switch from quadratic to binary search
    }

    function swapToNextInitializedTick(
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

        uint256 token0Delta =
            SqrtPriceMath.getAmount0Delta(
                poolParams.sqrtRatioX96,
                sqrtRatioX96Target,
                poolParams.liquidity,
                zeroForOne ? false : true
            );
        uint256 token1Delta =
            SqrtPriceMath.getAmount1Delta(
                poolParams.sqrtRatioX96,
                sqrtRatioX96Target,
                poolParams.liquidity,
                zeroForOne ? true : false
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

        if (zeroForOne) {
            amount0Updated = positionParams.amount0Initial - ((token0Delta * 1e6) / (1e6 - poolParams.fee));
            amount1Updated = positionParams.amount1Initial + token1Delta;
            doSwap = (amount0Updated) / amount1Updated > (validDeposit0) / validDeposit1;
        } else {
            amount0Updated = positionParams.amount0Initial + token0Delta;
            amount1Updated = positionParams.amount1Initial - ((token1Delta * 1e6) / (1e6 - poolParams.fee));
            doSwap = (amount1Updated) / amount0Updated > (validDeposit1) / validDeposit0;
        }
    }

    // TODO: address range order scenarios
    function getPostSwapPrice(IUniswapV3Pool pool, PositionParams memory positionParams)
        internal
        view
        returns (uint160)
    {
        (PoolParams memory poolParams, int24 tickSpacing, int24 tick) = getPoolInputs(pool);
        bool zeroForOne =
            isZeroForOne(
                positionParams.amount0Initial,
                positionParams.amount1Initial,
                poolParams.sqrtRatioX96,
                positionParams.sqrtRatioX96Lower,
                positionParams.sqrtRatioX96Upper
            );
        bool crossTickBoundary = true;
        uint256 amount0Next;
        uint256 amount1Next;
        int24 nextInitializedTick;
        uint160 sqrtRatioNextX96;

        while (crossTickBoundary) {
            // returns the next initialized tick or the last tick within one word of the current tick.
            // We'll renew calculation at least on a per word basis for better rounding
            (nextInitializedTick, ) = pool.nextInitializedTickWithinOneWord(tick, tickSpacing, zeroForOne);
            if (zeroForOne) nextInitializedTick -= 1;
            sqrtRatioNextX96 = TickMath.getSqrtRatioAtTick(nextInitializedTick);

            (crossTickBoundary, amount0Next, amount1Next) = swapToNextInitializedTick(
                poolParams,
                positionParams,
                sqrtRatioNextX96,
                zeroForOne
            );

            // if crossing an initialized tick, update token amounts and other parameters to values at next tick
            if (crossTickBoundary) {
                console.log('nextTick');
                console.logInt(nextInitializedTick);
                (, int128 liquidityNet, , , , , , ) = pool.ticks(nextInitializedTick);

                positionParams.amount0Initial = amount0Next;
                positionParams.amount1Initial = amount1Next;
                poolParams.sqrtRatioX96 = sqrtRatioNextX96;
                // overflow desired
                poolParams.liquidity += uint128(liquidityNet);
                tick = nextInitializedTick;
            }
        }
        return sqrtRatioNextX96;
        // TODO: return calculateConstantLiquidityPostSwapSqrtPrice
        // return calculateConstantLiquidityPostSwapSqrtPrice(poolParams, positionParams);
    }

    function isZeroForOne(
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtRatioX96,
        uint160 sqrtRatioX96Lower,
        uint160 sqrtRatioX96Upper
    ) internal view returns (bool) {
        if (amount0 > amount1) {
            return
                amount0 / amount1 >
                // arbitrary liquidity param of 100_000 since it cancels out
                SqrtPriceMath.getAmount0Delta(sqrtRatioX96, sqrtRatioX96Upper, 100_000, false) /
                    SqrtPriceMath.getAmount1Delta(sqrtRatioX96, sqrtRatioX96Lower, 100_000, false);
        } else {
            return
                amount1 / amount0 <=
                SqrtPriceMath.getAmount1Delta(sqrtRatioX96, sqrtRatioX96Lower, 100_000, false) /
                    SqrtPriceMath.getAmount0Delta(sqrtRatioX96, sqrtRatioX96Upper, 100_000, false);
        }
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
