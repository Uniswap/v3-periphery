// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint128.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './libraries/PositionKey.sol';
import './base/LiquidityManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';

/// @title NFT positions
/// @notice Wraps Uniswap V3 positions in the ERC721 non-fungible token interface
contract NonfungiblePositionManager is
    INonfungiblePositionManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    LiquidityManagement,
    PeripheryValidation,
    SelfPermit
{
    // details about the uniswap position
    struct Position {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        // the immutable pool key of the position
        address token0;
        address token1;
        uint24 fee;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected tokens are owed to the position, as of the last computation
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 => Position) public override positions;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    address public immutable tokenDescriptor;

    constructor(
        address _factory,
        address _WETH9,
        address _tokenDescriptor
    ) ERC721Permit('Uniswap V3 Positions NFT-V1', 'UNI-V3-POS', '1') PeripheryImmutableState(_factory, _WETH9) {
        tokenDescriptor = _tokenDescriptor;
    }

    /// @inheritdoc INonfungiblePositionManager
    function firstMint(FirstMintParams calldata params)
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (
            uint256 tokenId,
            uint256 amount0,
            uint256 amount1
        )
    {
        (amount0, amount1) = createPoolAndAddLiquidity(
            CreatePoolAndAddLiquidityParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                sqrtPriceX96: params.sqrtPriceX96,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount: params.amount,
                recipient: address(this)
            })
        );

        _mint(params.recipient, (tokenId = _nextId++));

        positions[tokenId] = Position({
            nonce: 0,
            operator: address(0),
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: params.amount,
            feeGrowthInside0LastX128: 0,
            feeGrowthInside1LastX128: 0,
            tokensOwed0: 0,
            tokensOwed1: 0
        });
    }

    /// @inheritdoc INonfungiblePositionManager
    function mint(MintParams calldata params)
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (
            uint256 tokenId,
            uint256 amount0,
            uint256 amount1
        )
    {
        (amount0, amount1) = addLiquidity(
            AddLiquidityParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount: params.amount,
                amount0Max: params.amount0Max,
                amount1Max: params.amount1Max,
                recipient: address(this)
            })
        );

        _mint(params.recipient, (tokenId = _nextId++));

        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));

        bytes32 positionKey = PositionKey.compute(address(this), params.tickLower, params.tickUpper);

        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool.positions(positionKey);

        positions[tokenId] = Position({
            nonce: 1,
            operator: address(0),
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: params.amount,
            feeGrowthInside0LastX128: feeGrowthInside0LastX128,
            feeGrowthInside1LastX128: feeGrowthInside1LastX128,
            tokensOwed0: 0,
            tokensOwed1: 0
        });
    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
        _;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        require(_exists(tokenId));
        return INonfungibleTokenPositionDescriptor(tokenDescriptor).tokenURI(this, tokenId);
    }

    /// @inheritdoc INonfungiblePositionManager
    function increaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 deadline
    ) external payable override checkDeadline(deadline) returns (uint256 amount0, uint256 amount1) {
        require(amount > 0);
        Position storage position = positions[tokenId];

        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: position.token0, token1: position.token1, fee: position.fee});

        (amount0, amount1) = addLiquidity(
            AddLiquidityParams({
                token0: position.token0,
                token1: position.token1,
                fee: position.fee,
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                amount: amount,
                amount0Max: amount0Max,
                amount1Max: amount1Max,
                recipient: address(this)
            })
        );

        bytes32 positionKey = PositionKey.compute(address(this), position.tickLower, position.tickUpper);

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));

        // this is now updated to the current transaction
        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool.positions(positionKey);

        position.tokensOwed0 += uint128(
            FullMath.mulDiv(
                feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128,
                position.liquidity,
                FixedPoint128.Q128
            )
        );
        position.tokensOwed1 += uint128(
            FullMath.mulDiv(
                feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128,
                position.liquidity,
                FixedPoint128.Q128
            )
        );

        position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
        position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
        position.liquidity += amount;
    }

    /// @inheritdoc INonfungiblePositionManager
    function decreaseLiquidity(
        uint256 tokenId,
        uint128 amount,
        uint256 amount0Min,
        uint256 amount1Min,
        uint256 deadline
    )
        external
        payable
        override
        isAuthorizedForToken(tokenId)
        checkDeadline(deadline)
        returns (uint256 amount0, uint256 amount1)
    {
        require(amount > 0);
        Position storage position = positions[tokenId];

        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: position.token0, token1: position.token1, fee: position.fee});
        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));
        (amount0, amount1) = pool.burn(position.tickLower, position.tickUpper, amount);

        require(amount0 >= amount0Min);
        require(amount1 >= amount1Min);

        bytes32 positionKey = PositionKey.compute(address(this), position.tickLower, position.tickUpper);
        // this is now updated to the current transaction
        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool.positions(positionKey);

        position.tokensOwed0 +=
            uint128(amount0) +
            uint128(
                FullMath.mulDiv(
                    feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128,
                    position.liquidity,
                    FixedPoint128.Q128
                )
            );
        position.tokensOwed1 +=
            uint128(amount1) +
            uint128(
                FullMath.mulDiv(
                    feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128,
                    position.liquidity,
                    FixedPoint128.Q128
                )
            );

        position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
        position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
        position.liquidity -= amount;
    }

    /// @inheritdoc INonfungiblePositionManager
    function collect(
        uint256 tokenId,
        address recipient,
        uint128 amount0Max,
        uint128 amount1Max
    ) external payable override isAuthorizedForToken(tokenId) returns (uint256 amount0, uint256 amount1) {
        require(amount0Max > 0 || amount1Max > 0);
        Position storage position = positions[tokenId];

        (uint128 tokensOwed0, uint128 tokensOwed1) = (position.tokensOwed0, position.tokensOwed1);

        // adjust amount0Max, amount1Max to the max for the position
        (amount0Max, amount1Max) = (
            amount0Max > tokensOwed0 ? tokensOwed0 : amount0Max,
            amount1Max > tokensOwed1 ? tokensOwed1 : amount1Max
        );

        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: position.token0, token1: position.token1, fee: position.fee});
        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));
        (amount0, amount1) = pool.collect(recipient, position.tickLower, position.tickUpper, amount0Max, amount1Max);

        // sometimes there will be a few less wei than expected due to rounding down in core, but we just subtract the full amount expected
        // instead of the actual amount so we can burn the token
        (position.tokensOwed0, position.tokensOwed1) = (tokensOwed0 - amount0Max, tokensOwed1 - amount1Max);
    }

    /// @inheritdoc INonfungiblePositionManager
    function burn(uint256 tokenId) external payable override isAuthorizedForToken(tokenId) {
        Position storage position = positions[tokenId];
        require(position.liquidity == 0 && position.tokensOwed0 == 0 && position.tokensOwed1 == 0, 'Not cleared');
        delete positions[tokenId];
        _burn(tokenId);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(positions[tokenId].nonce++);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), 'ERC721: approved query for nonexistent token');

        return positions[tokenId].operator;
    }

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        positions[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }
}
