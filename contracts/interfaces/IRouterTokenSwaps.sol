// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
interface IRouterTokenSwaps is IUniswapV3SwapCallback {
    /// @notice Swaps the exact amount of one token for the minimum amount of another
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint160 sqrtPriceLimitX96,
        bytes32[] calldata path,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /// @notice Swaps a maximum amount of one token for an exact amount another
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint160 sqrtPriceLimitX96,
        bytes32[] calldata path,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
