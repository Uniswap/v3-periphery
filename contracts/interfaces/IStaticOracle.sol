// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

/// @title Uniswap V3 Static Oracle
/// @notice Oracle contract for calculating price quoting against Uniswap V3
interface IStaticOracle {

    /// @notice Returns the address of the Uniswap V3 factory
    /// @dev This value is assigned during deployment and cannot be changed
    /// @return The address of the Uniswap V3 factory
    function factory() external view returns (IUniswapV3Factory);

    /// @notice Returns how many observations are needed per minute in Uniswap V3 oracles, on the deployed chain
    /// @dev This value is assigned during deployment and cannot be changed
    /// @return Number of observation that are needed per minute
    function cardinalityPerMinute() external view returns (uint8);

    /// @notice Returns all supported fee tiers
    /// @return The supported fee tiers
    function supportedFeeTiers() external view returns (uint24[] memory);

    /// @notice Returns a quote, based on the given tokens and amount, by querying all of the pair's pools
    /// @dev If some pools are not configured correctly for the given period, then they will be ignored
    /// @dev Will revert if there are no pools available/configured for the pair and period combination
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    /// @return queriedPools The pools that were queried to calculate the quote
    function quoteAllAvailablePoolsWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint32 period
    ) external view returns (uint256 quoteAmount, address[] memory queriedPools);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified fee tiers
    /// @dev Will revert if the pair does not have a pool for one of the given fee tiers, or if one of the pools
    /// is not prepared/configured correctly for the given period
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param feeTiers The fee tiers to consider when calculating the quote
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    /// @return queriedPools The pools that were queried to calculate the quote
    function quoteSpecificFeeTiersWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint24[] calldata feeTiers,
        uint32 period
    ) external view returns (uint256 quoteAmount, address[] memory queriedPools);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified pools
    /// @dev Will revert if one of the pools is not prepared/configured correctly for the given period
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param pools The pools to consider when calculating the quote
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quoteSpecificPoolsWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] calldata pools,
        uint32 period
    ) external view returns (uint256 quoteAmount);

    /// @notice Will initialize all existing pools for the given pair, so that they can be queried with the given period in the future
    /// @dev Will revert if there are no pools available for the pair and period combination
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param period The period that will be guaranteed when quoting
    /// @return preparedPools The pools that were prepared
    function prepareAllAvailablePoolsWithTimePeriod(address tokenA, address tokenB, uint32 period) external returns (address[] memory preparedPools);
    
    /// @notice Will initialize the pair's pools with the specified fee tiers, so that they can be queried with the given period in the future
    /// @dev Will revert if the pair does not have a pool for a given fee tier
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param feeTiers The fee tiers to consider when searching for the pair's pools
    /// @param period The period that will be guaranteed when quoting
    /// @return preparedPools The pools that were prepared
    function prepareSpecificFeeTiersWithTimePeriod(address tokenA, address tokenB, uint24[] calldata feeTiers, uint32 period) external returns (address[] memory preparedPools);

    /// @notice Will initialize all given pools, so that they can be queried with the given period in the future
    /// @param pools The pools to initialize
    /// @param period The period that will be guaranteed when quoting
    function prepareSpecificPoolsWithTimePeriod(address[] calldata pools, uint32 period) external;    

    /// @notice Adds support for a new fee tier
    /// @dev Will revert if the given tier is invalid, or already supported
    /// @param feeTier The new fee tier to add    
    function addNewFeeTeer(uint24 feeTier) external;

}