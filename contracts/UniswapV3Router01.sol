// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './interfaces/IUniswapV3Router01.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

/// @title Uniswap V3 Router
/// @notice Router for interacting with Uniswap V3 core contracts
abstract contract UniswapV3Router01 is IUniswapV3Router {
    /// @inheritdoc IRouterImmutableState
    address public immutable override factory;
    /// @inheritdoc IRouterImmutableState
    address public immutable override WETH;

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }
}
