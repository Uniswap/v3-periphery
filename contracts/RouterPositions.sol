// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterPositions.sol';
import './libraries/PoolAddress.sol';
import './RouterHelpers.sol';

/// @title Logic for positions
abstract contract RouterPositions is IRouterImmutableState, IRouterPositions, RouterHelpers {
    /// @inheritdoc IRouterPositions
    function createPairAndAddLiquidity(CreatePairAndAddLiquidityParams calldata params)
        external
        override
        checkDeadline(params.deadline)
    {
        IUniswapV3Pool pool =
            IUniswapV3Pool(IUniswapV3Factory(this.factory()).createPool(params.tokenA, params.tokenB, params.fee));

        pool.initialize(params.sqrtPriceX96);

        // max is irrelevant because the pool creator set the price
        _mint(pool, params.recipient, params.tickLower, params.tickUpper, params.amount, 0, 0);
    }

    /// @inheritdoc IRouterPositions
    function addLiquidity(AddLiquidityParams calldata params) external override checkDeadline(params.deadline) {
        IUniswapV3Pool pool =
            IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), params.tokenA, params.tokenB, params.fee));

        _mint(
            pool,
            params.recipient,
            params.tickLower,
            params.tickUpper,
            params.amount,
            params.amountAMax,
            params.amountBMax
        );
    }

    struct MintCallbackData {
        // used to compute the address of the pair
        address token0;
        address token1;
        uint24 fee;
        // used to protect the minter from price movement
        uint256 amount0Max;
        uint256 amount1Max;
    }

    function _mint(
        IUniswapV3Pool pool,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        uint256 amount0Max,
        uint256 amount1Max
    ) private {}

    /// @inheritdoc IUniswapV3MintCallback
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
        verifyCallback(decoded.token0, decoded.token1, decoded.fee);
    }

    /// @inheritdoc IRouterPositions
    function removeLiquidity(RemoveLiquidityParams calldata params) external override {
        revert('TODO');
    }
}
