// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterPositions.sol';

/// @title Logic for positions
abstract contract RouterPositions is IRouterImmutableState, IRouterPositions {
    /// @inheritdoc IRouterPositions
    function createPairAndAddLiquidity(CreatePairAndAddLiquidityParams calldata params) external override {
        revert('TODO');
    }

    /// @inheritdoc IRouterPositions
    function addLiquidity(AddLiquidityParams calldata params) external override {
        // todo: compute address via create2
        IUniswapV3Pool pool =
            IUniswapV3Pool(IUniswapV3Factory(this.factory()).getPool(params.tokenA, params.tokenB, params.fee));

        pool.mint(
            params.recipient,
            params.tickLower,
            params.tickUpper,
            params.amount,
            abi.encode(msg.sender, params.amountAMax, params.amountBMax)
        );

        revert('TODO');
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
    function removeLiquidity(RemoveLiquidityParams calldata params) external override {
        revert('TODO');
    }
}
