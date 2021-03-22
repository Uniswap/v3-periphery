// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './libraries/PoolAddress.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor {
    /// @inheritdoc INonfungibleTokenPositionDescriptor
    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        (, , uint80 poolId, , , , , , , ) = positionManager.positions(tokenId);

        require(poolId != 0, 'Invalid token ID');

        (address token0, address token1, uint24 fee) = positionManager.poolIdToPoolKey(poolId);

        address factory = positionManager.factory();

        IUniswapV3Pool pool =
            IUniswapV3Pool(
                PoolAddress.computeAddress(factory, PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee}))
            );

        // todo: compute name and description from details about the position and the pool
        string memory name = 'Uniswap V3 Position';
        string memory description = 'Represents a position in Uniswap V3.';

        return
            string(abi.encodePacked('data:application/json,{"name":"', name, '", "description":"', description, '"}'));
    }
}
