// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
interface IRouterSwaps is IUniswapV3SwapCallback {
    /// @notice Swaps the exact amount of one token for the minimum amount of another
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32[] calldata path,
        address recipient,
        uint256 deadline
    ) external;

    /// @notice Swaps a maximum amount of one token for an exact amount another
    function swapTokensForExactTokens(
        uint256 maxAmountIn,
        uint256 amountOut,
        bytes32[] calldata path,
        address recipient,
        uint256 deadline
    ) external;
}
