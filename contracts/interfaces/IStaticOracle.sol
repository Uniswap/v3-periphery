// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

/// @title Uniswap V3 Static Oracle
/// @notice Oracle contract for calculating price quoting against Uniswap V3
interface IStaticOracle {

    /// @notice Levels of manipulation resistance that can be used when asking for quotes
    enum ManipulationResistance {
        Dangerous,
        Weak,
        Medium,
        Strong
    }

    /// @notice Returns the address of the Uniswap V3 factory
    /// @dev This value is assigned during deployment and cannot be changed
    /// @return The address of the Uniswap V3 factory
    function factory() external view returns (address);

    /// @notice Returns how many observations can be taken per minute in Uniswap V3 oracles
    /// @dev This value is assigned during deployment and cannot be changed
    /// @return The cardinality per minute
    function cardinalityPerMinute() external view returns (uint8);

    /// @notice Returns, in seconds, the assigned period to the given resistance level
    /// @dev These values are assigned during deployment and cannot be changed
    /// @param resistance The resistance level to ask for
    /// @return The period assigned to the given resistance level
    function periodForResistanceLevel(ManipulationResistance resistance) external view returns (uint32);

    /// @notice Returns all supported fee tiers
    /// @return The supported fee tiers
    function supportedFeeTiers() external view returns (uint24[] memory);

    /// @notice Returns a quote, based on the given tokens and amount, by querying all of the pair's pools
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param resistance The resistance level desired for the quote
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        ManipulationResistance resistance
    ) external view returns (uint256 quoteAmount);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified fee tiers
    /// @dev Will revert if the pair does not have a pool for a given fee tier
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param feeTiers The fee tiers to consider when calculating the quote
    /// @param resistance The resistance level desired for the quote
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint24[] memory feeTiers,
        ManipulationResistance resistance
    ) external view returns (uint256 quoteAmount);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified pools
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param pools The pools to consider when calculating the quote
    /// @param resistance The resistance level desired for the quote
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] memory pools,
        ManipulationResistance resistance
    ) external view returns (uint256 quoteAmount);

    /// @notice Returns a quote, based on the given tokens and amount, by querying all of the pair's pools
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint32 period
    ) external view returns (uint256 quoteAmount);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified fee tiers
    /// @dev Will revert if the pair does not have a pool for a given fee tier
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param feeTiers The fee tiers to consider when calculating the quote
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint24[] memory feeTiers,
        uint32 period
    ) external view returns (uint256 quoteAmount);

    /// @notice Returns a quote, based on the given tokens and amount, by querying only the specified pools
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @param pools The pools to consider when calculating the quote
    /// @param period Number of seconds from which to calculate the TWAP
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function quote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] memory pools,
        uint32 period
    ) external view returns (uint256 quoteAmount);

    /// @notice Will initialize all existing pools for the given pair, so that they can be queried with the given resistance level in the future
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param resistance The resistance level that will be guaranteed when quoting
    function prepare(address tokenA, address tokenB, ManipulationResistance resistance) external;

    /// @notice Will initialize the pair's pools with the specified fee tiers, so that they can be queried with the given resistance level in the future
    /// @dev Will revert if the pair does not have a pool for a given fee tier
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param feeTiers The fee tiers to consider when searching for the pair's pools
    /// @param resistance The resistance level that will be guaranteed when quoting
    function prepare(address tokenA, address tokenB, uint24[] calldata feeTiers, ManipulationResistance resistance) external;

    /// @notice Will initialize all given pools, so that they can be queried with the given resistance level in the future
    /// @param pools The pools to initialize
    /// @param resistance The resistance level that will be guaranteed when quoting
    function prepare(address[] calldata pools, ManipulationResistance resistance) external;
    
    /// @notice Will initialize all existing pools for the given pair, so that they can be queried with the given period in the future
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param period The period that will be guaranteed when quoting
    function prepare(address tokenA, address tokenB, uint32 period) external;
    
    /// @notice Will initialize the pair's pools with the specified fee tiers, so that they can be queried with the given period in the future
    /// @dev Will revert if the pair does not have a pool for a given fee tier
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param feeTiers The fee tiers to consider when searching for the pair's pools
    /// @param period The period that will be guaranteed when quoting
    function prepare(address tokenA, address tokenB, uint24[] memory feeTiers, uint32 period) external;

    /// @notice Will initialize all given pools, so that they can be queried with the given period in the future
    /// @param pools The pools to initialize
    /// @param period The period that will be guaranteed when quoting
    function prepare(address[] memory pools, uint32 period) external;    

    /// @notice Adds support for a new fee tier
    /// @dev Will revert if the given tier is invalid, or already supported
    /// @param feeTier The new fee tier to add    
    function addNewFeeTeer(uint24 feeTier) external;

}