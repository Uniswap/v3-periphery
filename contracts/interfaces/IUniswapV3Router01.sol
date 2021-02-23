// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import './IRouterPositions.sol';
import './IRouterTokenSwaps.sol';
import './IRouterImmutableState.sol';

interface IUniswapV3Router is IRouterImmutableState, IRouterTokenSwaps, IRouterPositions {}
