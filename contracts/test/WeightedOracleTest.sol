// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/WeightedOracleLibrary.sol';

contract WeightedOracleTest {

    function consult(address[] calldata pools, uint32 period) public view returns (WeightedOracleLibrary.TimeWeightedObservation[] memory observations) {
        observations = WeightedOracleLibrary.consult(pools, period);
    }

    function getArithmeticMeanWeightedTick(WeightedOracleLibrary.TimeWeightedObservation[] memory observations) public pure returns (int24 arithmeticMeanWeightedTick) {
        arithmeticMeanWeightedTick = WeightedOracleLibrary.getArithmeticMeanWeightedTick(observations);
    }

}
