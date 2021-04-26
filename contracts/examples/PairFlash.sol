// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

import '../base/PeripheryPayments.sol';
import '../base/PeripheryImmutableState.sol';

import '../libraries/PoolAddress.sol';
import '../libraries/CallbackValidation.sol';
import '../libraries/TransferHelper.sol';

import '../SwapRouter.sol';
import '../interfaces/ISwapRouter.sol';

abstract contract PairFlash is IUniswapV3FlashCallback, PeripheryImmutableState, PeripheryPayments, ISwapRouter {
    using LowGasSafeMath for uint256;
    
    // fee0 is the fee from calling flash for token0
    // fee1 is the fee from calling flash for token1
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external override {
        FlashCallbackData memory decoded = abi.decode(data, (FlashCallbackData));
        // more explicit decoding to get token variables
        CallbackValidation.verifyCallback(factory, decoded.poolKey);

        SwapRouter swapRouter = new SwapRouter(factory, WETH9);


        // approve router for transfer of token0
        TransferHelper.safeApprove(decoded.poolKey.token0, address(swapRouter), decoded.amount0);
        // approve router for transfer of token1
        TransferHelper.safeApprove(decoded.poolKey.token1, address(swapRouter), decoded.amount1);

        // define amount min to retrieve back, currently just the original amount plus the fee
        uint256 amount1Min = LowGasSafeMath.add(decoded.amount1, fee1);
        uint256 amount0Min = LowGasSafeMath.add(decoded.amount0, fee0);

        //ExactInputSingleParams inputSingleParams0 = ExactInputSingleParams({tokenIn: decoded.token1, tokenOut: decoded.token0, fee: decoded.poolFee1, recipient: decoded.payer, deadline: block.timestamp + 200, amountIn: decoded.amount1, amountOutMinimum: amount0Min, sqrtPriceLimitX96: 0 }) ;
        //ExactInputSingleParams inputSingleParams1 = ExactInputSingleParams({tokenIn: decoded.token0, tokenOut: decoded.token1, fee: decoded.poolFee2, recipient: decoded.payer, deadline: block.timestamp + 200, amountIn: decoded.amount0, amountOutMinimum: amount1Min, sqrtPriceLimitX96: 0 });
        
        // call exactInputSingle for swapping token1 for token0 in pool w/fee1
        uint256 amountOut0 = swapRouter.exactInputSingle(ExactInputSingleParams({tokenIn: decoded.poolKey.token1, tokenOut: decoded.poolKey.token0, fee: decoded.poolFee1, recipient: decoded.payer, deadline: block.timestamp + 200, amountIn: decoded.amount1, amountOutMinimum: amount0Min, sqrtPriceLimitX96: 0 }));

        // call exactInputSingle for swapping token0 for token 1 in pool w/fee2
        uint256 amountOut1 = swapRouter.exactInputSingle(ExactInputSingleParams({tokenIn: decoded.poolKey.token0, tokenOut: decoded.poolKey.token1, fee: decoded.poolFee2, recipient: decoded.payer, deadline: block.timestamp + 200, amountIn: decoded.amount0, amountOutMinimum: amount1Min, sqrtPriceLimitX96: 0 }));

        // end up with amountOut0 of token0 from first swap and amountOut1 of token1 from second swap

        uint256 amount0Owed = LowGasSafeMath.add(decoded.amount0, fee0);
        uint256 amount1Owed = LowGasSafeMath.add(decoded.amount1, fee1);

        // require profitable (amountOut0 - fee0 > amount0 && amountOut1 - fee1 > amount1)
        require(amountOut0 > amount0Owed);
        require(amountOut1 > amount1Owed);

        // pay back amount0 + fee0 and amount1 + fee1 to original pool (poolKey) and keep profits

        // pay original pool the amount of token0 plus fees and amount of token1 plus fees
        // with flash() must pay back the same token

        if (amount0Owed > 0) pay(decoded.poolKey.token0, decoded.payer, msg.sender, amount0Owed);
        if (amount1Owed > 0) pay(decoded.poolKey.token1, decoded.payer, msg.sender, amount1Owed);
    }
        //fee is the fee of the pool from the initial borrow 
        //fee1 is the fee of the first pool to arb from
        //fee2 is the fee of the second pool to arb from
        struct FlashParams {
        address token0;
        address token1;
        uint24 fee;
        address recipient;
        uint256 amount0;
        uint256 amount1;
        uint24 fee1;
        uint24 fee2;
    }
        // fee1 and fee2 are the two other fee pools associated with token0 and token1
        struct FlashCallbackData {
        uint256 amount0;
        uint256 amount1;
        address payer;
        PoolAddress.PoolKey poolKey;
        uint24 poolFee1;
        uint24 poolFee2;
    }

    function initFlash(FlashParams memory params) external {

        PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});
        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));
        // recipient of borrowed amounts
        // amount of token0 requested to borrow
        // amount of token1 requested to borrow
        // need amount 0 and amount1 in callback to pay back pool
        pool.flash(
            params.recipient,
            params.amount0,
            params.amount1,
            abi.encode(FlashCallbackData({amount0: params.amount0, amount1: params.amount1, payer: msg.sender, poolKey: poolKey, poolFee1: params.fee1, poolFee2: params.fee2}))
        );
    }

}
