// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol';

/// @title Router token position management
/// @notice Functions for managing positions in Uniswap V3
interface IRouterPositions is IUniswapV3MintCallback {
    struct CreatePairAndAddLiquidityParams {
        address tokenA;
        address tokenB;
        uint24 fee;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount;
    }

    /// @notice Called for the first add liquidity of a pair
    function createPairAndAddLiquidity(CreatePairAndAddLiquidityParams calldata params) external;

    struct AddLiquidityParams {
        address tokenA;
        address tokenB;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount;
        uint256 amountAMax;
        uint256 amountBMax;
        address recipient;
        uint256 deadline;
    }

    /// @notice Add liquidity for the pair
    function addLiquidity(AddLiquidityParams calldata params) external;

    struct RemoveLiquidityParams {
        address tokenA;
        address tokenB;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount;
        uint256 amountAMin;
        uint256 amountBMin;
        address recipient;
        uint256 deadline;
    }

    /// @notice Remove liquidity to a given position
    function removeLiquidity(RemoveLiquidityParams calldata params) external;
}
