// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

/// @title Router immutable state
/// @notice Functions that return immutable state of the router
interface IPeripheryImmutableState {
    /// @notice Returns the address of the Uniswap V3 factory
    function factory() external view returns (address);

    /// @notice Returns the address of WETH9
    function WETH9() external view returns (address);

    /// @notice Returns the address of WETH10
    function WETH10() external view returns (address);
}
