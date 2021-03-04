// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IETHConnector.sol';
import './interfaces/IRouterImmutableState.sol';
import './interfaces/external/IWETH9.sol';
import './interfaces/external/IWETH10.sol';

import './libraries/TransferHelper.sol';

abstract contract ETHConnector is IETHConnector, IRouterImmutableState {
    modifier noRemainingETH() {
        _;
        if (msg.value > 0) require(address(this).balance == 0, 'ETH balance remains');
    }

    /// @inheritdoc IETHConnector
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable override noRemainingETH {
        uint256 balance = IWETH9(this.WETH9()).balanceOf(address(this));
        require(balance >= amountMinimum, 'Insufficient WETH9');
        if (balance > 0) IWETH9(this.WETH9()).withdraw(balance);
        // we wrap the entire ETH balance, so there's no need to use address(this).balance
        TransferHelper.safeTransferETH(recipient, balance);
    }

    /// @inheritdoc IETHConnector
    function unwrapWETH10(uint256 amountMinimum, address payable recipient) external payable override noRemainingETH {
        uint256 balance = IWETH10(this.WETH10()).balanceOf(address(this));
        require(balance >= amountMinimum, 'Insufficient WETH10');
        if (balance > 0) IWETH10(this.WETH10()).withdrawTo(recipient, balance);
        // we wrap the entire ETH balance, so there's no need to transfer ETH directly
    }

    receive() external payable {
        require(msg.sender == this.WETH9(), 'Not WETH9');
    }
}
