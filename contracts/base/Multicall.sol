// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IMulticall.sol';

/// @title Multicall
/// @notice Enables calling multiple methods in a single call to the contract
abstract contract Multicall is IMulticall {
    /// @inheritdoc IMulticall
    function multicall(bytes[] calldata data) public payable override returns (bytes[] memory results) {
        uint256 len = data.length;
        results = new bytes[](len);
        for (uint256 i = 0; i < len; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);

            if (!success) {
                // Next 5 lines from https://ethereum.stackexchange.com/a/83577
                if (result.length < 68) revert();
                assembly {
                    result := add(result, 0x04)
                }
                revert(abi.decode(result, (string)));
            }

            results[i] = result;
        }
    }
}
