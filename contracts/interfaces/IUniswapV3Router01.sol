// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import './IRouterPositions.sol';
import './IRouterSwaps.sol';
import './IRouterImmutableState.sol';

interface IUniswapV3Router is IRouterImmutableState, IRouterSwaps, IRouterPositions {}
