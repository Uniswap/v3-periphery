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
        // if the payer isn't this address, we just use transferFrom
        if (payer != address(this)) {
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        } else {
            uint256 selfBalance;
            // if the payer is this address, and we're paying in WETH{9,10}, check if we can wrap + pay
            if (token == this.WETH9() && (selfBalance = address(this).balance) >= value) {
                // wrap the contract's entire ETH balance so noRemainingETH doesn't fail
                IWETH9(this.WETH9()).deposit{value: selfBalance}();
                IWETH9(this.WETH9()).transfer(recipient, value);
            } else if (token == this.WETH10() && (selfBalance = address(this).balance) >= value) {
                if (selfBalance == value) {
                    IWETH10(this.WETH10()).depositTo{value: selfBalance}(recipient);
                } else {
                    // this ensures that ETH is not burned in the (unlikely) case when selfBalance > value
                    IWETH10(this.WETH10()).deposit{value: selfBalance}();
                    IWETH10(this.WETH10()).transfer(recipient, value);
                }
            } else {
                // otherwise, pay as this address
                TransferHelper.safeTransfer(token, recipient, value);
            }
        }
    }
}
