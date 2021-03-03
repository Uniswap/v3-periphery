// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '../interfaces/INonfungiblePositionManager.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the base64 decoded data URI
library NonfungibleTokenPositionDescriptor {
    function tokenURI(address positionManager, uint256 tokenId) public view returns (string memory) {
        (, address token0, address token1, uint24 fee, , , , , , , ) =
            INonfungiblePositionManager(positionManager).positions(tokenId);

        require(token0 != address(0), 'Invalid token ID');

        // todo: compute name and description from details about the position
        string memory name = 'ABC';
        string memory description = 'XYZ';

        return
            string(abi.encodePacked('data:application/json,{"name":"', name, '", "description":"', description, '"}'));
    }
}
