// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

abstract contract BlockTimestamp {
    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
