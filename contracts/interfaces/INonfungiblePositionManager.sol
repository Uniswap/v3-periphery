// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import './external/IERC721Metadata.sol';

/// @title Non-fungible position manager
/// @notice Non-fungible token wrapper for Uniswap V3 Positions
interface INonfungiblePositionManager is IERC721Metadata {
    /// @notice Returns the position information associated with a given token ID.
    function positions(uint256)
        external
        view
        returns (
            address owner,
            address operator,
            address pool,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 feesOwed0,
            uint128 feesOwed1
        );
}
