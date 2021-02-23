// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/INonfungiblePositionManager.sol';
import './RouterPositions.sol';

abstract contract NonfungiblePositionManager is INonfungiblePositionManager, RouterPositions {
    /// @inheritdoc IERC721Metadata
    string public constant override name = 'Uniswap V3 Positions';
    /// @inheritdoc IERC721Metadata
    string public constant override symbol = 'UNI-V3-P';

    /// @inheritdoc IERC721Metadata
    function tokenURI(uint256 _tokenId) external view override returns (string memory) {
        return string(abi.encode('data:text/plain,'));
    }
}
