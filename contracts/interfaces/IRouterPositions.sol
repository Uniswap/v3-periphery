// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol';

/// @title Router token position management
/// @notice Functions for managing positions in Uniswap V3
interface IRouterPositions is IUniswapV3MintCallback {
    /// @notice Add liquidity to a given position
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    ) external;

    /// @notice Remove liquidity to a given position
    function removeLiquidity(
        // Params
        address tokenA,
        address tokenB,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        // Recipient
        address recipient,
        // Consistency checks
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline
    ) external;

    // TODO: Add ETH, Permits, Fee on Transfer
}
