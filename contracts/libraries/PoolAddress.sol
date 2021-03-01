// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH = 0x783e0da8fafb06a0dd363900302567b2b3d107871626e0c1d793bd82942aaea8;

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
