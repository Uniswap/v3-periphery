// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;

import './interfaces/IRouterImmutableState.sol';
import './libraries/TransferHelper.sol';
import './interfaces/external/IWETH9.sol';
import './interfaces/external/IWETH10.sol';

abstract contract RouterPayments is IRouterImmutableState {
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
        if (token == this.WETH9() && (selfBalance = address(this).balance) >= value) {
            // pay with WETH9 generated from ETH
            IWETH9(this.WETH9()).deposit{value: selfBalance}(); // wrap the entire ETH balance
            IWETH9(this.WETH9()).transfer(recipient, value);
        } else if (token == this.WETH10() && (selfBalance = address(this).balance) >= value) {
            // pay with WETH10 generated from ETH
            IWETH10(this.WETH10()).depositTo{value: value}(recipient);
            if (selfBalance > value) IWETH10(this.WETH10()).deposit{value: selfBalance - value}(); // if necessary, wrap
        } else if (payer == address(this)) {
            // pay with tokens already in the contract
            if (recipient != address(this)) TransferHelper.safeTransfer(token, recipient, value);
        } else {
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }
}
