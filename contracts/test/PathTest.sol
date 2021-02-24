// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Path.sol';

contract PathTest {
    function decode(bytes memory path) public pure returns (address token0, address token1, uint24 fee) {
        return Path.decode(path);
    }
}
