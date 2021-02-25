// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import 'hardhat/console.sol';

import './BytesLib.sol';

library Path {
    uint256 internal constant ADDR_SIZE = 20;
    uint256 internal constant FEE_SIZE = 2;

    uint256 internal constant LENGTH_SIZE = 1;
    uint256 internal constant POP_OFFSET = ADDR_SIZE + FEE_SIZE + ADDR_SIZE;
    uint256 internal constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

    using BytesLib for bytes;

    // decodes a single element
    function decode(bytes memory path)
        internal
        pure
        returns (
            address token0,
            address token1,
            uint24 fee
        )
    {
        token0 = path.toAddress(0);
        fee = uint24(path.toUint16(ADDR_SIZE));
        token1 = path.toAddress(ADDR_SIZE + FEE_SIZE);
    }

    function pop(bytes memory path) internal pure returns (bytes memory popped, bytes memory rest) {
        // slice the first element: token0, fee, token1
        popped = path.slice(LENGTH_SIZE, POP_OFFSET);
        // get the rest of the buffer with 1 extra leading byte from the previous
        // element for the length
        rest = path.slice(NEXT_OFFSET, path.length - NEXT_OFFSET);
        // subtract 1 from the array length
        bytes1 length = bytes1(uint8(path.slice(0, 1)[0]) - 1);
        rest[0] = length;
    }
}
