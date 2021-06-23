// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '../interfaces/INonfungiblePositionManager.sol';

library PositionValue {
    using SafeMath for uint256;

    struct PrincipalParams {
        uint160 sqrtRatioX96;
        uint160 sqrtRatioX96Lower;
        uint160 sqrtRatioX96Upper;
        int128 liquidity;
    }

    function principal(PrincipalParams calldata params) internal pure returns (uint256 amount0, uint256 amount1) {
        require(params.sqrtRatioX96Lower < params.sqrtRatioX96Upper, 'Bad Range');

        if (params.sqrtRatioX96 < params.sqrtRatioX96Lower) {
            amount0 = calculateAmount0(
                uint256(params.liquidity) << FixedPoint96.RESOLUTION,
                params.sqrtRatioX96Lower,
                params.sqrtRatioX96Upper
            );
            amount1 = 0;
        } else if (params.sqrtRatioX96 < params.sqrtRatioX96Upper) {
            amount0 = calculateAmount0(
                uint256(params.liquidity) << FixedPoint96.RESOLUTION,
                params.sqrtRatioX96,
                params.sqrtRatioX96Upper
            );
            amount1 = calculateAmount1(params.liquidity, params.sqrtRatioX96Lower, params.sqrtRatioX96);
        } else {
            amount0 = 0;
            amount1 = calculateAmount1(params.liquidity, params.sqrtRatioX96Lower, params.sqrtRatioX96Upper);
        }
    }

    function calculateAmount0(
        uint256 liquidityX96,
        uint160 lowerBound,
        uint160 upperBound
    ) private pure returns (uint256 amount0) {
        amount0 = liquidityX96.mul(upperBound - lowerBound).div(upperBound).div(lowerBound);
    }

    function calculateAmount1(
        uint256 liquidity,
        uint160 lowerBound,
        uint160 upperBound
    ) private pure returns (uint256 amount1) {
        amount1 = FullMath.mulDiv(liquidity, (upperBound - lowerBound), FixedPoint96.RESOLUTION);
    }
}
