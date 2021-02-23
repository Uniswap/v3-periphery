// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

import './interfaces/IUniswapV3Router01.sol';
import './interfaces/IWETH.sol';

/// @title Uniswap V3 Router
/// @notice Router for interacting with Uniswap V3 core contracts
contract UniswapV3Router01 is IRouterImmutableState {
    /// @inheritdoc IRouterImmutableState
    address public immutable override factory;
    /// @inheritdoc IRouterImmutableState
    address public immutable override WETH;

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }
}
