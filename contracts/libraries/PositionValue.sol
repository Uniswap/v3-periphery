// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '../interfaces/INonfungiblePositionManager.sol';
import './LiquidityAmounts.sol';
import './PoolAddress.sol';

library PositionValue {
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
}
