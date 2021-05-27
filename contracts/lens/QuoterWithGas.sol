// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IQuoterWithGas.sol';
import './Quoter2.sol';


/// @title Provides quotes for swaps and an estimate for gas usage.
/// @notice Allows getting the expected amount out or amount in for a given swap without executing the swap. Also provides a gas usage estimate for the swap.
/// @dev These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
/// the swap and check the amounts in the callback.
contract QuoterWithGas is Quoter2, IQuoterWithGas {

    constructor(address _factory, address _WETH9) Quoter2(_factory, _WETH9) {}
    
    /// @inheritdoc IQuoterWithGas
    function quoteExactInputSingleWithGas(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) public override returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        (amountOut, sqrtPriceX96After, initializedTicksCrossed) = Quoter2.quoteExactInputSingle(
            QuoteExactInputSingleParams(tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96)
        );
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactInputWithGas(
        bytes memory path, 
        uint256 amountIn
    ) public override returns (
        uint256 amountOut,
        uint160[] memory sqrtPriceX96AfterList, 
        uint32[] memory initializedTicksCrossedList, 
        uint256 gasUsed
    ) {
        uint256 gasBefore = gasleft();
        (amountOut, sqrtPriceX96AfterList, initializedTicksCrossedList) = Quoter2.quoteExactInput(path, amountIn);
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactOutputSingleWithGas(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) public override returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        (amountIn, sqrtPriceX96After, initializedTicksCrossed) = Quoter2.quoteExactOutputSingle(
            QuoteExactOutputSingleParams(tokenIn, tokenOut, amountOut, fee, sqrtPriceLimitX96)
        );
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactOutputWithGas(
        bytes memory path, 
        uint256 amountOut
    ) public override returns (
        uint256 amountIn,
        uint160[] memory sqrtPriceX96AfterList, 
        uint32[] memory initializedTicksCrossedList, 
        uint256 gasUsed
    ) {
        uint256 gasBefore = gasleft();
        (amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList) = Quoter2.quoteExactOutput(path, amountOut);
        gasUsed = gasBefore - gasleft();
    }
}
