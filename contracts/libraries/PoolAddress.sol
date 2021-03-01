// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH = 0x8886bc6f6f4cfd4c473fbc60a57ebf893a4c53e122a8324389097bfa3850b6b9;

    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    function computeAddress(address factory, PoolKey memory key) internal pure returns (address pool) {
        require(key.token0 < key.token1);
        pool = address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        hex'ff',
                        factory,
                        keccak256(abi.encode(key.token0, key.token1, key.fee)),
                        POOL_INIT_CODE_HASH
                    )
                )
            )
        );
    }
}
