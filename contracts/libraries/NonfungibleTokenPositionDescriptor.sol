// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '../interfaces/INonfungiblePositionManager.sol';
import './PoolAddress.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
library NonfungibleTokenPositionDescriptor {
    /// @dev Produces the URI for metadata about a specific token by fetching the data from relative contracts
    function tokenURI(address positionManager, uint256 tokenId) public view returns (string memory) {
        (, , address token0, address token1, uint24 fee, , , , , , , ) =
            INonfungiblePositionManager(positionManager).positions(tokenId);

        require(token0 != address(0), 'Invalid token ID');

        IUniswapV3Pool pool =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    INonfungiblePositionManager(positionManager).factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            );

        // todo: compute name and description from details about the position and the pool
        string memory name = 'Uniswap V3 Position';
        string memory description = 'Represents a position in Uniswap V3.';

        return
            string(abi.encodePacked('data:application/json,{"name":"', name, '", "description":"', description, '"}'));
    }
}
