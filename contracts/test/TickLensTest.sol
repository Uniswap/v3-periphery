// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '../lens/TickLens.sol';

/// @title Tick Lens contract
contract TickLensTest is TickLens {
    function getGasCostOfGetPopulatedTicksInWord(address pool, int16 tickBitmapIndex) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        getPopulatedTicksInWord(pool, tickBitmapIndex);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetPopulatedTicksInPartialWord(
        address pool,
        int16 tickBitmapIndex,
        uint256 wordStart,
        uint256 wordEnd
    ) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        getPopulatedTicksInPartialWord(pool, tickBitmapIndex, wordStart, wordEnd);
        return gasBefore - gasleft();
    }
}
