// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

/// @title Periphery validation methods
/// @notice Methods that can be bundled into a multicall to cause it to fail if certain parameters are not met
interface IPeripheryValidation {
    /// @notice Verify that this transaction is not occurring after a given deadline
    /// @param deadline The timestamp in epoch seconds before or on which the transaction's block must occur
    function checkDeadline(uint256 deadline) external view;

    /// @notice Verify that this transaction is occurring in a specific block
    /// @param previousBlockHash The hash of the block prior to the one being mined currently
    function checkPreviousBlockHash(bytes32 previousBlockHash) external view;
}
