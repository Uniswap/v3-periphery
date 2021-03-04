// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IETHConnector.sol';
import './interfaces/IRouterImmutableState.sol';
import './interfaces/external/IWETH9.sol';

import './libraries/TransferHelper.sol';

abstract contract ETHConnector is IETHConnector, IRouterImmutableState {
    modifier noRemainingETH() {
        _;
        if (msg.value > 0) require(address(this).balance == 0, 'ETH balance remains');
    }

    /// @inheritdoc IETHConnector
    function unwrapWETH9(address recipient) external override payable noRemainingETH {
        uint256 balance = IWETH9(this.WETH9()).balanceOf(address(this));
        if (balance > 0) IWETH9(this.WETH9()).withdraw(balance);
        TransferHelper.safeTransferETH(recipient, address(this).balance);
    }

    receive() external payable {
        require(msg.sender == this.WETH9(), 'NW');
    }
}
