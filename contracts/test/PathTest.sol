// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Path.sol';

contract PathTest {
    function decode(bytes memory path) public pure returns (address token0, address token1, uint24 fee) {
        return Path.decode(path);
    }

    function pop(bytes memory path) public pure returns (bytes memory popped, bytes memory rest) {
        return Path.pop(path);
    }

    function getGasCostOfDecode(bytes memory path) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        Path.decode(path);
        return gasBefore - gasleft();
    }

    function getGasCostOfPop(bytes memory path) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        Path.pop(path);
        return gasBefore - gasleft();
    }
}
