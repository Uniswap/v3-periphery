// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Interface for permit
/// @notice Interface used by DAI/CHAI for permit
interface IERC20PermitAllowed {
    /// @notice Approve the spender to spend some tokens via the holder signature
    /// @dev This is the permit interface used by DAI and CHAI
    /// @param holder the address of the token holder, the token owner
    /// @param spender the address of the token spender
    /// @param nonce the holder's nonce, increases at each call to permit
    /// @param expiry the timestamp at which the permit is no longer valid
    /// @param allowed boolean that sets approval, either 0 or unit(-1)
    /// @param v must produce valid secp256k1 signature from the holder along with `r` and `s`
    /// @param r must produce valid secp256k1 signature from the holder along with `v` and `s`
    /// @param s must produce valid secp256k1 signature from the holder along with `r` and `v`
    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
