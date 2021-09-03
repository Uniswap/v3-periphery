// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './SwapRouter.sol';
import './UniswapV2SwapRouter.sol';

/// @title Uniswap Swap Router version 2
/// @notice Router for stateless execution of swaps against Uniswap V3 or Uniswap V2
contract SwapRouterV2 is SwapRouter, UniswapV2SwapRouter {
    constructor(
        address _factory,
        address _v2Factory,
        address _WETH9
    ) SwapRouter(_factory, _WETH9) UniswapV2SwapRouter(_v2Factory, _WETH9) {}
}
