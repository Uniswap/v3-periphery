// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

/// @title Base64
/// @notice Provides a function for encoding some bytes in base64
/// @author Brecht Devos <brecht@loopring.org>
library Base64 {
    bytes internal constant TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    /// @notice Encodes some bytes to the base64 representation
    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return '';

        // multiply by 4/3 rounded up
        uint256 encodedLen = 4 * ((data.length + 2) / 3);

        // Add some extra buffer at the end
        bytes memory result = new bytes(encodedLen + 32);

        bytes memory table = TABLE;
        uint256 tablePtr;
        assembly {
            tablePtr := add(table, 1)
        }

        uint256 outOffset = 32;
        for (uint256 i = 0; i < data.length; ) {
            i += 3;
            uint256 input;
            assembly {
                input := and(mload(add(data, i)), 0xffffff)
            }

            assembly {
                let out := and(mload(add(tablePtr, and(shr(18, input), 0x3F))), 0xFF)
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(input, 0x3F))), 0xFF))
                out := shl(224, out)

                mstore(add(result, outOffset), out)
            }
            outOffset += 4;
        }

        // Padding
        uint256 r = data.length % 3;
        if (r != 0) {
            r = (r == 1) ? 2 : 1;
        }
        for (uint256 i = 0; i < r; i++) {
            result[encodedLen - 1 - i] = '=';
        }

        // Set the actual output length
        assembly {
            mstore(result, encodedLen)
        }

        return string(result);
    }
}
