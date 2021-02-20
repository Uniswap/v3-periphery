// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

import {IRouterLP} from './IRouterLP.sol';
import {IRouterTokenSwaps} from './IRouterTokenSwaps.sol';
import {IRouterBase} from './IRouterBase.sol';

interface IUniswapV3Router is IRouterBase, IRouterTokenSwaps, IRouterLP {}
