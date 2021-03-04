// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './RouterImmutableState.sol';
import './Multicall.sol';
import './ETHConnector.sol';
import './SelfPermit.sol';
import './RouterPositions.sol';
import './RouterSwaps.sol';

/// @title Uniswap V3 Router
/// @notice Router for interacting with Uniswap V3 core contracts
contract UniswapV3Router01 is RouterImmutableState, Multicall, ETHConnector, SelfPermit, RouterPositions, RouterSwaps {
    constructor(
        address _factory,
        address _WETH9,
        address _WETH10
    ) RouterImmutableState(_factory, _WETH9, _WETH10) {}
}
