// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/drafts/IERC20Permit.sol';

/// @title Self Permit
/// @notice Functionality to call permit on any EIP-2612-compliant token for use in the route
abstract contract SelfPermit {
    /// @notice Allows users to submit `permit` signatures on their own behalf
    /// @dev The `owner` is always msg.sender, as this is a safety condition for now
    /// @dev The `spender` is always address(this)
    function selfPermit(
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        IERC20Permit(token).permit(msg.sender, address(this), value, deadline, v, r, s);
    }

    /// @notice Allows users to submit `permit` signatures on their own behalf, if their allowance is insufficient
    /// @dev The `owner` is always msg.sender, as this is a safety condition for now
    /// @dev The `spender` is always address(this)
    /// @dev Exists so calls don't fail if permits are snatched from the mempool and submitted externally (anti-grief)
    function selfPermitIfNecessary(
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (IERC20(token).allowance(msg.sender, address(this)) < value) selfPermit(token, value, deadline, v, r, s);
    }
}
