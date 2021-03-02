// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol';

/// @title Non-fungible token for positions
/// @notice Wraps Uniswap V3 positions in a non-fungible token interface which allows for them to be transferred
/// and authorized.
interface INonfungiblePositionManager is IERC721Metadata, IERC721Enumerable {
    /// @notice Returns the position information associated with a given token ID.
    /// @param tokenId The ID of the token that represents the position
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint64 nonce,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    struct FirstMintParams {
        address token0;
        address token1;
        uint24 fee;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount;
        address recipient;
        uint256 deadline;
    }

    /// @notice Creates a new position wrapped in a NFT for the first time for a given token0/token1/fee
    function firstMint(FirstMintParams calldata params)
        external
        returns (
            uint256 tokenId,
            uint256 amount0,
            uint256 amount1
        );

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount;
        uint256 amount0Max;
        uint256 amount1Max;
        address recipient;
        uint256 deadline;
    }

    /// @notice Creates a new position wrapped in a NFT
    function mint(MintParams calldata params)
        external
        returns (
            uint256 tokenId,
            uint256 amount0,
            uint256 amount1
        );

    /// @notice Increases the amount of liquidity in a position, with tokens paid by the `msg.sender`
    function increaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 deadline
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Decreases the amount of liquidity in a position, keeping the fees
    /// TODO: how to support withdrawing and burning
    function decreaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Collects up to a maximum amount of fees owed to a specific position to the recipient
    function collect(
        uint256 tokenId,
        uint128 amount0Max,
        uint128 amount1Max,
        address recipient
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Exits a position by decreasing liquidity to 0, and sending all fees + tokens from liquidity to the recipient,
    /// then burns the NFT token ID.
    function exit(uint256 tokenId, address recipient) external returns (uint256 amount0, uint256 amount1);

    /// @notice Accept approval of a token via signature
    function permit(
        address owner,
        address spender,
        uint256 tokenId,
        uint256 nonce,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
