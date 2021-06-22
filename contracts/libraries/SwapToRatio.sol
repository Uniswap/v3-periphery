// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

library SwapToRatio {
    struct PoolParams {
        uint160 sqrtRatioX96;
        uint128 liquidity;
    }

    struct PositionParams {
        uint160 sqrtRatioX96Lower;
        uint160 sqrtRatioX96Upper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    function amountToSwap(PoolParams calldata poolParams, PositionParams calldata positionParms)
        internal
        pure
        returns (uint160 postSwapSqrtRatioX96)
    {
				// stuff
		}
}
