// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './base/PeripheryImmutableState.sol';
import './base/RouterSwaps.sol';
import './base/Multicall.sol';
import './base/SelfPermit.sol';

/// @title Uniswap V3 Swap Router
/// @notice Router for stateless execution of swaps against Uniswap V3
contract SwapRouter is PeripheryImmutableState, RouterSwaps, Multicall, SelfPermit {
    constructor(
        address _factory,
        address _WETH9,
        address _WETH10
    ) PeripheryImmutableState(_factory, _WETH9, _WETH10) {}
}
