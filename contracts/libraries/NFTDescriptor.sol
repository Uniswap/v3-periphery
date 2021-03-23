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
    using SafeMath for uint8;
    using SignedSafeMath for int256;
    using HexStrings for uint256;

    struct ConstructTokenURIParams {
        address token1;
        address token0;
        int24 tickLower;
        int24 tickUpper;
        int24 tickSpacing;
        string token0Symbol;
        string token1Symbol;
        uint24 fee;
        uint256 liquidity;
        address poolAddress;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) internal view returns (string memory) {
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
                    tickToDecimalString(params.tickLower, params.tickSpacing),
                    '<>',
                    tickToDecimalString(params.tickUpper, params.tickSpacing)
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

    function tickToDecimalString(int24 tick, int24 tickSpacing) internal pure returns (string memory) {
      if (tick == (TickMath.MIN_TICK / tickSpacing) * tickSpacing) {
        return 'MIN';
      } else if (tick == (TickMath.MAX_TICK / tickSpacing) * tickSpacing) {
        return 'MAX';
      } else {
        return fixedPointToDecimalString(TickMath.getSqrtRatioAtTick(tick));
      }
    }

    // @notice Returns string that includes first 5 significant figures of a decimal number
    // @param sqrtRatioX96 a sqrt price
    // TODO: consider token decimals
    function fixedPointToDecimalString(uint160 sqrtRatioX96) internal pure returns (string memory) {
        uint256 value = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);

        bool priceBelow1;
        if (sqrtRatioX96 < 2**96) {
            // 10 ** 43 is precision needed to retreive 5 sigfigs of smallest possible price
            value = FullMath.mulDiv(value, 10**43, 1 << 128);
            priceBelow1 = true;
        } else {
            // leave precision for 4 decimal places
            value = FullMath.mulDiv(value, 10**4, 1 << 128);
        }

        // get digit count
        uint256 temp = value;
        uint8 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
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

        // reduce value to sigfigs only
        temp = value.div((10**digits).div(10**5));
        // add sigfigs
        while (temp != 0) {
            if (decimalIndex > 0 && sigfigIndex == decimalIndex) {
                // add decimal
                buffer[sigfigIndex--] = '.';
            }
            buffer[sigfigIndex--] = bytes1(uint8(uint256(48).add(temp % 10)));
            temp /= 10;
        }
        return string(buffer);
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

    function abs(int256 x) private pure returns (uint256) {
        int256 absoluteValue = x >= 0 ? x : -x;
        return uint256(absoluteValue);
    }
}
