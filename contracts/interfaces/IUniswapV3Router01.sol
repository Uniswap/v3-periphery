// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import './IRouterPositions.sol';
import './IRouterSwaps.sol';
import './IRouterImmutableState.sol';

interface IUniswapV3Router is IRouterImmutableState, IRouterSwaps, IRouterPositions {}
