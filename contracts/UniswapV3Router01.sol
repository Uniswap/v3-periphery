// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './RouterImmutableState.sol';
import './RouterPositions.sol';
import './NonfungiblePositionManager.sol';

/// @title Uniswap V3 Router
/// @notice Router for interacting with Uniswap V3 core contracts
contract UniswapV3Router01 is RouterImmutableState, NonfungiblePositionManager {
    constructor(address _factory, address _WETH) RouterImmutableState(_factory, _WETH) {}
}
