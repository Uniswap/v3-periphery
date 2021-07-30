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

/// @title Returns information about the token value held in a Uniswap V3 NFT
library PositionValue {
    /// @notice returns the total token value including the principal and the fees owed
    /// @param positionManager The Uniswap V3 NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total value
    /// @return amount0 The total amount of token0 including principal and fees
    /// @return amount1 The total amount of token1 including principal and fees
    function total(INonfungiblePositionManager positionManager, uint256 tokenId)
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
        ) = positionManager.positions(tokenId);

        (uint160 sqrtRatioX96, , , , , , ) =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    positionManager.factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            )
                .slot0();

        (amount0, amount1) = _fees(
            positionManager,
            FeeParams(
                token0,
                token1,
                fee,
                tickLower,
                tickUpper,
                liquidity,
                positionFeeGrowthInside0LastX128,
                positionFeeGrowthInside1LastX128,
                tokensOwed0,
                tokensOwed1
            )
        );
        (uint256 amount0Principal, uint256 amount1Principal) =
            _principal(PrincipalParams(sqrtRatioX96, tickLower, tickUpper, liquidity));
        amount0 += amount0Principal;
        amount1 += amount1Principal;
    }

    struct PrincipalParams {
        uint160 sqrtRatioX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    /// @notice Calculates the principal (currently acting as liquidity) owed to the token owner in the event
    /// that the position is burned
    /// @param positionManager The Uniswap V3 NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total principal owed
    /// @return amount0 The principal amount of token0
    /// @return amount1 The principal amount of token1
    function principal(INonfungiblePositionManager positionManager, uint256 tokenId)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (, , address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) =
            positionManager.positions(tokenId);

        (uint160 sqrtRatioX96, , , , , , ) =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    positionManager.factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            )
                .slot0();

        return _principal(PrincipalParams(sqrtRatioX96, tickLower, tickUpper, liquidity));
    }

    function _principal(PrincipalParams memory params) internal pure returns (uint256 amount0, uint256 amount1) {
        return
            LiquidityAmounts.getAmountsForLiquidity(
                params.sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(params.tickLower),
                TickMath.getSqrtRatioAtTick(params.tickUpper),
                params.liquidity
            );
    }

    struct FeeParams {
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

    /// @notice Calculates the total fees owed to the token owner
    /// @param positionManager The Uniswap V3 NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total fees owed
    /// @return amount0 The amount of fees owed in token0
    /// @return amount1 The amount of fees owed in token1
    function fees(INonfungiblePositionManager positionManager, uint256 tokenId)
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
        ) = positionManager.positions(tokenId);

        return
            _fees(
                positionManager,
                FeeParams({
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

    function _fees(INonfungiblePositionManager positionManager, FeeParams memory feeParams)
        private
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint256 poolFeeGrowthInside0LastX128, uint256 poolFeeGrowthInside1LastX128) =
            _getFeeGrowthInside(
                positionManager,
                feeParams.token0,
                feeParams.token1,
                feeParams.fee,
                feeParams.tickLower,
                feeParams.tickUpper
            );

        amount0 =
            FullMath.mulDiv(
                poolFeeGrowthInside0LastX128 - feeParams.positionFeeGrowthInside0LastX128,
                feeParams.liquidity,
                FixedPoint128.Q128
            ) +
            feeParams.tokensOwed0;

        amount1 =
            FullMath.mulDiv(
                poolFeeGrowthInside1LastX128 - feeParams.positionFeeGrowthInside1LastX128,
                feeParams.liquidity,
                FixedPoint128.Q128
            ) +
            feeParams.tokensOwed1;
    }

    function _getFeeGrowthInside(
        INonfungiblePositionManager positionManager,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) private view returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) {
        IUniswapV3Pool pool =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    positionManager.factory(),
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
