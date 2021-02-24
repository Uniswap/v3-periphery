// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import 'hardhat/console.sol';

import './BytesLib.sol';

library Path {
    uint256 internal constant ADDR_SIZE = 20;
    uint256 internal constant FEE_SIZE = 2;

    using BytesLib for bytes;

    // decodes a single element
    function decode(bytes memory path) internal view returns (address token0, address token1, uint24 fee) {
        token0 = path.toAddress(0);
        fee = uint24(path.toUint16(ADDR_SIZE));
        token1 = path.toAddress(ADDR_SIZE + FEE_SIZE);
    }

}
