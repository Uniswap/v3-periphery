// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import './interfaces/external/IERC2612.sol';

/// @title Self Permit
/// @notice Functionality to call permit on any EIP-2612-compliant token for use in the route
abstract contract SelfPermit {
    /// @notice The permit `owner` is always msg.sender, as this is a safety condition for now
    /// @dev The permit `owner` is always msg.sender, as this is a safety condition for now
    /// @dev The permit `spender` is always address(this)
    function selfPermit(
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IERC2612(token).permit(msg.sender, address(this), value, deadline, v, r, s);
    }
}
