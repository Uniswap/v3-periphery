// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../NonfungibleTokenPositionDescriptor.sol';

contract MockNonfungibleTokenPositionDescriptor is NonfungibleTokenPositionDescriptor {
    uint256 chainid;

    constructor(address _WETH9) NonfungibleTokenPositionDescriptor(_WETH9) {}

    function _chainid() internal view override returns (uint256) {
        return chainid;
    }

    function setChainid(uint256 _id) external {
        chainid = _id;
    }
}
