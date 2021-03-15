// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/// @title Tick Lens contract
contract TickLens {
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = -MIN_TICK;

    struct TickInfo {
        int24 tick;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    function getPopulatedTicks(
        address pool,
        int24 tickLower,
        int24 tickUpper
    ) external view returns (TickInfo[] memory ticks) {
        require(tickLower < tickUpper);

        int24 tickSpacing = IUniswapV3Pool(pool).tickSpacing();

        int16 indexLower = int16((tickLower / tickSpacing) >> 8);
        int16 indexUpper = int16((tickUpper / tickSpacing) >> 8);

        uint256 numberOfBitmaps = uint256(int256(indexUpper) - indexLower + 1);
        uint256[] memory bitmaps = new uint256[](numberOfBitmaps);

        // fetch all bitmaps
        for (int256 i = indexLower; i <= indexUpper; i++) {
            bitmaps[uint256(i - indexLower)] = IUniswapV3Pool(pool).tickBitmap(int16(i));
        }

        // fetch the number of populated ticks
        uint256 numberOfPopulatedTicks;
        for (uint256 i = 0; i < numberOfBitmaps; i++) {
            uint256 bitmap = bitmaps[i];
            for (uint256 j = 0; j < 256; j++) {
                if (bitmap & (1 << j) > 0) numberOfPopulatedTicks++;
            }
        }

        // return populated ticks
        ticks = new TickInfo[](numberOfPopulatedTicks);
        for (int256 i = indexLower; i <= indexUpper; i++) {
            uint256 bitmap = bitmaps[uint256(i - indexLower)];
            for (uint256 j = 0; j < 256; j++) {
                if (bitmap & (1 << j) > 0) {
                    int24 tick = int24(((i << 8) + int256(j)) * tickSpacing);
                    (uint128 liquidityGross, int128 liquidityNet, , ) = IUniswapV3Pool(pool).ticks(tick);
                    ticks[--numberOfPopulatedTicks] = TickInfo({
                        tick: tick,
                        liquidityNet: liquidityNet,
                        liquidityGross: liquidityGross
                    });
                }
            }
        }
    }
}
