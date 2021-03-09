// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

/// @dev Provides functions for deriving a pool address from the factory, tokens, and the fee
library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH = 0xd4f1a40e4bf7e60d35149863dcd741cd4bb1f6b8e723b3140eca4a488aec8a51;

    // The identifying key of the pool
    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    function getPoolKey(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal pure returns (PoolKey memory) {
        return
            tokenA < tokenB
                ? PoolKey({token0: tokenA, token1: tokenB, fee: fee})
                : PoolKey({token0: tokenB, token1: tokenA, fee: fee});
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
