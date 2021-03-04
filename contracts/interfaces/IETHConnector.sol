// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

/// @title ETHConnector
/// @notice Allows deposits and withdrawals of ETH
interface IETHConnector {
    /// @notice Unwraps the contract's WETH9 balance and sends it to recipient as ETH.
    function unwrapWETH9(address recipient) external payable;

    /// @notice Unwraps the contract's WETH10 balance and sends it to recipient as ETH.
    function unwrapWETH10(address payable recipient) external payable;
}
