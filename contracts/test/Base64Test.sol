// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/Base64.sol';

contract Base64Test {
    function encode(bytes memory data) external pure returns (string memory) {
        return Base64.encode(data);
    }
}
