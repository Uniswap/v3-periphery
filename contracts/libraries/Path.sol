// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import 'hardhat/console.sol';

import './BytesLib.sol';
import './PoolAddress.sol';

library Path {
    uint256 internal constant ADDR_SIZE = 20;
    uint256 internal constant FEE_SIZE = 2;

    uint256 internal constant POP_OFFSET = ADDR_SIZE + FEE_SIZE + ADDR_SIZE;
    uint256 internal constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

    using BytesLib for bytes;

    // checks if the path has enough data in it to construct a pair
    function hasPairs(bytes memory path) internal pure returns (bool) {
        return path.length > POP_OFFSET;
    }

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

    function peekPool(bytes memory path, address factory) internal pure returns (address) {
        (address token0, address token1, uint24 fee) = decode(path);
        PoolAddress.PoolKey memory key = PoolAddress.PoolKey({tokenA: token0, tokenB: token1, fee: fee});
        return PoolAddress.computeAddress(factory, key);
    }

    function get(bytes memory path, uint256 i) internal pure returns (bytes memory el) {
        el = path.slice(i * NEXT_OFFSET, POP_OFFSET);
    }

    // skips `i` items from the buffer and return the remaining bufer
    function skip(bytes memory path, uint256 i) internal pure returns (bytes memory rest) {
        rest = path.slice(i * NEXT_OFFSET, path.length - i * NEXT_OFFSET);
    }
}
