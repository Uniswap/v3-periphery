// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import './IRouterPositions.sol';
import './IRouterSwaps.sol';
import './IPeripheryImmutableState.sol';
import './INonfungiblePositionManager.sol';
import './IMulticall.sol';

interface IUniswapV3Router is
    IPeripheryImmutableState,
    IRouterSwaps,
    IRouterPositions,
    INonfungiblePositionManager,
    IMulticall
{}
