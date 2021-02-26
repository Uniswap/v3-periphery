// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Path.sol';

contract PathTest {
    function decode(bytes memory path)
        public
        pure
        returns (
            address token0,
            address token1,
            uint24 fee
        )
    {
        return Path.decode(path);
    }

    function hasPairs(bytes memory path) public pure returns (bool) {
        return Path.hasPairs(path);
    }

    function peekPool(bytes memory path, address factory) public pure returns (address) {
        return Path.peekPool(path, factory);
    }

    function get(bytes memory path, uint256 i) public pure returns (bytes memory) {
        return Path.get(path, i);
    }

    function skip(bytes memory path, uint256 i) public pure returns (bytes memory) {
        return Path.skip(path, i);
    }

    // gas funcs
    function getGasCostOfDecode(bytes memory path) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        Path.decode(path);
        return gasBefore - gasleft();
    }
}
