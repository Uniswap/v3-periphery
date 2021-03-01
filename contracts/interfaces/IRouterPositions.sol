// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol';

/// @title Position management functions
/// @notice Functions for managing positions in Uniswap V3
interface IRouterPositions is IUniswapV3MintCallback {
    struct CreatePoolAndAddLiquidityParams {
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

    /// @notice Called to add liquidity for a pool that does not exist
    function createPoolAndAddLiquidity(CreatePoolAndAddLiquidityParams calldata params)
        external
        returns (uint256 amount0, uint256 amount1);

    struct AddLiquidityParams {
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

    /// @notice Add liquidity for an existing pool
    function addLiquidity(AddLiquidityParams calldata params) external returns (uint256 amount0, uint256 amount1);
}
