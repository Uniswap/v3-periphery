// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/WeightedOracleLibrary.sol';

contract WeightedOracleTest {

    function consult(address[] calldata pools, uint32 period) public view returns (int24 liquidityTimeWeightedAverageTick) {
        liquidityTimeWeightedAverageTick = WeightedOracleLibrary.consult(pools, period);
    }

    function consultPool(address pool, uint32 period, uint32[] memory secondsAgos, uint160 periodX128) public view returns (int24 timeWeightedAverageTick, uint128 liquidityWeight) {
        (timeWeightedAverageTick, liquidityWeight) = WeightedOracleLibrary.consultPool(pool, period, secondsAgos, periodX128);
    }

}
