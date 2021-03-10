// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

interface IERC677 {
    function onTokenTransfer(
        address owner,
        uint256 value,
        bytes calldata data
    ) external returns (bool);
}
