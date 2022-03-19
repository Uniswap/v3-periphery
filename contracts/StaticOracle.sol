// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import './interfaces/IStaticOracle.sol';
import './libraries/PoolAddress.sol';
import './libraries/OracleLibrary.sol';

/// @title Uniswap V3 Static Oracle
/// @notice Oracle contract price quoting against Uniswap V3 pools
contract StaticOracle is IStaticOracle{

    /// @inheritdoc IStaticOracle
    address public override immutable factory;
    /// @inheritdoc IStaticOracle
    uint8 public immutable override cardinalityPerMinute;
    uint24[] private knownFeeTiers;
    uint32[4] private resistancePeriods;

    constructor(address _factory, uint32[4] memory _resistancePeriods, uint8 _cardinalityPerMinute) {
        factory = _factory;
        resistancePeriods = _resistancePeriods;
        cardinalityPerMinute = _cardinalityPerMinute;

        // Assign default fee tiers
        knownFeeTiers.push(300);
        knownFeeTiers.push(5000);
        knownFeeTiers.push(10000);
    }

    /// @inheritdoc IStaticOracle
    function periodForResistanceLevel(ManipulationResistance resistance) public override view returns (uint32) {
        return resistancePeriods[uint256(resistance)];
    }    

    /// @inheritdoc IStaticOracle
    function supportedFeeTiers() external override view returns (uint24[] memory) {
        return knownFeeTiers;
    }

    /// @inheritdoc IStaticOracle
    function quoteAllAvailablePoolsWithResistanceLevel(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        ManipulationResistance resistance
    ) external override view returns (uint256 quoteAmount) {
        return quoteAllAvailablePoolsWithTimePeriod(baseAmount, baseToken, quoteToken, periodForResistanceLevel(resistance));
    }

    /// @inheritdoc IStaticOracle
    function quoteSpecificFeeTiersWithResistanceLevel(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint24[] memory feeTiers,
        ManipulationResistance resistance
    ) external override view returns (uint256 quoteAmount) {
        return quoteSpecificFeeTiersWithTimePeriod(baseAmount, baseToken, quoteToken, feeTiers, periodForResistanceLevel(resistance));
    }

    /// @inheritdoc IStaticOracle
    function quoteSpecificPoolsWithResistanceLevel(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] memory pools,
        ManipulationResistance resistance
    ) external override view returns (uint256 quoteAmount) {
       return quoteSpecificPoolsWithTimePeriod(baseAmount, baseToken, quoteToken, pools, periodForResistanceLevel(resistance));
    }

    /// @inheritdoc IStaticOracle
    function quoteAllAvailablePoolsWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint32 period
    ) public override view returns (uint256 quoteAmount) {
        (address[] memory queryablePools, uint256 definedPools) = getQueryablePoolsForTiers(baseToken, quoteToken, period);
        require(definedPools > 0, 'No pools available');
        return internalQuote(baseAmount, baseToken, quoteToken, queryablePools, definedPools, period);
    }    

    /// @inheritdoc IStaticOracle
    function quoteSpecificFeeTiersWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        uint24[] memory feeTiers,
        uint32 period
    ) public override view returns (uint256 quoteAmount) {
        (address[] memory pools, uint256 definedPools) = getPoolsForTiers(baseToken, quoteToken, feeTiers);
        require(pools.length == definedPools, 'Given tier does not have pool');
        return internalQuote(baseAmount, baseToken, quoteToken, pools, definedPools, period);
    }

    /// @inheritdoc IStaticOracle
    function quoteSpecificPoolsWithTimePeriod(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] memory pools,
        uint32 period
    ) public override view returns (uint256 quoteAmount) {
       return internalQuote(baseAmount, baseToken, quoteToken, pools, pools.length, period);
    }

    /// @inheritdoc IStaticOracle
    function prepareAllAvailablePoolsWithResistanceLevel(address tokenA, address tokenB, ManipulationResistance resistance) external override {
        prepareAllAvailablePoolsWithTimePeriod(tokenA, tokenB, periodForResistanceLevel(resistance));
    }

    /// @inheritdoc IStaticOracle
    function prepareSpecificFeeTiersWithResistanceLevel(address tokenA, address tokenB, uint24[] calldata feeTiers, ManipulationResistance resistance) external override {
        prepareSpecificFeeTiersWithTimePeriod(tokenA, tokenB, feeTiers, periodForResistanceLevel(resistance));
    }

    /// @inheritdoc IStaticOracle
    function prepareSpecificPoolsWithResistanceLevel(address[] calldata pools, ManipulationResistance resistance) external override {
        prepareSpecificPoolsWithTimePeriod(pools, periodForResistanceLevel(resistance));
    }    

    /// @inheritdoc IStaticOracle
    function prepareAllAvailablePoolsWithTimePeriod(address tokenA, address tokenB, uint32 period) public override {
        (address[] memory pools, uint definedPools) = getPoolsForTiers(tokenA, tokenB, knownFeeTiers);
        require(definedPools > 0, 'No pools available');
        internalPrepare(pools, definedPools, period);
    }    

    /// @inheritdoc IStaticOracle
    function prepareSpecificFeeTiersWithTimePeriod(address tokenA, address tokenB, uint24[] memory feeTiers, uint32 period) public override {
        (address[] memory pools, uint definedPools) = getPoolsForTiers(tokenA, tokenB, feeTiers);
        require(pools.length == definedPools, 'Given tier does not have pool');
        internalPrepare(pools, definedPools, period);
    }

    /// @inheritdoc IStaticOracle
    function prepareSpecificPoolsWithTimePeriod(address[] memory pools, uint32 period) public override {
        internalPrepare(pools, pools.length, period);
    }    

    /// @inheritdoc IStaticOracle
    function addNewFeeTeer(uint24 feeTier) external override {
        require(IUniswapV3Factory(factory).feeAmountTickSpacing(feeTier) != 0, 'Invalid fee tier');
        for (uint i; i < knownFeeTiers.length; i++) {
            require(knownFeeTiers[i] != feeTier, 'Tier already supported');
        }
        knownFeeTiers.push(feeTier);
    }

    function internalPrepare(address[] memory pools, uint definedPools, uint32 period) private {
        uint16 cardinality = uint16((period * cardinalityPerMinute) / 60) + 1; // We add 1 just to be on the safe side
        for (uint i; i < definedPools; i++) {
            IUniswapV3Pool(pools[i]).increaseObservationCardinalityNext(cardinality);
        }
    }

    function internalQuote(
        uint128 baseAmount, 
        address baseToken,
        address quoteToken,
        address[] memory pools,
        uint definedPools,
        uint32 period
    ) private view returns (uint256 quoteAmount) {
        require(definedPools > 0, 'No defined pools');

        OracleLibrary.WeightedTickData[] memory tickData = new OracleLibrary.WeightedTickData[](definedPools);
        for (uint256 i; i < definedPools; i++) {
            (tickData[i].tick, tickData[i].weight) = period > 0
                ? OracleLibrary.consult(pools[i], period)
                : OracleLibrary.getBlockStartingTickAndLiquidity(pools[i]);
        }

        int24 weightedTick = tickData.length == 1
            ? tickData[0].tick
            : OracleLibrary.getWeightedArithmeticMeanTick(tickData);
        return OracleLibrary.getQuoteAtTick(weightedTick, baseAmount, baseToken, quoteToken);
    }    

    /// @notice Takes a pair and a time period, and returns all pools that could be queried for that period
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param period The period that we want to query for
    /// @return queryablePools All pools that can be queried
    /// @return amount How many of the elements in `queryablePools` are actually defined
    function getQueryablePoolsForTiers(         
        address tokenA,
        address tokenB,
        uint32 period
    ) private view returns (address[] memory queryablePools, uint amount) {        
        (address[] memory existingPools, uint definedPools) = getPoolsForTiers(tokenA, tokenB, knownFeeTiers);
        queryablePools = new address[](definedPools);
        for (uint i; i < definedPools; i++) {
            if (OracleLibrary.getOldestObservationSecondsAgo(existingPools[i]) >= period) {
                queryablePools[amount++] = existingPools[i];
            }
        }
    }
    
    /// @notice Takes a pair and some fee tiers, and returns all pools that match those tiers
    /// @param tokenA One of the pair's tokens
    /// @param tokenB The other of the pair's tokens
    /// @param feeTiers The fee tiers to consider when searching for the pair's pools
    /// @return pools The pools for the given pair and fee tiers
    /// @return definedPools How many of the elements in `pools` are actually defined
    function getPoolsForTiers(address tokenA, address tokenB, uint24[] memory feeTiers) private view returns (address[] memory pools, uint definedPools) {        
        pools = new address[](feeTiers.length);
        for (uint i; i < feeTiers.length; i++) {
            address pool = PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(tokenA, tokenB, feeTiers[i]));
            if (pool != address(0)) {
                pools[definedPools++] = pool;
            }
        }
    }    
}