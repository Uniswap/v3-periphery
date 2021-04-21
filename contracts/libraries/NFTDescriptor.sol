// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/BitMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/math/SignedSafeMath.sol';
import './HexStrings.sol';
import './Base64.sol';

library NFTDescriptor {
    using TickMath for int24;
    using Strings for uint256;
    using SafeMath for uint256;
    using SafeMath for uint160;
    using SafeMath for uint8;
    using SignedSafeMath for int256;
    using HexStrings for uint256;

    uint256 constant sqrt10X128 = 1076067327063303206878105757264492625226;

    struct ConstructTokenURIParams {
        uint256 tokenId;
        address quoteTokenAddress;
        address baseTokenAddress;
        string quoteTokenSymbol;
        string baseTokenSymbol;
        uint8 quoteTokenDecimals;
        uint8 baseTokenDecimals;
        bool flipRatio;
        int24 tickLower;
        int24 tickUpper;
        int24 tickSpacing;
        uint24 fee;
        address poolAddress;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) internal pure returns (string memory) {
        string memory feeTier = feeToPercentString(params.fee);
        string memory quoteSymbolFormatted = escapeQuotes(params.quoteTokenSymbol);
        string memory baseSymbolFormatted = escapeQuotes(params.baseTokenSymbol);
        string memory name =
            string(
                abi.encodePacked(
                    'Uniswap - ',
                    feeTier,
                    ' - ',
                    quoteSymbolFormatted,
                    '/',
                    baseSymbolFormatted,
                    ' - ',
                    tickToDecimalString(
                        !params.flipRatio ? params.tickLower : params.tickUpper,
                        params.tickSpacing,
                        params.baseTokenDecimals,
                        params.quoteTokenDecimals,
                        params.flipRatio
                    ),
                    '<>',
                    tickToDecimalString(
                        !params.flipRatio ? params.tickUpper : params.tickLower,
                        params.tickSpacing,
                        params.baseTokenDecimals,
                        params.quoteTokenDecimals,
                        params.flipRatio
                    )
                )
            );
        string memory description =
            string(
                abi.encodePacked(
                    'This NFT represents a liquidity position in a Uniswap V3 ',
                    quoteSymbolFormatted,
                    '-',
                    baseSymbolFormatted,
                    ' pool. ',
                    'The owner of this NFT can modify or redeem the position.\\n',
                    '\\nPool Address: ',
                    addressToString(params.poolAddress),
                    '\\n',
                    quoteSymbolFormatted,
                    ' Address: ',
                    addressToString(params.quoteTokenAddress),
                    '\\n',
                    baseSymbolFormatted,
                    ' Address: ',
                    addressToString(params.baseTokenAddress),
                    '\\nFee Tier: ',
                    feeTier,
                    '\\nToken ID: ',
                    params.tokenId.toString(),
                    '\\n\\n',
                    unicode'⚠️ DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as token symbols may be imitated.'
                )
            );

        return
            string(
                abi.encodePacked(
                    'data:application/json,{"name":"',
                    name,
                    '", "description":"',
                    description,
                    '", "image": "',
                    'data:image/svg+xml;base64,',
                    Base64.encode(bytes(svgImage(params.quoteTokenAddress, params.baseTokenAddress))),
                    '"}'
                )
            );
    }

    function escapeQuotes(string memory symbol) internal pure returns (string memory) {
      bytes memory symbolBytes = bytes(symbol);
      uint8 quotesCount = 0;
      for(uint8 i = 0; i < symbolBytes.length; i++) {
        if (symbolBytes[i] == '"') {
          quotesCount++;
        }
        if (quotesCount > 0) {
            bytes memory formattedBytes = new bytes(symbolBytes.length + (quotesCount));
            uint256 index;
            for (uint8 i = 0; i < symbolBytes.length; i++) {
                if (symbolBytes[i] == '"') {
                    formattedBytes[index++] = '\\';
                }
                formattedBytes[index++] = symbolBytes[i];
            }
            return string(formattedBytes);
        }
        return symbol;
    }

    struct DecimalStringParams {
        uint256 sigfigs;
        uint8 bufferLength;
        uint8 sigfigIndex;
        uint8 decimalIndex;
        uint8 zerosStartIndex;
        uint8 zerosEndIndex;
        bool isLessThanOne;
        bool isPercent;
    }

    function generateDecimalString(DecimalStringParams memory params) private pure returns (string memory) {
        bytes memory buffer = new bytes(params.bufferLength);
        if (params.isPercent) {
            buffer[buffer.length - 1] = '%';
        }
        if (params.isLessThanOne) {
            buffer[0] = '0';
            buffer[1] = '.';
        }

        for (uint256 zerosCursor = params.zerosStartIndex; zerosCursor < params.zerosEndIndex.add(1); zerosCursor++) {
            buffer[zerosCursor] = bytes1(uint8(48));
        }
        while (params.sigfigs > 0) {
            if (params.decimalIndex > 0 && params.sigfigIndex == params.decimalIndex) {
                buffer[params.sigfigIndex--] = '.';
            }
            buffer[params.sigfigIndex--] = bytes1(uint8(uint256(48).add(params.sigfigs % 10)));
            params.sigfigs /= 10;
        }
        return string(buffer);
    }

    function tickToDecimalString(
        int24 tick,
        int24 tickSpacing,
        uint8 baseTokenDecimals,
        uint8 quoteTokenDecimals,
        bool flipRatio
    ) internal pure returns (string memory) {
        if (tick == (TickMath.MIN_TICK / tickSpacing) * tickSpacing) {
            return !flipRatio ? 'MIN' : 'MAX';
        } else if (tick == (TickMath.MAX_TICK / tickSpacing) * tickSpacing) {
            return !flipRatio ? 'MAX' : 'MIN';
        } else {
            uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
            if (flipRatio) {
                sqrtRatioX96 = uint160(uint256(1 << 192).div(sqrtRatioX96));
            }
            return fixedPointToDecimalString(sqrtRatioX96, baseTokenDecimals, quoteTokenDecimals);
        }
    }

    function sigfigsRounded(uint256 value, uint8 digits) private pure returns (uint256, bool) {
        bool extraDigit;
        if (digits > 5) {
            value = value.div((10**(digits - 5)));
        }
        bool roundUp = value % 10 > 4;
        value = value.div(10);
        if (roundUp) {
            value = value + 1;
        }
        if (value == 100000) {
            value /= 10;
            extraDigit = true;
        }
        return (value, extraDigit);
    }

    function adjustForDecimalPrecision(
        uint160 sqrtRatioX96,
        uint8 baseTokenDecimals,
        uint8 quoteTokenDecimals
    ) private pure returns (uint256 adjustedSqrtRatioX96) {
        uint256 difference = abs(int256(baseTokenDecimals).sub(int256(quoteTokenDecimals)));
        if (difference > 0 && difference <= 18) {
            if (baseTokenDecimals > quoteTokenDecimals) {
                adjustedSqrtRatioX96 = sqrtRatioX96.mul(10**(difference.div(2)));
                if (difference % 2 == 1) {
                    adjustedSqrtRatioX96 = FullMath.mulDiv(adjustedSqrtRatioX96, sqrt10X128, 1 << 128);
                }
            } else {
                adjustedSqrtRatioX96 = sqrtRatioX96.div(10**(difference.div(2)));
                if (difference % 2 == 1) {
                    adjustedSqrtRatioX96 = FullMath.mulDiv(adjustedSqrtRatioX96, 1 << 128, sqrt10X128);
                }
            }
        } else {
            adjustedSqrtRatioX96 = uint256(sqrtRatioX96);
        }
    }

    function abs(int256 x) private pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }

    function fixedPointToDecimalString(
        uint160 sqrtRatioX96,
        uint8 baseTokenDecimals,
        uint8 quoteTokenDecimals
    ) internal pure returns (string memory) {
        uint256 adjustedSqrtRatioX96 = adjustForDecimalPrecision(sqrtRatioX96, baseTokenDecimals, quoteTokenDecimals);
        uint256 value = FullMath.mulDiv(adjustedSqrtRatioX96, adjustedSqrtRatioX96, 1 << 64);

        bool priceBelow1 = adjustedSqrtRatioX96 < 2**96;
        if (priceBelow1) {
            value = FullMath.mulDiv(value, 10**44, 1 << 128);
        } else {
            value = FullMath.mulDiv(value, 10**5, 1 << 128);
        }

        uint256 temp = value;
        uint8 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        digits = digits - 1;

        (uint256 sigfigs, bool extraDigit) = sigfigsRounded(value, digits);
        if (extraDigit) {
            digits++;
        }

        DecimalStringParams memory params;
        if (priceBelow1) {
            params.bufferLength = uint8(uint8(7).add(uint8(43).sub(digits)));
            params.zerosStartIndex = 2;
            params.zerosEndIndex = uint8(uint256(43).sub(digits).add(1));
            params.sigfigIndex = uint8(params.bufferLength.sub(1));
        } else if (digits >= 9) {
            params.bufferLength = uint8(digits.sub(4));
            params.zerosStartIndex = 5;
            params.zerosEndIndex = uint8(params.bufferLength.sub(1));
            params.sigfigIndex = 4;
        } else {
            params.bufferLength = 6;
            params.sigfigIndex = 5;
            params.decimalIndex = uint8(digits.sub(5).add(1));
        }
        params.sigfigs = sigfigs;
        params.isLessThanOne = priceBelow1;
        params.isPercent = false;

        return generateDecimalString(params);
    }

    function feeToPercentString(uint24 fee) internal pure returns (string memory) {
        if (fee == 0) {
            return '0%';
        }
        uint24 temp = fee;
        uint256 digits;
        uint8 numSigfigs;
        while (temp != 0) {
            if (numSigfigs > 0) {
                numSigfigs++;
            } else if (temp % 10 != 0) {
                numSigfigs++;
            }
            digits++;
            temp /= 10;
        }

        DecimalStringParams memory params;
        uint256 nZeros;
        if (digits >= 5) {
            uint256 decimalPlace = digits.sub(numSigfigs) >= 4 ? 0 : 1;
            nZeros = digits.sub(5) < (numSigfigs.sub(1)) ? 0 : digits.sub(5).sub(numSigfigs.sub(1));
            params.zerosStartIndex = numSigfigs;
            params.zerosEndIndex = uint8(params.zerosStartIndex.add(nZeros).sub(1));
            params.sigfigIndex = uint8(params.zerosStartIndex.sub(1).add(decimalPlace));
            params.bufferLength = uint8(nZeros.add(numSigfigs.add(1)).add(decimalPlace));
        } else {
            nZeros = uint256(5).sub(digits);
            params.zerosStartIndex = 2;
            params.zerosEndIndex = uint8(nZeros.add(params.zerosStartIndex).sub(1));
            params.bufferLength = uint8(nZeros.add(numSigfigs.add(2)));
            params.sigfigIndex = uint8((params.bufferLength).sub(2));
            params.isLessThanOne = true;
        }
        params.sigfigs = uint256(fee).div(10**(digits.sub(numSigfigs)));
        params.isPercent = true;
        params.decimalIndex = digits > 4 ? uint8(digits.sub(4)) : 0;

        return generateDecimalString(params);
    }

    function addressToString(address addr) internal pure returns (string memory) {
        return (uint256(addr)).toHexString(20);
    }

    function tokenToColorHex(uint256 token) internal pure returns (string memory str) {
        return string(abi.encodePacked('#', (token >> (34 * 4)).toHexStringNoPrefix(3)));
    }

    function svgImage(address quoteToken, address baseToken) internal pure returns (string memory svg) {
        string memory quoteTokenColor = tokenToColorHex(uint256(quoteToken));
        string memory baseTokenColor = tokenToColorHex(uint256(baseToken));
        svg = string(
            abi.encodePacked(
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">', //www.w3.org/2000/svg">',
                '<circle cx="12" cy="12" r="12" fill=',
                quoteTokenColor,
                ' stroke="white"/>',
                '<g clip-path=url(#beta-',
                quoteTokenColor,
                ')>',
                '<circle cx="12" cy="12" r="12" fill=',
                baseTokenColor,
                ' stroke="white"/></g>',
                '<circle cx="12" cy="12" r="4" style=mix-blend-mode:overlay fill="white" />',
                '<circle cx="12" cy="12" r="8" style=mix-blend-mode:overlay fill="white" />',
                '<defs><clipPath id=beta-',
                quoteTokenColor,
                '><rect width=12 height="24" fill="white"/>',
                '</clipPath></defs></svg>'
            )
        );
    }
}
