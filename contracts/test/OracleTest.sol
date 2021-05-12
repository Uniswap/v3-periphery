// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/OracleLibrary.sol';

contract OracleTest {
    function consult(
        address factory,
        address token0,
        address token1,
        uint24 fee,
        uint32 period
    ) public view returns (int24 tick) {
        tick = OracleLibrary.consult(factory, token0, token1, fee, period);
    }

    function getQuoteAtTick(
        int24 tick,
        uint256 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }

    // For gas snapshot test
    function getGasCostOfConsult(
        address factory,
        address token0,
        address token1,
        uint24 fee,
        uint32 period
    ) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        OracleLibrary.consult(factory, token0, token1, fee, period);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetQuoteAtTick(
        int24 tick,
        uint256 baseAmount,
        address baseToken,
        address quoteToken
    ) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
        return gasBefore - gasleft();
    }
}
