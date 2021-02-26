// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Path.sol';

contract PathTest {
    function hasPairs(bytes memory path) public pure returns (bool) {
        return Path.hasPairs(path);
    }

    function decode(bytes memory path)
        public
        pure
        returns (
            address tokenA,
            address tokenB,
            uint24 fee
        )
    {
        return Path.decode(path);
    }

    function skipOne(bytes memory path) public pure returns (bytes memory) {
        return Path.skipOne(path);
    }

    // gas funcs
    function getGasCostOfDecode(bytes memory path) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        Path.decode(path);
        return gasBefore - gasleft();
    }
}
