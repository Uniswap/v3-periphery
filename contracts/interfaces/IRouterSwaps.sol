// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
interface IRouterSwaps is IUniswapV3SwapCallback {
    struct swapForExactParams {
        bytes path;
        uint256 maxAmountIn;
        uint256 amountOut;
        address recipient;
        uint256 deadline;
    }

    /// @notice Swaps as little as possible of one token for an exact amount of another
    function swapTokensForExactTokens(swapForExactParams calldata params) external;

    struct swapExactForParams {
        bytes path;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
    }

    /// @notice Swaps an exact amount of one token for as little as possible of another
    function swapExactTokensForTokens(swapExactForParams calldata params) external;
}
