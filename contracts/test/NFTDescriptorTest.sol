// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/NFTDescriptor.sol';
import '../libraries/NFTSVG.sol';
import '../libraries/HexStrings.sol';

contract NFTDescriptorTest {
    using HexStrings for uint256;

    function constructTokenURI(NFTDescriptor.ConstructTokenURIParams calldata params)
        public
        pure
        returns (string memory)
    {
        return NFTDescriptor.constructTokenURI(params);
    }

    function getGasCostOfConstructTokenURI(NFTDescriptor.ConstructTokenURIParams calldata params)
        public
        view
        returns (uint256)
    {
        uint256 gasBefore = gasleft();
        NFTDescriptor.constructTokenURI(params);
        return gasBefore - gasleft();
    }

    function tickToDecimalString(
        int24 tick,
        int24 tickSpacing,
        uint8 token0Decimals,
        uint8 token1Decimals,
        bool flipRatio
    ) public pure returns (string memory) {
        return NFTDescriptor.tickToDecimalString(tick, tickSpacing, token0Decimals, token1Decimals, flipRatio);
    }

    function fixedPointToDecimalString(
        uint160 sqrtRatioX96,
        uint8 token0Decimals,
        uint8 token1Decimals
    ) public pure returns (string memory) {
        return NFTDescriptor.fixedPointToDecimalString(sqrtRatioX96, token0Decimals, token1Decimals);
    }

    function feeToPercentString(uint24 fee) public pure returns (string memory) {
        return NFTDescriptor.feeToPercentString(fee);
    }

    function addressToString(address _address) public pure returns (string memory) {
        return NFTDescriptor.addressToString(_address);
    }

    function svgImage(
        uint256 tokenId,
        address token0,
        address token1,
        string memory token0Symbol,
        string memory token1Symbol,
        string memory feeTier,
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent
    ) public pure returns (string memory) {
        return
            NFTDescriptor.generateSVGImage(
                tokenId,
                token0,
                token1,
                token0Symbol,
                token1Symbol,
                feeTier,
                tickLower,
                tickUpper,
                tickCurrent
            );
    }

    function tokenToColorHex(address token, uint256 offset) public pure returns (string memory) {
        return NFTDescriptor.tokenToColorHex(uint256(token), offset);
    }

    function sliceTokenHex(address token, uint256 offset) public pure returns (uint256) {
        return NFTDescriptor.sliceTokenHex(uint256(token), offset);
    }

    function getCurve(int24 tickLower, int24 tickUpper) public pure returns (string memory) {
        return NFTSVG.getCurve(tickLower, tickUpper);
    }

    function generateSVGCurveCircle(int8 overRange) public pure returns (string memory) {
        return NFTSVG.generateSVGCurveCircle(overRange);
    }
}
