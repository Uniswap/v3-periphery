// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IQuoterWithGas.sol';
import './Quoter.sol';


/// @title Provides quotes for swaps and an estimate for gas usage.
/// @notice Allows getting the expected amount out or amount in for a given swap without executing the swap. Also provides a gas usage estimate for the swap.
/// @dev These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
/// the swap and check the amounts in the callback.
contract QuoterWithGas is Quoter, IQuoterWithGas {

    constructor(address _factory, address _WETH9) Quoter(_factory, _WETH9) {}
    
    /// @inheritdoc IQuoterWithGas
    function quoteExactInputSingleWithGas(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) public override returns (uint256 amountOut, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        amountOut = Quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96);
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactInputWithGas(
        bytes memory path, 
        uint256 amountIn
    ) external override returns (uint256 amountOut, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        amountOut = Quoter.quoteExactInput(path, amountIn);
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactOutputSingleWithGas(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) public override returns (uint256 amountIn, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        amountIn = Quoter.quoteExactOutputSingle(tokenIn, tokenOut, fee, amountOut, sqrtPriceLimitX96);
        gasUsed = gasBefore - gasleft();
    }

    /// @inheritdoc IQuoterWithGas
    function quoteExactOutputWithGas(
        bytes memory path, 
        uint256 amountOut
    ) external override returns (uint256 amountIn, uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        amountIn = Quoter.quoteExactOutput(path, amountOut);
        gasUsed = gasBefore - gasleft();
    }
}
