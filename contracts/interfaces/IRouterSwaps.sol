// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
interface IRouterSwaps is IUniswapV3SwapCallback {
    struct ExactInputParams {
        bytes path;
        uint256 amountIn;
        uint256 amountOutMinimum;
        address recipient;
        uint256 deadline;
    }

    struct ExactOutputParams {
        bytes path;
        uint256 amountOut;
        uint256 amountInMaximum;
        address recipient;
        uint256 deadline;
    }

    /// @notice Swaps an exact amount of one token for as much as possible of another
    function exactInput(ExactInputParams calldata) external;

    /// @notice Swaps as little as possible of one token for an exact amount of another
    function exactOutput(ExactOutputParams calldata) external;
}
