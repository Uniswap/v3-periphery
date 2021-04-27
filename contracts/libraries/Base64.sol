// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Base64
/// @notice Provides a function for encoding some bytes in base64
library Base64 {
    bytes32 internal constant TABLE0 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
    bytes32 internal constant TABLE1 = 'ghijklmnopqrstuvwxyz0123456789+/';

    byte internal constant FILLER = '=';

    /// @notice Encodes some bytes to the base64 representation
    /// @dev Adapted from https://github.com/OpenZeppelin/solidity-jwt/blob/6ce4f3849005ded461b4c534c907b6d685feaac7/contracts/Base64.sol
    function encode(bytes memory data) internal pure returns (string memory) {
        uint256 rem = data.length % 3;

        uint256 encodedLength = (data.length * 4 + 2) / 3;
        if (encodedLength % 4 != 0) encodedLength += 4 - (encodedLength % 4);
        bytes memory result = new bytes(encodedLength);

        uint256 j = 0;

        for (uint256 i = 0; i + 3 <= data.length; i += 3) {
            (result[j], result[j + 1], result[j + 2], result[j + 3]) = encode3(
                uint8(data[i]),
                uint8(data[i + 1]),
                uint8(data[i + 2])
            );

            j += 4;
        }

        if (rem != 0) {
            uint8 la0 = uint8(data[data.length - rem]);
            uint8 la1 = 0;

            if (rem == 2) {
                la1 = uint8(data[data.length - 1]);
            }

            (byte b0, byte b1, byte b2, ) = encode3(la0, la1, 0);
            result[j] = b0;
            result[j + 1] = b1;
            if (rem == 2) {
                result[j + 2] = b2;
                result[j + 3] = FILLER;
            } else {
                result[j + 2] = FILLER;
                result[j + 3] = FILLER;
            }
        }

        return string(result);
    }

    function encode3(
        uint256 a0,
        uint256 a1,
        uint256 a2
    )
        private
        pure
        returns (
            byte b0,
            byte b1,
            byte b2,
            byte b3
        )
    {
        uint256 n = (a0 << 16) | (a1 << 8) | a2;

        uint256 c0 = (n >> 18) & 63;
        uint256 c1 = (n >> 12) & 63;
        uint256 c2 = (n >> 6) & 63;
        uint256 c3 = (n) & 63;

        b0 = c0 < 32 ? TABLE0[c0] : TABLE1[c0 - 32];
        b1 = c1 < 32 ? TABLE0[c1] : TABLE1[c1 - 32];
        b2 = c2 < 32 ? TABLE0[c2] : TABLE1[c2 - 32];
        b3 = c3 < 32 ? TABLE0[c3] : TABLE1[c3 - 32];
    }
}
