// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint128.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/Tick.sol';
import '../interfaces/INonfungiblePositionManager.sol';
import './LiquidityAmounts.sol';
import './PoolAddress.sol';
import './PositionKey.sol';

library PositionValue {
    function total(INonfungiblePositionManager nft, uint256 tokenId)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (amount0, amount1) = principal(nft, tokenId);
        (uint256 amount0Fees, uint256 amount1Fees) = fees(nft, tokenId);
        amount0 += amount0Fees;
        amount1 += amount1Fees;
    }

    function principal(INonfungiblePositionManager nft, uint256 tokenId)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (, , address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) =
            nft.positions(tokenId);

        (uint160 sqrtRatioX96, , , , , , ) =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    nft.factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            )
                .slot0();

        return
            LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );
    }

    function fees(INonfungiblePositionManager nft, uint256 tokenId)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 positionFeeGrowthInside0LastX128,
            uint256 positionFeeGrowthInside1LastX128,
            uint256 tokensOwed0,
            uint256 tokensOwed1
        ) = nft.positions(tokenId);

        return
            _fees(
                nft,
                PositionParams({
                    token0: token0,
                    token1: token1,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidity: liquidity,
                    positionFeeGrowthInside0LastX128: positionFeeGrowthInside0LastX128,
                    positionFeeGrowthInside1LastX128: positionFeeGrowthInside1LastX128,
                    tokensOwed0: tokensOwed0,
                    tokensOwed1: tokensOwed1
                })
            );
    }

    struct PositionParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 positionFeeGrowthInside0LastX128;
        uint256 positionFeeGrowthInside1LastX128;
        uint256 tokensOwed0;
        uint256 tokensOwed1;
    }

    function _fees(
        INonfungiblePositionManager nft,
        PositionParams memory positionParams
    ) private view returns (uint256 amount0, uint256 amount1) {
        (uint256 poolFeeGrowthInside0LastX128, uint256 poolFeeGrowthInside1LastX128) =
            _getFeeGrowthInside(
                nft,
                positionParams.token0,
                positionParams.token1,
                positionParams.fee,
                positionParams.tickLower,
                positionParams.tickUpper
            );

        amount0 = FullMath.mulDiv(
            poolFeeGrowthInside0LastX128 - positionParams.positionFeeGrowthInside0LastX128,
            positionParams.liquidity,
            FixedPoint128.Q128
        ) + positionParams.tokensOwed0;

        amount1 = FullMath.mulDiv(
            poolFeeGrowthInside1LastX128 - positionParams.positionFeeGrowthInside1LastX128,
            positionParams.liquidity,
            FixedPoint128.Q128
        ) + positionParams.tokensOwed1;
    }

    function _getFeeGrowthInside(
        INonfungiblePositionManager nft,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) private view returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) {
        IUniswapV3Pool pool =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    nft.factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            );

        (, int24 tickCurrent, , , , , ) = pool.slot0();
        (, , uint256 lowerFeeGrowthOutside0X128, uint256 lowerFeeGrowthOutside1X128, , , , ) = pool.ticks(tickLower);
        (, , uint256 upperFeeGrowthOutside0X128, uint256 upperFeeGrowthOutside1X128, , , , ) = pool.ticks(tickUpper);

        if (tickCurrent < tickLower) {
            feeGrowthInside0X128 = lowerFeeGrowthOutside0X128 - upperFeeGrowthOutside0X128;
            feeGrowthInside1X128 = lowerFeeGrowthOutside1X128 - upperFeeGrowthOutside1X128;
        } else if (tickCurrent < tickUpper) {
            uint256 feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128();
            uint256 feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128();
            feeGrowthInside0X128 = feeGrowthGlobal0X128 - lowerFeeGrowthOutside0X128 - upperFeeGrowthOutside0X128;
            feeGrowthInside1X128 = feeGrowthGlobal1X128 - lowerFeeGrowthOutside1X128 - upperFeeGrowthOutside1X128;
        } else {
            feeGrowthInside0X128 = upperFeeGrowthOutside0X128 - lowerFeeGrowthOutside0X128;
            feeGrowthInside1X128 = upperFeeGrowthOutside1X128 - lowerFeeGrowthOutside1X128;
        }
    }
}
