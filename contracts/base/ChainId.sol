// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

/// @title Function for getting the chainid
/// @dev Base contract that is overridden for tests
abstract contract ChainId {
    /// @dev Method that exists purely to be overridden for tests
    /// @return id The chainid
    function _chainid() internal view virtual returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }
}
