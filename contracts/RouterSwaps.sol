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

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    struct SwapStaticData {
        uint256 maxAmountIn;
        address payer;
    }
    SwapStaticData private swapStaticData;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        bytes memory path,
        address recipient,
        uint256 deadline
    ) external override {
        revert('unimplemented');
    }

    /// @inheritdoc IRouterSwaps
    function swapTokensForExactTokens(swapForExactParams calldata params) external override {
        // derive zeroForOne
        (address tokenA, address tokenB, ) = params.path.get(0).decode();
        bool zeroForOne = !(tokenA < tokenB);

        uint160 limit = zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

        // we don't need to send this data through the callback
        swapStaticData = SwapStaticData({maxAmountIn: params.maxAmountIn, payer: msg.sender});

        // this is happening in reverse
        IUniswapV3Pool(params.path.peekPool(this.factory())).swap(
            params.recipient,
            zeroForOne,
            // positive number = exact in
            -params.amountOut.toInt256(),
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

        // decide if we need to forward it to the next pair or pay up
        path.hasPairs() ? forward(amount0Delta, amount1Delta, path) : pay(amount0Delta, amount1Delta, path);
    }

    // TODO remove the token{0,1} from this function
    function forward(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes memory path
    ) private {
        // verifies that the thing comes from the correct place
        {
            (address tokenA, address tokenB, uint24 fee) = path.get(0).decode();
            verifyCallback(PoolAddress.PoolKey({tokenA: tokenA, tokenB: tokenB, fee: fee}));
        }

        // gets the next pool
        IUniswapV3Pool nextPool = IUniswapV3Pool(path.get(1).peekPool(this.factory()));

        // figure out if we should send token0 or token1
        (address tokenToBePaid, int256 amountToBePaid) =
            amount0Delta > 0
                ? (IUniswapV3Pool(msg.sender).token0(), amount0Delta)
                : (IUniswapV3Pool(msg.sender).token1(), amount1Delta);

        // get the direction of the swap
        bool zeroForOne = tokenToBePaid == nextPool.token1();

        // get the limit of the swap
        uint160 limit = zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

        // send it
        nextPool.swap(msg.sender, zeroForOne, -amountToBePaid, limit, abi.encode(path.skip(1)));
    }

    function pay(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes memory path
    ) private {
        // verifies that the thing comes from the correct place
        (address tokenA, address tokenB, uint24 fee) = path.get(0).decode();
        verifyCallback(PoolAddress.PoolKey({tokenA: tokenA, tokenB: tokenB, fee: fee}));
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        (address token, uint256 amount) =
            amount0Delta > 0 ? (token0, uint256(amount0Delta)) : (token1, uint256(amount1Delta));
        require(swapStaticData.maxAmountIn >= amount, 'too much requested');
        TransferHelper.safeTransferFrom(token, swapStaticData.payer, msg.sender, amount);
        delete swapStaticData;
    }
}
