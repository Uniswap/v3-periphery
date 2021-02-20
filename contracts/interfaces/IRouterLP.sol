// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import {IUniswapV3MintCallback} from '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3MintCallback.sol';

interface IRouterLP is IUniswapV3MintCallback {
    // If amountADesired is 0 -> single sided with tokenB
    // If amountBDesired is 0 -> single sided with tokenA
    // Check that the liquidity shares received convert to amountAMin and amountBMin
    // after the state transition is done
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
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        );

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
    ) external returns (uint256 amountA, uint256 amountB);

    // TODO: Add ETH, Permits, Fee on Transfer
}
