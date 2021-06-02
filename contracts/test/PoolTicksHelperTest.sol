// SPDX-License-Identifier: GPL-2.0-or-later
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

pragma solidity >=0.6.0;

import '../libraries/PoolTicksHelper.sol';

contract PoolTicksHelperTest {
    using PoolTicksHelper for IUniswapV3Pool;
    IUniswapV3Pool public pool;

    function setPool(IUniswapV3Pool _pool) external {
        pool = _pool;
    }

    function countInitializedBitsCrossed(int24 tickBefore, int24 tickAfter) external view returns (uint32 initializedTicksCrossed) {
        return pool.countInitializedBitsCrossed(tickBefore, tickAfter);
    }

}