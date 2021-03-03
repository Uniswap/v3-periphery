// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '../interfaces/INonfungiblePositionManager.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the base64 decoded data URI
library NonfungibleTokenPositionDescriptor {
    function tokenURI(address positionManager, uint256 tokenId) public view returns (string memory) {
        (, address token0, address token1, uint24 fee, , , , , , , ) =
            INonfungiblePositionManager(positionManager).positions(tokenId);
        return 'data:application/json;base64,<data>';
    }
}
