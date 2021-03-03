// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import './IMulticall.sol';

/// @title ETHConnector
/// @notice Allows deposits and withdrawals of ETH
interface IETHConnector is IMulticall {
    function depositETHAndMulticall(bytes[] calldata data) external payable returns (bytes[] memory results);

    /// @notice Sends contract ETH balance to recipient.
    /// @dev Can be used to send dust ETH back to users who weren't required to use all of their slippage tolerance.
    function sweepETH(address recipient) external;

    /// @notice Unwraps contract WETH balance and sends to recipient as ETH.
    /// @dev Can be used to unwrap WETH at the end of a multicall and send it as ETH back to users.
    function unwrapAndWithdrawETH(address recipient) external;
}
