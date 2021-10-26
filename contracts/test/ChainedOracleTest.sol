// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/OracleLibrary.sol';

contract ChainedOracleTest {
    function getChainedPrice(address[] memory tokens, int24[] memory arithmeticMeanWeightedTicks)
        public
        view
        returns (int24 syntheticTick)
    {
        syntheticTick = OracleLibrary.getChainedPrice(tokens, arithmeticMeanWeightedTicks);
    }
}
