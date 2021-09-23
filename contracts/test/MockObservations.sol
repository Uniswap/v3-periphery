// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

contract MockObservations {
    uint32[4] internal blockTimestamps;
    bool[4] internal initializeds;
    uint16 internal slot0ObservationCardinality;
    uint16 internal slot0ObservationIndex;

    constructor(
        uint32[4] memory _blockTimestamps,
        bool[4] memory _initializeds,
        uint16 _observationCardinality,
        uint16 _observationIndex
    ) {
        for (uint256 i = 0; i < _blockTimestamps.length; i++) {
            blockTimestamps[i] = _blockTimestamps[i];
            initializeds[i] = _initializeds[i];
        }

        slot0ObservationCardinality = _observationCardinality;
        slot0ObservationIndex = _observationIndex;
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
        return (0, 0, slot0ObservationIndex, slot0ObservationCardinality, 0, 0, false);
    }

    function observations(uint256 index)
        external
        view
        returns (
            uint32,
            int56,
            uint160,
            bool
        )
    {
        return (blockTimestamps[index], 0, 0, initializeds[index]);
    }
}
