// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../SwapRouter.sol';

contract MockTimeSwapRouter is SwapRouter, RouterPositions {
    uint256 time;

    constructor(
        address _factory,
        address _WETH9,
        address _WETH10
    ) SwapRouter(_factory, _WETH9, _WETH10) {}

    function _blockTimestamp() internal view override returns (uint256) {
        return time;
    }

    function setTime(uint256 _time) external {
        time = _time;
    }
}
