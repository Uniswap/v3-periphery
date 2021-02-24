// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

library Path {
    // decodes <token> <fee> <token> buffer
    function decode(bytes memory path) internal pure returns (address token0, address token1, uint24 fee) {
        token0 = address(0x0);
        token1 = address(0x0);
        fee = 0;
    }
}
