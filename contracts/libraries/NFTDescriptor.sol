// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

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
        address token1;
        address token0;
        string token0Symbol;
        string token1Symbol;
        uint8 token0Decimals;
        uint8 token1Decimals;
        bool flipRatio;
        int24 tickLower;
        int24 tickUpper;
        int24 tickSpacing;
        uint24 fee;
        uint256 liquidity;
        address poolAddress;
    }

    // TODO: submit final draft of description text
    function constructTokenURI(ConstructTokenURIParams memory params) internal pure returns (string memory) {
        string memory name =
            string(
                abi.encodePacked(
                    'Uniswap V3 - ',
                    feeToPercentString(params.fee),
                    ' - ',
                    params.flipRatio ? params.token0Symbol : params.token1Symbol,
                    '/',
                    params.flipRatio ? params.token1Symbol : params.token0Symbol,
                    ' - ',
                    tickToDecimalString(
                        params.tickLower,
                        params.tickSpacing,
                        params.token0Decimals,
                        params.token1Decimals,
                        params.flipRatio
                    ),
                    '<>',
                    tickToDecimalString(
                        params.tickUpper,
                        params.tickSpacing,
                        params.token0Decimals,
                        params.token1Decimals,
                        params.flipRatio
                    )
                )
            );
        string memory description =
            string(
                abi.encodePacked(
                    'Represents a liquidity position in a Uniswap V3 pool. Redeemable for owed reserve tokens.',
                    '\\nliquidity: ',
                    uint256(params.liquidity).toString(),
                    '\\npoolAddress: ',
                    addressToString(params.poolAddress),
                    '\\ntoken0Address: ',
                    addressToString(params.token0),
                    '\\ntoken1Address: ',
                    addressToString(params.token1)
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
                    Base64.encode(bytes(svgImage(params.token0, params.token1))),
                    '"}'
                )
            );
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
        uint8 token0Decimals,
        uint8 token1Decimals,
        bool flipRatio
    ) internal pure returns (string memory) {
        if (tick == (TickMath.MIN_TICK / tickSpacing) * tickSpacing) {
            return 'MIN';
        } else if (tick == (TickMath.MAX_TICK / tickSpacing) * tickSpacing) {
            return 'MAX';
        } else {
            uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
            if (flipRatio) {
                sqrtRatioX96 = uint160(uint256(1 << 192).div(sqrtRatioX96));
                return fixedPointToDecimalString(sqrtRatioX96, token1Decimals, token0Decimals);
            }
            return fixedPointToDecimalString(sqrtRatioX96, token0Decimals, token1Decimals);
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
        uint8 token0Decimals,
        uint8 token1Decimals
    ) private pure returns (uint256 adjustedSqrtRatioX96) {
        uint256 difference = abs(int256(token0Decimals).sub(int256(token1Decimals)));
        if (difference > 0 && difference <= 18) {
            if (token0Decimals > token1Decimals) {
                adjustedSqrtRatioX96 = sqrtRatioX96.mul(10**(difference.div(2)));
            } else {
                adjustedSqrtRatioX96 = sqrtRatioX96.div(10**(difference.div(2)));
            }
            if (difference % 2 == 1) {
                adjustedSqrtRatioX96 = FullMath.mulDiv(adjustedSqrtRatioX96, sqrt10X128, 1 << 128);
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
    // TODO: return price in terms of token/ETH for ETH pairs
    function fixedPointToDecimalString(
        uint160 sqrtRatioX96,
        uint8 token0Decimals,
        uint8 token1Decimals
    ) internal pure returns (string memory) {
        uint256 adjustedSqrtRatioX96 = adjustForDecimalPrecision(sqrtRatioX96, token0Decimals, token1Decimals);
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

    function tokenToColorHex(uint256 token) internal pure returns (string memory str) {
        return string(abi.encodePacked('#', (token >> (34 * 4)).toHexStringNoPrefix(3)));
    }

    function svgImage(address token0, address token1) internal pure returns (string memory svg) {
        string memory token0Color = tokenToColorHex(uint256(token0));
        string memory token1Color = tokenToColorHex(uint256(token1));
        svg = string(
            abi.encodePacked(
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '<circle cx="12" cy="12" r="12" fill=',
                token0Color,
                ' stroke="white"/>',
                '<g clip-path=url(#beta-',
                token0Color,
                ')>',
                '<circle cx="12" cy="12" r="12" fill=',
                token1Color,
                ' stroke="white"/></g>',
                '<circle cx="12" cy="12" r="4" style=mix-blend-mode:overlay fill="white" />',
                '<circle cx="12" cy="12" r="8" style=mix-blend-mode:overlay fill="white" />',
                '<defs><clipPath id=beta-',
                token0Color,
                '><rect width=12 height="24" fill="white"/>',
                '</clipPath></defs></svg>'
            )
        );
    }
}
