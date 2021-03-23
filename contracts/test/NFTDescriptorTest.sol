// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/NFTDescriptor.sol';

contract NFTDescriptorTest {
    function constructTokenURI(NFTDescriptor.ConstructTokenURIParams calldata params)
        public
        view
        returns (string memory)
    {
        return NFTDescriptor.constructTokenURI(params);
    }

    function tickToDecimalString(int24 tick, int24 tickSpacing) public pure returns (string memory) {
        return NFTDescriptor.tickToDecimalString(tick, tickSpacing);
    }

    function fixedPointToDecimalString(uint160 sqrtRatioX96) public pure returns (string memory) {
        return NFTDescriptor.fixedPointToDecimalString(sqrtRatioX96);
    }

    function feeToPercentString(uint24 fee) public pure returns (string memory) {
        return NFTDescriptor.feeToPercentString(fee);
    }

    function addressToString(address _address) public pure returns (string memory) {
        return NFTDescriptor.addressToString(_address);
    }
}
