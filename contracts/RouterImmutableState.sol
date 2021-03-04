// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './interfaces/IRouterImmutableState.sol';

/// @title Router immutable state
/// @notice Immutable state that the router needs
contract RouterImmutableState is IRouterImmutableState {
    /// @inheritdoc IRouterImmutableState
    address public immutable override factory;
    /// @inheritdoc IRouterImmutableState
    address public immutable override WETH9;
    /// @inheritdoc IRouterImmutableState
    address public immutable override WETH10;

    constructor(
        address _factory,
        address _WETH9,
        address _WETH10
    ) {
        factory = _factory;
        WETH9 = _WETH9;
        WETH10 = _WETH10;
    }
}
