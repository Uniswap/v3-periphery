// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;

import '../interfaces/IPeripheryPayments.sol';
import '../interfaces/external/IWETH9.sol';
import '../interfaces/external/IWETH10.sol';

import '../libraries/TransferHelper.sol';

import './PeripheryImmutableState.sol';

abstract contract PeripheryPayments is IPeripheryPayments, PeripheryImmutableState {
    receive() external payable {
        require(msg.sender == WETH9 || msg.sender == WETH10, 'Not WETH9 or WETH10');
    }

    /// @inheritdoc IPeripheryPayments
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable override {
        uint256 balanceWETH9 = IWETH9(WETH9).balanceOf(address(this));
        if (amountMinimum > 0) require(balanceWETH9 >= amountMinimum, 'Insufficient WETH9');

        if (balanceWETH9 > 0) {
            IWETH9(WETH9).withdraw(balanceWETH9);
            TransferHelper.safeTransferETH(recipient, balanceWETH9);
        }
    }

    /// @inheritdoc IPeripheryPayments
    function unwrapWETH10(uint256 amountMinimum, address payable recipient) external payable override {
        uint256 balanceWETH10 = IWETH10(WETH10).balanceOf(address(this));
        if (amountMinimum > 0) require(balanceWETH10 >= amountMinimum, 'Insufficient WETH10');

        if (balanceWETH10 > 0) IWETH10(WETH10).withdrawTo(recipient, balanceWETH10);
    }

    /// @param token The token to pay
    /// @param payer The entity that must pay
    /// @param recipient The entity that will receive payment
    /// @param value The amount to pay
    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        uint256 selfBalance;
        if (token == WETH9 && (selfBalance = address(this).balance) >= value) {
            // pay with WETH9 generated from ETH
            IWETH9(WETH9).deposit{value: selfBalance}(); // wrap whole balance
            IWETH9(WETH9).transfer(recipient, value);
        } else if (token == WETH10 && (selfBalance = address(this).balance) >= value) {
            // pay with WETH10 generated from ETH
            IWETH10(WETH10).depositTo{value: value}(recipient);
            if (selfBalance > value) IWETH10(WETH10).deposit{value: selfBalance - value}(); // wrap whole balance
        } else if (payer == address(this)) {
            // pay with tokens already in the contract
            if (recipient != address(this)) TransferHelper.safeTransfer(token, recipient, value);
        } else {
            // pull payment from the payer
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }
}
