// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/libraries/Oracle.sol';

contract MockAvailableObservations {
    uint16 private observationIndex;
    uint16 private observationCardinality;
    Oracle.Observation[65535] public observations;

    constructor(
        uint16[] memory indices,
        uint32[] memory blockTimestamps,
        bool[] memory initialized,

        uint16 _observationIndex,
        uint16 _observationCardinality
    ) {
        require(
            _observationIndex < _observationCardinality && 
            indices.length == blockTimestamps.length && 
            blockTimestamps.length == initialized.length,
            'Invalid test case size'
        );
        

        observationIndex = _observationIndex;
        observationCardinality = _observationCardinality;

        for (uint i; i < indices.length; i++) {
            observations[indices[i]] = Oracle.Observation({
                blockTimestamp: blockTimestamps[i],
                tickCumulative: 0,
                secondsPerLiquidityCumulativeX128: 0,
                initialized: initialized[i]
            });
        }
    }
    

    function slot0()
        external
        view
        returns (
            uint160,
            int24,
            uint16,
            uint16,
            uint16,
            uint8,
            bool
        )
    {
        return (0, 0, observationIndex, observationCardinality, 0, 0, true);
    }
}
