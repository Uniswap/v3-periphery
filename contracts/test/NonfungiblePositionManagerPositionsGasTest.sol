// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../NonfungiblePositionManager.sol';

contract NonfungiblePositionManagerPositionsGasTest {
    NonfungiblePositionManager immutable nonfungiblePositionManager;

    constructor(NonfungiblePositionManager _nonfungiblePositionManager) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    function getGasCostOfPositions(uint256 tokenId) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        nonfungiblePositionManager.positions(tokenId);
        return gasBefore - gasleft();
    }
}
