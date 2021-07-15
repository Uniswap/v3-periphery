// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import './PoolTicksLibrary.sol';
import 'hardhat/console.sol';

library SwapToRatio {
    using PoolTicksLibrary for IUniswapV3Pool;
    using SafeMath for uint256;
    using SafeMath for uint128;

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

    // TODO: Look into rounding things correctly
    // TODO: know exact price to change liquidity at (liquidity changes right of initialized tick?)
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
            // include fee amount in token delta for exchanged token
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

        while (crossTickBoundary) {
            uint256 amount0Next;
            uint256 amount1Next;
            int24 nextInitializedTick;
            bool initialized;

            // returns the next initialized tick or the last tick within one word of the current tick.
            // We'll renew calculation at least on a per word basis for better rounding
            (nextInitializedTick, initialized) = pool.nextInitializedTickWithinOneWord(tick, tickSpacing, zeroForOne);
            uint160 sqrtRatioNextX96 = TickMath.getSqrtRatioAtTick(nextInitializedTick);

            (crossTickBoundary, amount0Next, amount1Next) = swapToNextInitializedTick(
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

        return
            calculateConstantLiquidityPostSwapSqrtPrice(
                poolParams.sqrtRatioX96,
                poolParams.liquidity,
                poolParams.fee,
                positionParams.sqrtRatioX96Lower,
                positionParams.sqrtRatioX96Upper,
                positionParams.amount0Initial,
                positionParams.amount1Initial
            );
    }

    // TODO: Only solves for token1 right now
    function calculateConstantLiquidityPostSwapSqrtPrice(
        uint160 sqrtRatioX96,
        uint128 liquidity,
        uint24 fee,
        uint160 sqrtRatioX96Lower,
        uint160 sqrtRatioX96Upper,
        uint256 amount0Initial,
        uint256 amount1Initial
    ) internal view returns (uint160 postSwapSqrtRatioX96) {
        uint256 liquidityFeeMultiplier = (liquidity * 1e6) / (1e6 - fee);

        int256 a =
            ((int256((amount0Initial * sqrtRatioX96 * sqrtRatioX96Upper) / FixedPoint96.Q96) +
                int256(liquidity * sqrtRatioX96Upper) -
                int256(liquidityFeeMultiplier * sqrtRatioX96)) * int256(FixedPoint96.Q96));

        a = a / sqrtRatioX96Upper / sqrtRatioX96;

        int256 b =
            (int256(liquidityFeeMultiplier * FixedPoint96.Q96) -
                int256(liquidity * FixedPoint96.Q96) -
                int256(sqrtRatioX96Lower * amount0Initial) -
                int256((liquidity * sqrtRatioX96Lower * FixedPoint96.Q96) / sqrtRatioX96) +
                int256(amount1Initial * FixedPoint96.Q96 * FixedPoint96.Q96) /
                int256(sqrtRatioX96Upper) +
                int256((liquidityFeeMultiplier * sqrtRatioX96 * FixedPoint96.Q96) / sqrtRatioX96Upper)) /
                int256(FixedPoint96.Q96);

        int256 c =
            (int256(liquidity * sqrtRatioX96Lower) -
                int256(amount1Initial * FixedPoint96.Q96) -
                int256(liquidityFeeMultiplier * sqrtRatioX96)) / int256(FixedPoint96.Q96);

        // quadratic formula
        return uint160((int256(sqrt(uint256((b * b) - (4 * a *c)))) - (b)) * int256(FixedPoint96.Q96) / (2 * a));
    }

    function isZeroForOne(
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtRatioX96,
        uint160 sqrtRatioX96Lower,
        uint160 sqrtRatioX96Upper
    ) private view returns (bool) {
        if (amount0 > amount1) {
            return
                amount0 / amount1 >
                SqrtPriceMath.getAmount0Delta(
                    sqrtRatioX96,
                    sqrtRatioX96Upper,
                    1, // arbitrary since it cancels out
                    false
                ) /
                    SqrtPriceMath.getAmount1Delta(sqrtRatioX96, sqrtRatioX96Lower, 1, false);
        } else {
            return
                amount1 / amount0 <
                SqrtPriceMath.getAmount1Delta(sqrtRatioX96, sqrtRatioX96Lower, 1, false) /
                    SqrtPriceMath.getAmount0Delta(sqrtRatioX96, sqrtRatioX96Upper, 1, false);
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


    // borrowed: https://github.com/hifi-finance/prb-math/blob/a3847fb25a86ecc0f1cdee370a27ac0ece1ba46a/contracts/PRBMath.sol#L598
    function sqrt(uint256 x) internal pure returns (uint256 result) {
        if (x == 0) {
            return 0;
        }

        // Set the initial guess to the closest power of two that is higher than x.
        uint256 xAux = uint256(x);
        result = 1;
        if (xAux >= 0x100000000000000000000000000000000) {
            xAux >>= 128;
            result <<= 64;
        }
        if (xAux >= 0x10000000000000000) {
            xAux >>= 64;
            result <<= 32;
        }
        if (xAux >= 0x100000000) {
            xAux >>= 32;
            result <<= 16;
        }
        if (xAux >= 0x10000) {
            xAux >>= 16;
            result <<= 8;
        }
        if (xAux >= 0x100) {
            xAux >>= 8;
            result <<= 4;
        }
        if (xAux >= 0x10) {
            xAux >>= 4;
            result <<= 2;
        }
        if (xAux >= 0x8) {
            result <<= 1;
        }

        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1;
        result = (result + x / result) >> 1; // Seven iterations should be enough
        uint256 roundedDownResult = x / result;
        return result >= roundedDownResult ? roundedDownResult : result;
    }
}
