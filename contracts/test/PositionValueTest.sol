// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/PositionValue.sol';
import '../interfaces/INonfungiblePositionManager.sol';

contract PositionValueTest {
    function principal(INonfungiblePositionManager nft, uint256 tokenId)
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {
        return PositionValue.principal(nft, tokenId);
    }
}
