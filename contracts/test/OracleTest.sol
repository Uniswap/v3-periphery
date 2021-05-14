// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/OracleLibrary.sol';

contract OracleTest {
    uint32[2] private POSITIVE_TICK_CASE = [uint32(11), uint32(0)];
    uint32[2] private NEGATIVE_TICK_CASE = [uint32(22), uint32(0)];

    // Mock observe for testing
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        if (secondsAgos[0] == POSITIVE_TICK_CASE[0] && secondsAgos[1] == POSITIVE_TICK_CASE[1]) {
            int56[] memory _tickCumulatives = new int56[](2);
            _tickCumulatives[0] = 109740;
            _tickCumulatives[1] = 421229;

            // Not used for now, so we can set it to 0
            uint160[] memory _secondsPerLiquidityCumulativeX128s = new uint160[](2);
            _secondsPerLiquidityCumulativeX128s[0] = 0;
            _secondsPerLiquidityCumulativeX128s[1] = 0;

            return (_tickCumulatives, _secondsPerLiquidityCumulativeX128s);
        } else if (secondsAgos[0] == NEGATIVE_TICK_CASE[0] && secondsAgos[1] == NEGATIVE_TICK_CASE[1]) {
            int56[] memory _tickCumulatives = new int56[](2);
            _tickCumulatives[0] = -109746;
            _tickCumulatives[1] = -421246;

            // Not used for now, so we can set it to 0
            uint160[] memory _secondsPerLiquidityCumulativeX128s = new uint160[](2);
            _secondsPerLiquidityCumulativeX128s[0] = 0;
            _secondsPerLiquidityCumulativeX128s[1] = 0;

            return (_tickCumulatives, _secondsPerLiquidityCumulativeX128s);
        } else {
            // Revert if no call value matched
            revert('Invalid calldata');
        }
    }

    function consult(address pool, uint32 period) public view returns (int24 timeWeightedAverageTick) {
        timeWeightedAverageTick = OracleLibrary.consult(pool, period);
    }

    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }

    // For gas snapshot test
    function getGasCostOfConsult(address pool, uint32 period) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        OracleLibrary.consult(pool, period);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
        return gasBefore - gasleft();
    }
}
