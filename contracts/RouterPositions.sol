// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterPositions.sol';

abstract contract RouterPositions is IRouterImmutableState, IRouterPositions {
    /// @inheritdoc IRouterPositions
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address recipient,
        uint256 deadline
    )
        external
        override
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        revert('TODO');
    }

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
        uint256 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        // Recipient
        address recipient,
        // Consistency checks
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline
    ) external override returns (uint256 amountA, uint256 amountB) {
        revert('TODO');
    }
}
