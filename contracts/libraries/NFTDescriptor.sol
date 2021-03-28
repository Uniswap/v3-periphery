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

library NFTDescriptor {
    using TickMath for int24;
    using Strings for uint256;
    using SafeMath for uint256;
    using SafeMath for uint160;
    using SafeMath for uint8;
    using SignedSafeMath for int256;
    using HexStrings for uint256;

    struct ConstructTokenURIParams {
        address token1;
        address token0;
        string token0Symbol;
        string token1Symbol;
        uint8 token0Decimals;
        uint8 token1Decimals;
        int24 tickLower;
        int24 tickUpper;
        int24 tickSpacing;
        uint24 fee;
        uint256 liquidity;
        address poolAddress;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) internal pure returns (string memory) {
        string memory name =
            string(
                abi.encodePacked(
                    'Uniswap V3 - ',
                    feeToPercentString(params.fee),
                    ' - ',
                    params.token0Symbol,
                    '/',
                    params.token1Symbol,
                    ' - ',
                    tickToDecimalString(
                        params.tickLower,
                        params.tickSpacing,
                        params.token0Decimals,
                        params.token1Decimals
                    ),
                    '<>',
                    tickToDecimalString(
                        params.tickUpper,
                        params.tickSpacing,
                        params.token0Decimals,
                        params.token1Decimals
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
            string(abi.encodePacked('data:application/json,{"name":"', name, '", "description":"', description, '"}'));
    }

    function addressToString(address addr) internal pure returns (string memory) {
        uint256 _uint = (uint256(addr));
        return _uint.toHexString(20);
    }

    function tickToDecimalString(
        int24 tick,
        int24 tickSpacing,
        uint8 token0Decimals,
        uint8 token1Decimals
    ) internal pure returns (string memory) {
        if (tick == (TickMath.MIN_TICK / tickSpacing) * tickSpacing) {
            return 'MIN';
        } else if (tick == (TickMath.MAX_TICK / tickSpacing) * tickSpacing) {
            return 'MAX';
        } else {
            return fixedPointToDecimalString(TickMath.getSqrtRatioAtTick(tick), token0Decimals, token1Decimals);
        }
    }

    // @notice Returns string that includes first 5 significant figures of a decimal number
    // @param sqrtRatioX96 a sqrt price
    function fixedPointToDecimalString(
        uint160 sqrtRatioX96,
        uint8 token0Decimals,
        uint8 token1Decimals
    ) internal pure returns (string memory) {
        sqrtRatioX96 = adjustForDecimalPrecision(sqrtRatioX96, token0Decimals, token1Decimals);
        uint256 value = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);

        bool priceBelow1;
        if (sqrtRatioX96 < 2**96) {
            // 10 ** 43 is precision needed to retreive 5 sigfigs of smallest possible price + 1 for rounding
            value = FullMath.mulDiv(value, 10**44, 1 << 128);
            priceBelow1 = true;
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
        // don't count extra digit for rounding
        digits = digits - 1;

        // address rounding
        (uint256 sigfigs, bool extraDigit) = sigfigsRounded(value, digits);
        if (extraDigit) {
            digits++;
        }

        bytes memory buffer;
        uint256 sigfigIndex;
        uint256 decimalIndex;
        uint8 zerosCursor;
        uint8 zerosEnd;
        if (priceBelow1) {
            // 7 bytes ( "0." and 5 sigfigs) + leading 0's bytes
            buffer = new bytes(uint256(7).add(uint256(43).sub(digits)));
            zerosCursor = 2;
            zerosEnd = uint8(uint256(43).sub(digits).add(2));
            buffer[0] = '0';
            buffer[1] = '.';
            sigfigIndex = buffer.length.sub(1);
        } else if (digits >= 9) {
            // no decimal in price string
            buffer = new bytes(digits.sub(4));
            zerosCursor = 5;
            zerosEnd = uint8(buffer.length);
            sigfigIndex = 4;
        } else {
            // 5 sigfigs surround decimal
            buffer = new bytes(6);
            sigfigIndex = 5;
            decimalIndex = digits.sub(5).add(1);
        }

        // add trailing/leading 0's for very large or very small numbers
        for (zerosCursor; zerosCursor < zerosEnd; zerosCursor++) {
            buffer[zerosCursor] = bytes1(uint8(48));
        }

        // add sigfigs
        while (sigfigs != 0) {
            if (decimalIndex > 0 && sigfigIndex == decimalIndex) {
                // add decimal
                buffer[sigfigIndex--] = '.';
            }
            buffer[sigfigIndex--] = bytes1(uint8(uint256(48).add(sigfigs % 10)));
            sigfigs /= 10;
        }
        return string(buffer);
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
    ) private pure returns (uint160) {
        uint256 sqrt10X128 = 1076067327063303206878105757264492625226;
        uint256 difference = decimalDifference(token0Decimals, token1Decimals);
        if (difference > 0 && difference <= 18) {
            if (token0Decimals > token1Decimals) {
                sqrtRatioX96 = uint160(sqrtRatioX96.mul(10**(difference.div(2))));
                if (difference % 2 == 1) {
                    sqrtRatioX96 = uint160(FullMath.mulDiv(sqrtRatioX96, sqrt10X128, 1 << 128));
                }
            } else {
                sqrtRatioX96 = uint160(sqrtRatioX96.div(10**(difference.div(2))));
                if (difference % 2 == 1) {
                    sqrtRatioX96 = uint160(FullMath.mulDiv(sqrtRatioX96, sqrt10X128, 1 << 128));
                }
            }
        }
        return sqrtRatioX96;
    }

    function decimalDifference(uint8 token0Decimals, uint8 token1Decimals) private pure returns (uint256) {
        return abs(int256(token0Decimals).sub(int256(token1Decimals)));
    }

    function abs(int256 x) private pure returns (uint256) {
        int256 absoluteValue = x >= 0 ? x : -x;
        return uint256(absoluteValue);
    }

    // @notice Returns string as decimal percentage of fee amount. Only includes first sigfig of fee.
    // @param fee fee amount
    function feeToPercentString(uint24 fee) internal pure returns (string memory) {
        uint24 temp = fee;
        uint8 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        uint256 decimalIndex = digits >= 5 ? 0 : 1;
        uint256 nZeros = abs(int256(5).sub(int256(digits)));
        bytes memory buffer = new bytes(nZeros.add(2).add(decimalIndex));
        uint256 sigfig = uint256(fee).div(10**(digits - 1));
        uint256 index;

        buffer[buffer.length - 1] = '%';
        if (digits > 4) {
            buffer[index++] = bytes1(uint8(uint256(48).add(sigfig % 10)));
        } else {
            buffer[buffer.length - 2] = bytes1(uint8(uint256(48).add(sigfig % 10)));
            buffer[index++] = '0';
            buffer[index++] = '.';
        }
        while (index <= nZeros) {
            buffer[index++] = '0';
        }

        return string(buffer);
    }
}
