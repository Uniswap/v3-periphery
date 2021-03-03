// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

/// @title Multicall
/// @notice Allows making multiple calls of functions in the same contract in a single transaction
interface IMulticall {
    function multicall(bytes[] calldata data) external returns (bytes[] memory results);
}
