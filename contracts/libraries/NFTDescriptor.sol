// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/BitMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/math/SignedSafeMath.sol';
import 'base64-sol/base64.sol';

import './HexStrings.sol';

library NFTDescriptor {
    using TickMath for int24;
    using Strings for uint256;
    using SafeMath for uint256;
    using SafeMath for uint160;
    using SafeMath for uint8;
    using SignedSafeMath for int256;
    using SignedSafeMath for int24;
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
        int24 tickCurrent;
        int24 tickSpacing;
        uint24 fee;
        address poolAddress;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) internal pure returns (string memory) {
        string memory feeTier = feeToPercentString(params.fee);
        string memory name =
            string(
                abi.encodePacked(
                    'Uniswap - ',
                    feeTier,
                    ' - ',
                    escapeQuotes(params.quoteTokenSymbol),
                    '/',
                    escapeQuotes(params.baseTokenSymbol),
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
                    escapeQuotes(params.quoteTokenSymbol),
                    '-',
                    escapeQuotes(params.baseTokenSymbol),
                    ' pool. ',
                    'The owner of this NFT can modify or redeem the position.\\n',
                    '\\nPool Address: ',
                    addressToString(params.poolAddress),
                    '\\n',
                    escapeQuotes(params.quoteTokenSymbol),
                    ' Address: ',
                    addressToString(params.quoteTokenAddress),
                    '\\n',
                    escapeQuotes(params.baseTokenSymbol),
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
                    svgImage(
                        params.quoteTokenAddress,
                        params.baseTokenAddress,
                        escapeQuotes(params.quoteTokenSymbol),
                        escapeQuotes(params.baseTokenSymbol),
                        feeTier,
                        params.tickLower,
                        params.tickUpper,
                        params.tickCurrent,
                        params.tickSpacing
                    ),
                    '"}'
                )
            );
    }

    function escapeQuotes(string memory symbol) internal pure returns (string memory) {
        bytes memory symbolBytes = bytes(symbol);
        uint8 quotesCount = 0;
        for (uint8 i = 0; i < symbolBytes.length; i++) {
            if (symbolBytes[i] == '"') {
                quotesCount++;
            }
        }
        if (quotesCount > 0) {
            bytes memory escapedBytes = new bytes(symbolBytes.length + (quotesCount));
            uint256 index;
            for (uint8 i = 0; i < symbolBytes.length; i++) {
                if (symbolBytes[i] == '"') {
                    escapedBytes[index++] = '\\';
                }
                escapedBytes[index++] = symbolBytes[i];
            }
            return string(escapedBytes);
        }
        return symbol;
    }

    struct DecimalStringParams {
        // significant figures of decimal
        uint256 sigfigs;
        // length of decimal string
        uint8 bufferLength;
        // ending index for significant figures (funtion works backwards when copying sigfigs)
        uint8 sigfigIndex;
        // index of decimal place (0 if no decimal)
        uint8 decimalIndex;
        // start index for trailing/leading 0's for very small/large numbers
        uint8 zerosStartIndex;
        // end index for trailing/leading 0's for very small/large numbers
        uint8 zerosEndIndex;
        // true if decimal number is less than one
        bool isLessThanOne;
        // true if string should include "%"
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

        // add leading/trailing 0's
        for (uint256 zerosCursor = params.zerosStartIndex; zerosCursor < params.zerosEndIndex.add(1); zerosCursor++) {
            buffer[zerosCursor] = bytes1(uint8(48));
        }
        // add sigfigs
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
        // 99999 -> 100000 gives an extra sigfig
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

    // @notice Returns string that includes first 5 significant figures of a decimal number
    // @param sqrtRatioX96 a sqrt price
    function fixedPointToDecimalString(
        uint160 sqrtRatioX96,
        uint8 baseTokenDecimals,
        uint8 quoteTokenDecimals
    ) internal pure returns (string memory) {
        uint256 adjustedSqrtRatioX96 = adjustForDecimalPrecision(sqrtRatioX96, baseTokenDecimals, quoteTokenDecimals);
        uint256 value = FullMath.mulDiv(adjustedSqrtRatioX96, adjustedSqrtRatioX96, 1 << 64);

        bool priceBelow1 = adjustedSqrtRatioX96 < 2**96;
        if (priceBelow1) {
            // 10 ** 43 is precision needed to retreive 5 sigfigs of smallest possible price + 1 for rounding
            value = FullMath.mulDiv(value, 10**44, 1 << 128);
        } else {
            // leave precision for 4 decimal places + 1 place for rounding
            value = FullMath.mulDiv(value, 10**5, 1 << 128);
        }

        // get digit count
        uint256 temp = value;
        uint8 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        // don't count extra digit kept for rounding
        digits = digits - 1;

        // address rounding
        (uint256 sigfigs, bool extraDigit) = sigfigsRounded(value, digits);
        if (extraDigit) {
            digits++;
        }

        DecimalStringParams memory params;
        if (priceBelow1) {
            // 7 bytes ( "0." and 5 sigfigs) + leading 0's bytes
            params.bufferLength = uint8(uint8(7).add(uint8(43).sub(digits)));
            params.zerosStartIndex = 2;
            params.zerosEndIndex = uint8(uint256(43).sub(digits).add(1));
            params.sigfigIndex = uint8(params.bufferLength.sub(1));
        } else if (digits >= 9) {
            // no decimal in price string
            params.bufferLength = uint8(digits.sub(4));
            params.zerosStartIndex = 5;
            params.zerosEndIndex = uint8(params.bufferLength.sub(1));
            params.sigfigIndex = 4;
        } else {
            // 5 sigfigs surround decimal
            params.bufferLength = 6;
            params.sigfigIndex = 5;
            params.decimalIndex = uint8(digits.sub(5).add(1));
        }
        params.sigfigs = sigfigs;
        params.isLessThanOne = priceBelow1;
        params.isPercent = false;

        return generateDecimalString(params);
    }

    // @notice Returns string as decimal percentage of fee amount.
    // @param fee fee amount
    function feeToPercentString(uint24 fee) internal pure returns (string memory) {
        if (fee == 0) {
            return '0%';
        }
        uint24 temp = fee;
        uint256 digits;
        uint8 numSigfigs;
        while (temp != 0) {
            if (numSigfigs > 0) {
                // count all digits preceding least significant figure
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
            // if decimal > 1 (5th digit is the ones place)
            uint256 decimalPlace = digits.sub(numSigfigs) >= 4 ? 0 : 1;
            nZeros = digits.sub(5) < (numSigfigs.sub(1)) ? 0 : digits.sub(5).sub(numSigfigs.sub(1));
            params.zerosStartIndex = numSigfigs;
            params.zerosEndIndex = uint8(params.zerosStartIndex.add(nZeros).sub(1));
            params.sigfigIndex = uint8(params.zerosStartIndex.sub(1).add(decimalPlace));
            params.bufferLength = uint8(nZeros.add(numSigfigs.add(1)).add(decimalPlace));
        } else {
            // else if decimal < 1
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

    function normalizeTick(
        int24 tick,
        int24 lowerBound,
        int24 upperBound,
        int24 tickSpacing
    ) private pure returns (uint256 tickNormalized) {
        if (tick < lowerBound) {
            tickNormalized = 0;
        } else if (tick > upperBound) {
            tickNormalized = 100;
        } else {
            tickNormalized = uint256(tick.sub(lowerBound).div(tickSpacing));
        }
    }

    function normalizeTicks(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int24 tickSpacing
    ) internal pure returns (uint256 tickLowerNormalized, uint256 tickUpperNormalized) {
        int24 lowerBound = int24(tickCurrent.sub(tickSpacing.mul(50)));
        int24 upperBound = int24(tickCurrent.add(tickSpacing.mul(50)));
        tickLowerNormalized = normalizeTick(tickLower, lowerBound, upperBound, tickSpacing);
        tickUpperNormalized = normalizeTick(tickUpper, lowerBound, upperBound, tickSpacing);
    }

    struct SVGParams {
      string quoteToken;
      string baseToken;
      string quoteTokenSymbol;
      string baseTokenSymbol;
      string feeTier;
      string color0;
      string color1;
      string color2;
      string color3;
      string x1;
      string y1;
      string x2;
      string y2;
      string x3;
      string y3;
    }

    function svgImage(
        address quoteToken,
        address baseToken,
        string memory quoteTokenSymbol,
        string memory baseTokenSymbol,
        string memory feeTier,
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int24 tickSpacing
    ) internal pure returns (string memory svg) {
        SVGParams memory svgParams = SVGParams({
          quoteToken: addressToString(quoteToken),
          baseToken: addressToString(baseToken),
          quoteTokenSymbol: quoteTokenSymbol,
          baseTokenSymbol: baseTokenSymbol,
          feeTier: feeTier,
          color0: tokenToColorHex(uint256(quoteToken), 136),
          color1: tokenToColorHex(uint256(baseToken), 136),
          color2: tokenToColorHex(uint256(quoteToken), 0),
          color3: tokenToColorHex(uint256(baseToken), 0),
          x1: scale(sliceTokenHex(quoteToken, 16), 0, 255, 16, 274),
          y1: scale(sliceTokenHex(baseToken, 16), 0, 255, 100, 484),
          x2: scale(sliceTokenHex(quoteToken, 32), 0, 255, 16, 274),
          y2: scale(sliceTokenHex(baseToken, 32), 0, 255, 100, 484),
          x3: scale(sliceTokenHex(quoteToken, 48), 0, 255, 16, 274),
          y3: scale(sliceTokenHex(baseToken, 48), 0, 255, 100, 484)
        });

        return string(
          abi.encodePacked(
            generateSVGDefs(svgParams),
            generateSVGBorderText(svgParams),
            generateSVGCardMantle(svgParams)
          )
        );

    }

    function generateSVGDefs(SVGParams memory params) private pure returns (string memory svg) {
      /* string memory r1w = '290';
      string memory r1h = '500';
      string memory r1c = '42'; */
      svg = string(
          abi.encodePacked(
            '<svg width=\\"290\\" height=\\"500\\" viewBox=\\"0 0 290 500\\" xmlns=\\"http://www.w3.org/2000/svg\\"<!-- {',
            '\\"address\\": "0xe8ab59d3bcde16a29912de83a90eb39628cfc163", \\"msg\\": "Forged in SVG for Uniswap in 2021 by 0xe8ab59d3bcde16a29912de83a90eb39628cfc163\\",',
            '"sig": "0x2df0e99d9cbfec33a705d83f75666d98b22dea7c1af412c584f7d626d83f02875993df740dc87563b9c73378f8462426da572d7989de88079a382ad96c57b68d1b",',
            '\\"version\\": \\"2\\"} -->',
            'xmlns:xlink=\'http://www.w3.org/1999/xlink\'><style>@import url(\'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@200;400&display=swap\');</style><defs>'
            /* '<!-- Background gradient -->', */
            '<filter id=\\"f1\\"><feImage result=\\"p0\\" xlink:href=\\"data:image/svg+xml;utf8,%3Csvg width=\'290\' height=\'500\' viewBox=\'0 0 290 500\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'290px\' height=\'500px\' fill=\'%23',
            params.color0,
            '\'/%3E%3C/svg%3E\\" /><feImage result=\\"p1\\" xlink:href="data:image/svg+xml;utf8,%3Csvg width=\'290\' height=\'500\' viewBox=\'0 0 290 500\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'',
            params.x1,
            '}\' cy=\'',
            params.y1,
            '\' r=\'120px\' fill=\'%23',
            params.color1,
            '\'/%3E%3C/svg%3E\\" />',
            '<feImage result=\\"p2\\" xlink:href=\\"data:image/svg+xml;utf8,%3Csvg width=\'290\' height=\'500\' viewBox=\'0 0 290 500\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'',
            params.x2,
            '\' cy=\'',
            params.y2,
            '\' r=\'120px\' fill=\'%23',
            params.color2,
            '\'/%3E%3C/svg%3E\\" />',
            '<feImage result=\\"p3\\"',
            ' xlink:href="data:image/svg+xml;utf8,%3Csvg width=\'290\' height=\'500\' viewBox=\'0 0 290 500\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'',
            params.x3,
            '\' cy=\'',
            params.y3,
            '\' r=\'100px\' fill=\'%23',
            params.color3,
            '\'/%3E%3C/svg%3E" /><feBlend mode=\\"overlay\\" in=\\"p0\\" in2=\\"p1\\" /><feBlend mode=\\"exclusion\\" in2=\\"p2\\" /><feBlend mode=\\"overlay\\" in2=\\"p3\\" result=\\"blendOut\\" /><feGaussianBlur in=\\"blendOut\\" stdDeviation=\\"42\\" /></filter>',
            '<!-- Clip path for gradients -->',
            ' <clipPath id=\\"corners\\"><rect width=\\"290\\" height=\\"500\\" rx=\\"42\\" ry=\\"42\\" /></clipPath>',
            '<!-- Outer text animation path. Must be a path for chrome support. Can be generated with elementToPath above. -->',
            '<path id=\\"text-path-a\\" d=\\"M40 12 H250 A28 28 0 0 1 278 40 V460 A28 28 0 0 1 250 488 H40 A28 28 0 0 1 12 460 V40 A28 28 0 0 1 40 12 z\\" />',
            '<!-- Minimap -->',
            '<path id=\\"minimap\\" d=\\"M234 444C234 457.949 242.21 463 253 463\\" />',
            '<!-- Top dark region blur filter -->',
            '<filter id=\\"top-region-blur\\"><feGaussianBlur in=\\"SourceGraphic\\" stdDeviation=\\"24\\" /></filter>',
            '<linearGradient id=\\"grad-up\\" x1=\\"1\\" x2=\\"0\\" y1=\\"1\\" y2=\\"0\\"><stop offset=\\"0.0\\" stop-color=\\"white\\" stop-opacity=\\"1\\" />',
            '<stop offset=\\".9\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
            '<!-- Positive out of range -->',
            '<linearGradient id=\\"grad-down\\" x1=\\"0\\" x2=\\"1\\" y1=\\"0\\" y2=\\"1\\"><stop offset=\\"0.0\\" stop-color=\\"white\\" stop-opacity=\\"1\\" /><stop offset=\\"0.9\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
            '<mask id=\\"fade-up\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"url(#grad-up)\\" /></mask>',
            '<mask id=\\"fade-down\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"url(#grad-down)\\" /></mask>',
            '<mask id=\\"none\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"white\\" /></mask>',
            '<!-- Symbol text overflow -->',
            '<linearGradient id=\\"grad-symbol\\"><stop offset=\\"0.7\\" stop-color=\\"white\\" stop-opacity=\\"1\\" /><stop offset=\\".95\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
            '<mask id=\\"fade-symbol\\" maskContentUnits=\\"userSpaceOnUse\\"><rect width=\\"290px\\" height=\\"200px\\" fill=\\"url(#grad-symbol)\\" /></mask></defs>',
            '<g clip-path=\\"url(#corners)\\">',
            '<!-- Background and border -->',
            '<rect fill=\\"',
            params.color0,
            '\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
            '<rect style=\\"filter: url(#f1)\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
            '<!-- Top dark area -->',
            '<g style=\\"filter:url(#top-region-blur); transform:scale(1.5); transform-origin:center top;\\">',
            '<rect fill=\\"none\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
            '<ellipse cx=\\"50%\\" cy=\\"0px\\" rx=\\"180px\\" ry=\\"120px\\" fill=\\"#000\\" opacity=\\"0.85\\" /></g></g>'
          )
      );
    }

    function generateSVGBorderText(SVGParams memory params) private pure returns (string memory svg) {
      svg = string(
        abi.encodePacked(
          '<!-- Outerdata string -->',
          '<text text-rendering=\\"optimizeSpeed\\">',
          '<textPath startOffset=\\"-100%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
          params.baseToken,
          unicode' • ',
          params.baseTokenSymbol,
          '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" />',
          '</textPath> <textPath startOffset=\\"0%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
          params.baseToken,
          unicode' • ',
          params.baseTokenSymbol,
          '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" /> </textPath>',
          '<textPath startOffset=\\"50%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
          params.quoteToken,
          unicode' • ',
          params.quoteTokenSymbol,
          '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\"',
          'repeatCount=\\"indefinite\\" /></textPath><textPath startOffset=\\"-50%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
          params.quoteToken,
          unicode' • ',
          params.quoteTokenSymbol,
          '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" /></textPath></text>'
        )
      );
    }

    function generateSVGCardMantle(SVGParams memory params) private pure returns (string memory svg) {
      svg = string(
        abi.encodePacked(
          '<!-- Card mantle -->'
          '<g mask=\\"url(#fade-symbol)\\"><rect fill=\\"none\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"200px\\" />  <text y=\\"70px\\" x=\\"32px\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-weight=\\"200\\" font-size=\\"36px\\">',
          params.quoteTokenSymbol,
          '/',
          params.baseTokenSymbol,
          '</text><text y=\\"115px\\" x=\\"32px\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-weight=\\"200\\" font-size=\\"36px\\">',
          params.feeTier,
          '</text></g>',
          '<!-- Translucent inner border -->',
          '<rect x=\\"16\\" y=\\"16\\" width=\\"258\\" height=\\"468\\" rx=\\"26\\" ry=\\"26\\" fill=\\"rgba(0,0,0,0)\\" ',
          'stroke=\\"rgba(255,255,255,0.2)\\" /><rect x=\\"0\\" y=\\"0\\" width=\\"290\\" height=\\"468\\" rx=\\"42\\" ry=\\"42\\" fill=\\"rgba(0,0,0,0)\\" stroke=\\"rgba(255,255,255,0.2)\\" />'
          )
      );
    }

    function scale(uint256 n, uint256 inMn, uint256 inMx, uint256 outMn, uint256 outMx) private pure returns (string memory) {
      return (n.sub(inMn).mul(outMx.sub(outMn)).div(inMx.sub(inMn)).add(outMn)).toString();
    }

    function tokenToColorHex(uint256 token, uint256 offset) internal pure returns (string memory str) {
        return string(abi.encodePacked('#', (token >> offset).toHexStringNoPrefix(3)));
    }

    function sliceTokenHex(address token, uint256 offset) internal pure returns (uint256) {
        return uint256(uint8(uint256(token) >> offset));
    }

}
