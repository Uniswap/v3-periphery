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

        // add some extra buffer at the end required for the writing
        bytes memory result = new bytes(encodedLen + 32);

        // prepare the lookup table
        bytes memory table = TABLE;
        uint256 tablePtr;
        assembly {
            tablePtr := add(table, 1)
        }

        // input ptr
        uint256 dataPtr;
        assembly {
            dataPtr := data
        }
        uint256 endPtr = dataPtr + data.length;

        // result ptr, jump over length
        uint256 resultPtr;
        assembly {
            resultPtr := add(result, 32)
        }

        // run over the input, 3 bytes at a time
        while (dataPtr < endPtr) {
            dataPtr += 3;
            assembly {
                // read 3 bytes
                let input := mload(dataPtr)

                // write 4 characters
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(18, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(12, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(6, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(input, 0x3F)))))
                resultPtr := add(resultPtr, 1)
            }
        }

        // padding with '=''
        assembly {
            switch mod(mload(data), 3)
                case 1 {
                    mstore(sub(resultPtr, 2), shl(240, 0x3d3d))
                }
                case 2 {
                    mstore(sub(resultPtr, 1), shl(248, 0x3d))
                }
        }

        // set the actual output length
        assembly {
            mstore(result, encodedLen)
        }

        return string(result);
    }
}
