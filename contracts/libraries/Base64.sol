// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Base64
/// @notice Provides a function for encoding some bytes in base64
library Base64 {
    bytes internal constant TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    /// @notice Encodes some bytes to the base64 representation
    function encode(bytes memory data) internal pure returns (string memory) {
        uint256 bitLen = data.length * 8;
        if (bitLen == 0) return '';

        // multiply by 4/3 rounded up
        uint256 encodedLen = (data.length * 4 + 2) / 3;
        // result length must be a multiple of 4
        if (encodedLen % 4 != 0) encodedLen += 4 - (encodedLen % 4);

        bytes memory result = new bytes(encodedLen);

        for (uint256 i = 0; i < encodedLen; i++) {
            uint256 bitStartIndex = (i * 6);
            if (bitStartIndex >= bitLen) {
                result[i] = '=';
            } else {
                uint256 byteIndex = (bitStartIndex / 8);
                uint8 bsiMod8 = uint8(bitStartIndex % 8);
                if (bsiMod8 < 3) {
                    result[i] = TABLE[(uint8(data[byteIndex]) >> (2 - bsiMod8)) % 64];
                } else {
                    uint16 bytesCombined =
                        (uint16(uint8(data[byteIndex])) << 8) +
                            (byteIndex == data.length - 1 ? 0 : uint16(uint8(data[byteIndex + 1])));

                    uint8 c = uint8((bytesCombined >> uint8(10 - bsiMod8)) % 64);

                    result[i] = TABLE[c];
                }
            }
        }

        return string(result);
    }
}
