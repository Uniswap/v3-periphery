// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './interfaces/ITickLens.sol';

/// @title Tick Lens contract
contract TickLens is ITickLens {
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = -MIN_TICK;

    function getStaticData(address pool)
        external
        view
        override
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint128 liquidity
        )
    {
        (sqrtPriceX96, tick, , , , , ) = IUniswapV3Pool(pool).slot0();
        liquidity = IUniswapV3Pool(pool).liquidity();
    }

    function getPopulatedTicksInWord(
        address pool,
        int16 tickBitmapIndex
    ) public view override returns (PopulatedTick[] memory populatedTicks) {
        // fetch bitmap
        uint256 bitmap = IUniswapV3Pool(pool).tickBitmap(tickBitmapIndex);

        // calculate the number of populated ticks
        uint256 numberOfPopulatedTicks;
        for (uint256 i = 0; i < 256; i++) {
            if (bitmap & (1 << i) > 0) numberOfPopulatedTicks++;
        }

        // fetch populated tick data
        int24 tickSpacing = IUniswapV3Pool(pool).tickSpacing();
        populatedTicks = new PopulatedTick[](numberOfPopulatedTicks);
        for (uint256 i = 0; i < 256; i++) {
            if (bitmap & (1 << i) > 0) {
                int24 populatedTick = int24(((tickBitmapIndex << 8) + int256(i)) * tickSpacing);
                (uint128 liquidityGross, int128 liquidityNet, , ) = IUniswapV3Pool(pool).ticks(populatedTick);
                populatedTicks[--numberOfPopulatedTicks] = PopulatedTick({
                    tick: populatedTick,
                    liquidityNet: liquidityNet,
                    liquidityGross: liquidityGross
                });
            }
        }
    }
}
