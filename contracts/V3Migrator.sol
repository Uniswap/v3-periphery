// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import './interfaces/INonfungiblePositionManager.sol';

import './libraries/PoolAddress.sol';
import './libraries/TransferHelper.sol';

import './libraries/LiquidityAmounts.sol';
import './interfaces/IV3Migrator.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/SelfPermit.sol';
import './interfaces/external/IWETH9.sol';

/// @title Uniswap V3 Migrator
contract V3Migrator is IV3Migrator, PeripheryImmutableState, Multicall, SelfPermit {
    address public immutable nonfungiblePositionManager;

    constructor(
        address _factory,
        address _WETH9,
        address _nonfungiblePositionManager
    ) PeripheryImmutableState(_factory, _WETH9) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    receive() external payable {
        require(msg.sender == WETH9, 'Not WETH9');
    }

    // wrap createAndInitializePoolIfNecessary for use in multicall
    function createAndInitializePoolIfNecessary(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external override {
        INonfungiblePositionManager(nonfungiblePositionManager).createAndInitializePoolIfNecessary(
            tokenA,
            tokenB,
            fee,
            sqrtPriceX96
        );
    }

    function migrate(MigrateParams calldata params) external override {
        // burn v2 liquidity to this address
        IUniswapV2Pair(params.pair).transferFrom(msg.sender, params.pair, params.liquidityToMigrate);
        (uint256 amount0V2, uint256 amount1V2) = IUniswapV2Pair(params.pair).burn(address(this));

        // approve the position manager up to the maximum token amounts
        TransferHelper.safeApprove(params.token0, nonfungiblePositionManager, amount0V2);
        TransferHelper.safeApprove(params.token1, nonfungiblePositionManager, amount1V2);

        // mint v3 position
        (, uint128 liquidityV3, uint256 amount0V3, uint256 amount1V3) =
            INonfungiblePositionManager(nonfungiblePositionManager).mint(
                INonfungiblePositionManager.MintParams({
                    token0: params.token0,
                    token1: params.token1,
                    fee: params.fee,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    amount0Desired: amount0V2,
                    amount1Desired: amount1V2,
                    amount0Min: 0, // slippage check is on liquidity
                    amount1Min: 0, // slippage check is on liquidity
                    recipient: params.recipient,
                    deadline: params.deadline
                })
            );

        require(liquidityV3 >= params.liquidityV3Min, 'Excessive price impact');

        // if necessary, clear allowance and refund dust
        if (amount0V3 < amount0V2) {
            TransferHelper.safeApprove(params.token0, nonfungiblePositionManager, 0);

            uint256 refund0 = amount0V2 - amount0V3;
            if (params.refundAsETH && params.token0 == WETH9) {
                IWETH9(WETH9).withdraw(refund0);
                TransferHelper.safeTransferETH(msg.sender, refund0);
            } else {
                TransferHelper.safeTransfer(params.token0, msg.sender, refund0);
            }
        }
        if (amount1V3 < amount1V2) {
            TransferHelper.safeApprove(params.token1, nonfungiblePositionManager, 0);

            uint256 refund1 = amount1V2 - amount1V3;
            if (params.refundAsETH && params.token1 == WETH9) {
                IWETH9(WETH9).withdraw(refund1);
                TransferHelper.safeTransferETH(msg.sender, refund1);
            } else {
                TransferHelper.safeTransfer(params.token1, msg.sender, refund1);
            }
        }
    }
}
