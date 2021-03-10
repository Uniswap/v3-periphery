// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title IERC20Metadata
/// @notice Extension to IERC20 that includes token metadata
interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);
}
