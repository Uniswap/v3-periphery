// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/TransferHelper.sol';
import '../interfaces/ISwapRouter.sol';

contract SwapExamples {
    //// For the scope of these swap examples, 
    //// we will detail design considerations when using 
    //// `exactInput`, `exactInputSingle`, `exactOutput`, and  `exactOutputSingle`.

    //// We purposefully pass in the swap router instead of inherit the swap router for simplicity.
    //// TBD: (can maybe document somewhere some warnings of inheriting the swap router)
    //// (More advanced examples will dive into how to inherit the swap router safely.)

    ISwapRouter swapRouter;
    //// if we wanted to hardcode to make the example easier to follow as a true example?
    //// This example swaps DAI/WETH for single path swaps and USDC/DAI/WETH for multi path swaps.

    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    constructor(
        ISwapRouter _swapRouter
        
    ) {
        swapRouter = _swapRouter;
    }

    //// basic wrapper for calling exactInputSingle swap function
    function swapInputSingle(uint256 amountIn) external returns(uint256 amountOut) {
        //// For this example, we do a single path swap of DAI to ETH
        //// approve the router to spend DAI, will fail if not holding the inputted amount for DAI
        TransferHelper.safeApprove(DAI, address(swapRouter), amountIn);

        //// setting up the parameters necessary to swap

        amountOut = swapRouter.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: DAI, 
            tokenOut: WETH9,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 200,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }));
        //// trivially set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum
        //// set sqrtPriceLimitX96 to 0, see `exactInputInternal`
        

    }
    
}