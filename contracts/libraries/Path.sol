// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

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
    function decodeFirstPair(bytes memory path, address factory)
        internal
        pure
        returns (
            address tokenA,
            address tokenB,
            address pool
        )
    {
        tokenA = path.toAddress(0);
        uint24 fee = path.toUint24(ADDR_SIZE);
        tokenB = path.toAddress(NEXT_OFFSET);
        pool = PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, fee));
    }

    // gets the segment corresponding to the first pool in the path
    function getFirstPair(bytes memory path) internal pure returns (bytes memory) {
        return path.slice(0, POP_OFFSET);
    }

    // skips a token + fee element from the buffer and returns the remainder
    function skipToken(bytes memory path) internal pure returns (bytes memory) {
        return path.slice(NEXT_OFFSET, path.length - NEXT_OFFSET);
    }
}
