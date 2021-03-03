// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import './WETH10.sol';

contract TestERC20WithPermit is WETH10 {
    function deposit(uint256 amountToMint) internal {
        // _mintTo(msg.sender, msg.value);
        balanceOf[msg.sender] += amountToMint;
        emit Transfer(address(0), msg.sender, amountToMint);
    }

    constructor(uint256 amountToMint) {
        deposit(amountToMint);
    }
}