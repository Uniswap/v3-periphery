// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../UniswapV3Router01.sol';

contract MockTimeUniswapV3Router01 is UniswapV3Router01 {
    uint256 time;

    constructor(address _factory, address _WETH) UniswapV3Router01(_factory, _WETH) {}

    function _blockTimestamp() internal view override returns (uint256) {
        return time;
    }

    function setTime(uint256 _time) external {
        time = _time;
    }
}
