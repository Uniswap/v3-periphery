// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import './IRouterPositions.sol';
import './IRouterSwaps.sol';
import './IRouterImmutableState.sol';
import './INonfungiblePositionManager.sol';
import './IMulticall.sol';

interface IUniswapV3Router is
    IRouterImmutableState,
    IRouterSwaps,
    IRouterPositions,
    INonfungiblePositionManager,
    IMulticall
{}
