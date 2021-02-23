// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './interfaces/IRouterImmutableState.sol';

/// @title Router immutable state
/// @notice Immutable state that the router needs
contract RouterImmutableState is IRouterImmutableState {
    /// @inheritdoc IRouterImmutableState
    address public immutable override factory;
    /// @inheritdoc IRouterImmutableState
    address public immutable override WETH;

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }
}
