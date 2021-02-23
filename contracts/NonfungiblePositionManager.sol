// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './interfaces/IRouterImmutableState.sol';
import './RouterValidation.sol';
import './interfaces/INonfungiblePositionManager.sol';

abstract contract NonfungiblePositionManager is IRouterImmutableState, INonfungiblePositionManager, RouterValidation {}
