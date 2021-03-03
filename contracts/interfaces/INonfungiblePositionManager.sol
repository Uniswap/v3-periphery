// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol';
import './IERC721Permit.sol';

/// @title Non-fungible token for positions
/// @notice Wraps Uniswap V3 positions in a non-fungible token interface which allows for them to be transferred
/// and authorized.
interface INonfungiblePositionManager is IERC721Metadata, IERC721Enumerable, IERC721Permit {
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
    /// @dev Call this when the pool does not exist to create it and initialize the pool before minting
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
    /// @dev Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
    /// a method does not exist, i.e. the pool is assumed to be initialized.
    function mint(MintParams calldata params)
        external
        returns (
            uint256 tokenId,
            uint256 amount0,
            uint256 amount1
        );

    /// @notice Increases the amount of liquidity in a position, with tokens paid by the `msg.sender`
    /// @param tokenId The ID of the token for which liquidity is being increased
    /// @param amount The amount by which liquidity will be increased
    /// @param amount0Max The maximum amount of token0 that should be paid to
    /// @param amount1Max The maximum amount of token1 that should be
    /// @param deadline The time by which the transaction must be included to effect the change
    function increaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 deadline
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Decreases the amount of liquidity in a position and accounts it to the position
    /// @param tokenId The ID of the token for which liquidity is being decreased
    /// @param amount The amount by which liquidity will be decreased
    /// @param amount0Min The minimum amount of token0 that should be received in the burn
    /// @param amount1Min The minimum amount of token1 that should be received in the burn
    function decreaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Collects up to a maximum amount of fees owed to a specific position to the recipient
    /// @param tokenId The ID of the NFT for which tokens are being collected
    /// @param amount0Max The maximum amount of token0 to collect
    /// @param amount1Max The maximum amount of token1 to collect
    /// @param recipient The account that should receive the tokens
    function collect(
        uint256 tokenId,
        address recipient,
        uint128 amount0Max,
        uint128 amount1Max
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
    /// must be collected first.
    /// @param tokenId The ID of the token that is being burned
    function burn(uint256 tokenId) external;
}
