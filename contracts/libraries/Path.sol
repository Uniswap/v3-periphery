// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import './BytesLib.sol';
import './PoolAddress.sol';

library Path {
    using BytesLib for bytes;

    uint256 private constant ADDR_SIZE = 20;
    uint256 private constant FEE_SIZE = 3;

    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;
    uint256 private constant POP_OFFSET = NEXT_OFFSET + ADDR_SIZE;

    // checks if the path contains more than one pair
    function hasPairs(bytes memory path) internal pure returns (bool) {
        return path.length > POP_OFFSET;
    }

    // decodes the first pair in path
    function decode(bytes memory path)
        internal
        pure
        returns (
            address tokenA,
            address tokenB,
            uint24 fee
        )
    {
        tokenA = path.toAddress(0);
        fee = path.toUint24(ADDR_SIZE);
        tokenB = path.toAddress(NEXT_OFFSET);
    }

    // skips a token/fee elements from the buffer and return the remainder
    function skipOne(bytes memory path) internal pure returns (bytes memory rest) {
        rest = path.slice(NEXT_OFFSET, path.length - NEXT_OFFSET);
    }
}
