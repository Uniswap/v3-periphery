// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import {IUniswapV3SwapCallback} from '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

interface IRouterTokenSwaps is IUniswapV3SwapCallback {
    function swapExactTokensForTokens(
        uint256 amount0In,
        uint160 sqrtPriceLimitX96,
        bytes32[] calldata path, // TODO: Change this to a bytes buffer and just slice it?
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amount1Out,
        uint160 sqrtPriceLimitX96,
        bytes32[] calldata path,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    // TODO: Add ETH, Permits, Fee on Transfer
}
