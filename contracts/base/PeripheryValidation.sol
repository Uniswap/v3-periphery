// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import './BlockTimestamp.sol';

abstract contract PeripheryValidation is BlockTimestamp {
    modifier checkDeadline(uint256 deadline) {
        require(_blockTimestamp() <= deadline, 'Transaction too old');
        _;
    }
}
