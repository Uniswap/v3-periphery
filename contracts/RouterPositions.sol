// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterPositions.sol';
import './libraries/PoolAddress.sol';
import './libraries/TransferHelper.sol';
import './RouterValidation.sol';

/// @title Logic for positions
abstract contract RouterPositions is IRouterImmutableState, IRouterPositions, RouterValidation {
    /// @inheritdoc IRouterPositions
    function createPoolAndAddLiquidity(CreatePoolAndAddLiquidityParams calldata params)
        public
        override
        checkDeadline(params.deadline)
    {
        IUniswapV3Pool pool =
            IUniswapV3Pool(IUniswapV3Factory(this.factory()).createPool(params.token0, params.token1, params.fee));

        pool.initialize(params.sqrtPriceX96);

        // max is irrelevant because the pool creator set the price
        _addLiquidity(
            pool,
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee}),
            params.recipient,
            params.tickLower,
            params.tickUpper,
            params.amount,
            type(uint256).max,
            type(uint256).max
        );
    }

    /// @inheritdoc IRouterPositions
    function addLiquidity(AddLiquidityParams calldata params) external override checkDeadline(params.deadline) {
        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});

        _addLiquidity(
            IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), poolKey)),
            poolKey,
            params.recipient,
            params.tickLower,
            params.tickUpper,
            params.amount,
            params.amount0Max,
            params.amount1Max
        );
    }

    struct MintCallbackData {
        // the pool key
        PoolAddress.PoolKey poolKey;
        // the address paying for the mint
        address payer;
        // used to protect the minter from price movement
        uint256 amount0Max;
        uint256 amount1Max;
    }

    function _addLiquidity(
        IUniswapV3Pool pool,
        PoolAddress.PoolKey memory poolKey,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        uint256 amount0Max,
        uint256 amount1Max
    ) internal {
        require(poolKey.token0 < poolKey.token1, 'Token order');
        MintCallbackData memory callbackData =
            MintCallbackData({payer: msg.sender, poolKey: poolKey, amount0Max: amount0Max, amount1Max: amount1Max});
        pool.mint(recipient, tickLower, tickUpper, amount, abi.encode(callbackData));
    }

    /// @inheritdoc IUniswapV3MintCallback
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
        verifyCallback(decoded.poolKey);
        require(amount0Owed <= decoded.amount0Max);
        require(amount1Owed <= decoded.amount1Max);

        if (amount0Owed > 0)
            TransferHelper.safeTransferFrom(decoded.poolKey.token0, decoded.payer, msg.sender, amount0Owed);
        if (amount1Owed > 0)
            TransferHelper.safeTransferFrom(decoded.poolKey.token1, decoded.payer, msg.sender, amount1Owed);
    }
}
