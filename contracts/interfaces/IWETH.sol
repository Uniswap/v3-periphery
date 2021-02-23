// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

/// @title Interface for WETH
/// @notice Wrapped Ether contract interface
interface IWETH {
    /// @notice Deposit some ether to get wrapped ether
    function deposit() external payable;

    /// @notice Transfer `value` amount of wrapped ether from msg.sender to the given address `to`
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;
}
