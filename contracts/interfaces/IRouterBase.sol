// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6;

interface IRouterBase {
    /// Gets the spot price for a given amount, by checking the pair's liquidit and current sqrt price
    function quote(
        uint256 amountA,
        uint128 liquidity,
        uint160 sqrtPriceX96
    ) external pure returns (uint256 amountB);

    /// Returns the UniswapV3 factory
    function factory() external pure returns (address);

    /// WETH's address
    function WETH() external pure returns (address);

    /// The amount to be received given `amountIn` to the provided `pair`
    function getAmountOut(uint256 amountIn, address pair) external pure returns (uint256 amountOut);

    /// The amount to be sent given `amountOut` to the provided `pair`
    function getAmountIn(uint256 amountOut, address pair) external pure returns (uint256 amountIn);

    function getAmountsOut(uint256 amountIn, bytes32[] calldata path) external view returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, bytes32[] calldata path) external view returns (uint256[] memory amounts);
}
