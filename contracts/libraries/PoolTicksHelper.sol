// SPDX-License-Identifier: GPL-2.0-or-later
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import "hardhat/console.sol";

pragma solidity >=0.6.0;

library PoolTicksHelper {
    function countInitializedBitsCrossed(IUniswapV3Pool self, int24 tickBefore, int24 tickAfter) internal view returns (uint32 initializedTicksCrossed) {
        // Get the key and offset in the tick bitmap of the active tick before and after the swap.
        int24 compressedBefore = tickBefore / self.tickSpacing();
        int16 wordPos = int16(compressedBefore >> 8);
        uint8 bitPos = uint8(compressedBefore % 256);

        int24 compressedAfter = tickAfter / self.tickSpacing();
        int16 wordPosAfter = int16(compressedAfter >> 8);
        uint8 bitPosAfter = uint8(compressedAfter % 256);

        // Count the number of initialized ticks crossed by iterating through the tick bitmap.
        if (wordPos < wordPosAfter || (wordPos == wordPosAfter && bitPos <= bitPosAfter)) {
            // Our first mask should include the starting tick and everything to its left.
            uint256 mask = type(uint256).max << bitPos;
            while (wordPos <= wordPosAfter) {
                // If we're on the final tick bitmap page, ensure we only count up to our
                // ending tick.
                if (wordPos == wordPosAfter) {
                    mask = mask & (type(uint256).max >> (255 - bitPosAfter));
                }
                
                uint256 masked = self.tickBitmap(wordPos) & mask;
                initializedTicksCrossed += countOneBits(masked);
                wordPos++;
                // Reset our mask so we consider all bits on the next iteration.
                mask = type(uint256).max;
            }
        } else {
            // Our first mask should include the starting tick, and everything to its right.
            uint256 mask = (type(uint256).max >> (255 - bitPos));
            while (wordPos >= wordPosAfter) {
                // If we're on the final tick bitmap page, ensure we only count up to our
                // ending tick.
                if (wordPos == wordPosAfter) {
                    mask = mask & (type(uint256).max << bitPosAfter);
                }
                
                uint256 masked = self.tickBitmap(wordPos) & mask;
                initializedTicksCrossed += countOneBits(masked);
                wordPos--;
                // Reset our mask so we consider all bits on the next iteration.
                mask = type(uint256).max;
            }
        }

        return initializedTicksCrossed;
    }

    function countOneBits(uint256 x) private pure returns (uint16) {
        uint16 bits = 0;
        while (x != 0) {    
            bits++;
            x &= (x - 1);
        }
        return bits;
    }
}