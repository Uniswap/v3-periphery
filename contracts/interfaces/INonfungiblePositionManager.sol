// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol';

/// @title Non-fungible position manager
/// @notice Non-fungible token wrapper for Uniswap V3 Positions
interface INonfungiblePositionManager is IERC721Metadata, IERC721Enumerable {
    /// @notice Returns the position information associated with a given token ID.
    /// @param _tokenId The ID of the token that represents the position
    function positions(uint256 _tokenId)
        external
        view
        returns (
            address owner,
            address operator,
            address pool,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 feesOwed0,
            uint128 feesOwed1
        );
}
