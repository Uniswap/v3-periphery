// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V3
interface IRouterSwaps is IUniswapV3SwapCallback {
    struct SwapParams {
        bytes path;
        uint256 amount; // in/out depending on exactInput/exactOutput
        uint256 amountSlippage; // min amount out/max amount in
        address recipient;
        uint256 deadline;
    }

    /// @notice Swaps an exact amount of one token for as much as possible of another
    function exactInput(SwapParams calldata) external;

    /// @notice Swaps as little as possible of one token for an exact amount of another
    function exactOutput(SwapParams calldata) external;
}
