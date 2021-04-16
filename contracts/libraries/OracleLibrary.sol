// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolDerivedState.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import 'hardhat/console.sol';

library OracleLibrary {
    function consult(
        uint32 time,
        address poolAddress,
        uint32 startBlockTimestamp,
        uint32 endBlockTimestamp
    ) public view returns (uint256 ratioX128) {
        require(startBlockTimestamp < endBlockTimestamp, 'Bad range');
        IUniswapV3PoolDerivedState oracle = IUniswapV3PoolDerivedState(poolAddress);

        uint32[] memory secondAgos = new uint32[](2);
        secondAgos[0] = time - startBlockTimestamp;
        secondAgos[1] = time - endBlockTimestamp;

        (int56[] memory tickCumulatives, ) = oracle.observe(secondAgos);
        int24 tick = int24((tickCumulatives[1] - tickCumulatives[0]) / int56(endBlockTimestamp - startBlockTimestamp));

        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
    }
}
