// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

/// @title Router immutable state
/// @notice Functions that return immutable state of the router
interface IRouterImmutableState {
    /// @notice Returns the address of the Uniswap V3 factory
    function factory() external view returns (address);

    /// @notice Returns the address of the WETH contract used for wrapping ETH for use with Uniswap V3
    function WETH() external view returns (address);
}
