// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;

/// @title Periphery Payments
/// @notice Functions to ease deposits and withdrawals of ETH
interface IPeripheryPayments {
    /// @notice Unwraps the contract's WETH9 balance and sends it to recipient as ETH.
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing WETH9 from users.
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;

    /// @notice Unwraps the contract's WETH10 balance and sends it to recipient as ETH.
    /// @dev The amountMinimum parameter prevents malicious contracts from calling back into the router mid swap and stealing WETH10 from users.
    function unwrapWETH10(uint256 amountMinimum, address payable recipient) external payable;

    /// @notice Sends the full amount of a token held by this contract to the given recipient
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing the token from users
    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable;
}
