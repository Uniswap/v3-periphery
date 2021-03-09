// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Path.sol';

contract PathTest {
    function hasPairs(bytes memory path) public pure returns (bool) {
        return Path.hasPairs(path);
    }

    function decodeFirstPair(bytes memory path, address factory)
        public
        pure
        returns (
            address tokenA,
            address tokenB,
            address pool
        )
    {
        return Path.decodeFirstPair(path, factory);
    }

    function getFirstPair(bytes memory path) public pure returns (bytes memory) {
        return Path.getFirstPair(path);
    }

    function skipToken(bytes memory path) public pure returns (bytes memory) {
        return Path.skipToken(path);
    }

    // gas funcs
    function getGasCostOfDecodeFirsPair(bytes memory path, address factory) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        Path.decodeFirstPair(path, factory);
        return gasBefore - gasleft();
    }
}
