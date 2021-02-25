// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

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

    struct FirstMintParams {
        address to;
        address token0;
        address token1;
        uint24 fee;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        address recipient;
        uint256 deadline;
    }

    /// @notice Creates a new position wrapped in a NFT for the first time for a given token0/token1/fee
    function firstMint(FirstMintParams calldata params) external returns (uint256 tokenId);

    struct MintParams {
        address to;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 amount0Max;
        uint256 amount1Max;
        address recipient;
        uint256 deadline;
    }

    /// @notice Creates a new position wrapped in a NFT
    function mint(MintParams calldata params) external returns (uint256 tokenId);
}
