// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './libraries/PositionKey.sol';
import './RouterPositions.sol';

abstract contract NonfungiblePositionManager is INonfungiblePositionManager, ERC721, RouterPositions {
    struct Position {
        // details about the uniswap position
        // the pool of the position
        address pool;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected fees are held by this contract owed to the position, as of the last computation
        uint128 feesOwed0;
        uint128 feesOwed1;
    }

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 => Position) public override positions;

    uint64 private _nextId = 1;

    constructor() ERC721('Uniswap V3 Positions', 'UNI-V3-POS') {}

    /// @inheritdoc INonfungiblePositionManager
    function firstMint(FirstMintParams calldata params)
        external
        override
        checkDeadline(params.deadline)
        returns (uint256 tokenId)
    {
        IUniswapV3Pool pool =
            IUniswapV3Pool(IUniswapV3Factory(this.factory()).createPool(params.token0, params.token1, params.fee));

        pool.initialize(params.sqrtPriceX96);

        _addLiquidity(
            pool,
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee}),
            address(this),
            params.tickLower,
            params.tickUpper,
            params.liquidity,
            0,
            0
        );

        _mint(params.recipient, (tokenId = _nextId++));

        positions[tokenId] = Position({
            pool: address(pool),
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: params.liquidity,
            feeGrowthInside0LastX128: 0,
            feeGrowthInside1LastX128: 0,
            feesOwed0: 0,
            feesOwed1: 0
        });
    }

    /// @inheritdoc INonfungiblePositionManager
    function mint(MintParams calldata params)
        external
        override
        checkDeadline(params.deadline)
        returns (uint256 tokenId)
    {
        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(this.factory(), poolKey));

        _addLiquidity(
            pool,
            poolKey,
            address(this),
            params.tickLower,
            params.tickUpper,
            params.liquidity,
            params.amount0Max,
            params.amount1Max
        );

        _mint(params.recipient, (tokenId = _nextId++));

        bytes32 positionKey = PositionKey.compute(address(this), params.tickLower, params.tickUpper);

        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool.positions(positionKey);

        positions[tokenId] = Position({
            pool: address(pool),
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: params.liquidity,
            feeGrowthInside0LastX128: feeGrowthInside0LastX128,
            feeGrowthInside1LastX128: feeGrowthInside1LastX128,
            feesOwed0: 0,
            feesOwed1: 0
        });
    }
}
