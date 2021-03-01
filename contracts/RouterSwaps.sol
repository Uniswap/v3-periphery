// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/IRouterImmutableState.sol';
import './interfaces/IRouterSwaps.sol';
import './libraries/PoolAddress.sol';
import './libraries/Path.sol';
import './libraries/SafeCast.sol';
import './libraries/TransferHelper.sol';
import './RouterValidation.sol';

/// @title Logic for trading
abstract contract RouterSwaps is IRouterImmutableState, IRouterSwaps, RouterValidation {
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick, plus 1
    uint160 private constant MIN_SQRT_RATIO = 4295128739 + 1;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick, minus 1
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 - 1;

    struct SwapForExactData {
        uint256 maxAmountIn;
        address payer;
    }
    SwapForExactData private swapForExactData;

    /// @inheritdoc IRouterSwaps
    function swapTokensForExactTokens(swapForExactParams calldata params) external override {
        (address tokenA, address tokenB, uint24 fee) = params.path.decode();

        IUniswapV3Pool pool =
            IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), PoolAddress.getPoolKey(tokenA, tokenB, fee)));

        bool zeroForOne = tokenB < tokenA; // we're swapping in reverse (exact output)
        uint160 limit = zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;

        // we don't need to send this data through the callback
        swapForExactData = SwapForExactData({maxAmountIn: params.maxAmountIn, payer: msg.sender});

        pool.swap(
            params.recipient,
            zeroForOne,
            -params.amountOut.toInt256(), // negative number = exact output
            limit,
            abi.encode(params.path)
        );
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        // decode the callback data
        bytes memory path = abi.decode(data, (bytes));

        // verify the callback
        (address tokenA, address tokenB, uint24 fee) = path.decode();
        verifyCallback(PoolAddress.getPoolKey(tokenA, tokenB, fee));

        int256 amountToBePaid = amount0Delta > 0 ? amount0Delta : amount1Delta;

        // decide if we need to forward to the next pair or pay up
        path.hasPairs() ? forward(amountToBePaid, tokenB, path.skipOne()) : pay(uint256(amountToBePaid), tokenB);
    }

    function forward(
        int256 amountToBePaid,
        address tokenB,
        bytes memory pathNext
    ) private {
        (, address tokenC, uint24 fee) = pathNext.decode(); // tokenB is the other token

        // get the next pool
        IUniswapV3Pool nextPool =
            IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), PoolAddress.getPoolKey(tokenB, tokenC, fee)));

        bool zeroForOne = tokenC < tokenB;
        uint160 limit = zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;

        // send it
        nextPool.swap(msg.sender, zeroForOne, -amountToBePaid, limit, abi.encode(pathNext));
    }

    function pay(uint256 amountToBePaid, address tokenB) private {
        require(amountToBePaid <= swapForExactData.maxAmountIn, 'too much requested');
        TransferHelper.safeTransferFrom(tokenB, swapForExactData.payer, msg.sender, amountToBePaid);
        delete swapForExactData;
    }

    /// @inheritdoc IRouterSwaps
    function swapExactTokensForTokens(swapExactForParams calldata) external pure override {
        revert('unimplemented');
    }
}
