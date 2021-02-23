// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterPositions.sol';

/// @title Logic for positions
abstract contract RouterPositions is IRouterImmutableState, IRouterPositions {
    /// @inheritdoc IRouterPositions
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMax,
        uint256 amountBMax,
        address recipient,
        uint256 deadline
    ) external override {
        // todo: compute address via create2
        IUniswapV3Pool pool = IUniswapV3Pool(IUniswapV3Factory(this.factory()).getPool(tokenA, tokenB, fee));

        pool.mint(msg.sender, tickLower, tickUpper, 1, abi.encode(msg.sender, amountAMax, amountBMax));
    }

    /// @inheritdoc IUniswapV3MintCallback
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        revert('TODO');
    }

    /// @inheritdoc IRouterPositions
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
    ) external override {
        revert('TODO');
    }
}
