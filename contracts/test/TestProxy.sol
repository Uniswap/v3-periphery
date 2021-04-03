// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol';
import '@openzeppelin/contracts/proxy/ProxyAdmin.sol';

abstract contract TestProxy is TransparentUpgradeableProxy {}
