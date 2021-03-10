// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/external/IERC677.sol';
import '../interfaces/IMulticall.sol';
import './PeripheryImmutableState.sol';

/// @title ERC667 Transfer Receiver
abstract contract ERC677TransferReceiver is IERC677, PeripheryImmutableState, IMulticall {
    function onTokenTransfer(address, uint256, bytes calldata data) external override returns (bool) {
        require(msg.sender == WETH10);

        (bool success, ) = address(this).delegatecall(data);
        require(success);

        return true;
    }
}
