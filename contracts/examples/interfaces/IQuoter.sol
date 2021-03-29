// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;
pragma abicoder v2;

/// @title Quoter
interface IQuoter {
    function exactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut);

    function exactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn);
}
