// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

/// @title Partial interface for tokens supporting EIP-2612 `permit`
/// @notice Wrapped Ether contract interface
interface IPermit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
