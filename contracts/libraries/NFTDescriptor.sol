// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/BitMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

library NFTDescriptor {
    using TickMath for int24;
    using Strings for uint256;
    using SafeMath for uint256;
    using SafeMath for uint8;

    struct ConstructTokenURIParams {
        address token1;
        address token0;
        int24 tickLower;
        int24 tickUpper;
        string token0Symbol;
        string token1Symbol;
        uint256 liquidity;
    }

    function constructTokenURI(ConstructTokenURIParams memory params) internal view returns (string memory) {
        string memory name =
            string(
                abi.encodePacked(
                    'Uniswap V3 ',
                    params.token0Symbol,
                    '/',
                    params.token1Symbol,
                    ' ',
                    fixedPointToDecimalString(TickMath.getSqrtRatioAtTick(params.tickLower)),
                    '<>',
                    fixedPointToDecimalString(TickMath.getSqrtRatioAtTick(params.tickUpper))
                )
            );
        string memory description =
            string(
                abi.encodePacked(
                    'Represents a position in Uniswap V3 with liquidity: ',
                    uint256(params.liquidity).toString()
                )
            );

        return
            string(abi.encodePacked('data:application/json,{"name":"', name, '", "description":"', description, '"}'));
    }

    // Returns string that includes first 5 significant figures of a decimal number
    // Based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Strings.sol#L14
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
            buffer[0] = bytes1(uint8(48)); // "0"
            buffer[1] = bytes1(uint8(46)); // "."
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
                buffer[sigfigIndex--] = bytes1(uint8(46));
            }
            buffer[sigfigIndex--] = bytes1(uint8(uint256(48).add(temp % 10)));
            temp /= 10;
        }
        return string(buffer);
    }

    function feeToPercentString(uint24 fee) internal pure returns (string memory feeString) {
        if (fee == 500) {
            feeString = '0.05%';
        } else if (fee == 3000) {
            feeString = '0.3%';
        } else if (fee == 10000) {
            feeString = '1%';
        } else {
            revert('invalid fee');
        }
    }
}
