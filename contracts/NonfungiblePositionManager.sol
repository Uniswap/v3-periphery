// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './libraries/NonfungiblePositionLibrary.sol';
import './libraries/PositionKey.sol';
import './libraries/PoolAddress.sol';
import './base/LiquidityManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';

/// @title NFT positions
/// @notice Wraps Uniswap V3 positions in the ERC721 non-fungible token interface
contract NonfungiblePositionManager is
    INonfungiblePositionManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    PoolInitializer,
    LiquidityManagement,
    PeripheryValidation,
    SelfPermit
{
    /// @dev IDs of pools assigned by this contract
    mapping(address => uint80) private _poolIds;

    /// @dev Pool keys by pool ID, to save on SSTOREs for position data
    mapping(uint80 => PoolAddress.PoolKey) public override poolIdToPoolKey;

    /// @dev The token ID position data
    mapping(uint256 => Position) public override positions;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;
    /// @dev The ID of the next pool that is used for the first time. Skips 0
    uint80 private _nextPoolId = 1;

    /// @dev The address of the token descriptor contract, which handles generating token URIs for position tokens
    address private immutable _tokenDescriptor;

    using NonfungiblePositionLibrary for IUniswapV3Pool;

    constructor(address _factory, address _WETH9, address _tokenDescriptor_)
        ERC721Permit('Uniswap V3 Positions NFT-V1', 'UNI-V3-POS', '1')
        PeripheryImmutableState(_factory, _WETH9)
    {
        _tokenDescriptor = _tokenDescriptor_;
    }

    /// @dev Caches a pool key
    function cachePoolKey(address pool, PoolAddress.PoolKey memory poolKey) private returns (uint80 poolId) {
        poolId = _poolIds[pool];
        if (poolId == 0) {
            _poolIds[pool] = (poolId = _nextPoolId++);
            poolIdToPoolKey[poolId] = poolKey;
        }
    }

    /// @inheritdoc INonfungiblePositionManager
    function mint(MintParams calldata params)
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));

        (liquidity, amount0, amount1) = pool.addLiquidity(
            poolKey,
            AddLiquidityParams({
                recipient: address(this),
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min
            })
        );

        _mint(params.recipient, (tokenId = _nextId++));

        // idempotent set
        uint80 poolId = cachePoolKey(address(pool), poolKey);

        Position storage position = positions[tokenId];
        pool.updatePosition(params, position, tokenId, liquidity, amount0, amount1, poolId);
    }

    function isAuthorizedForToken(uint256 tokenId) private view {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        require(_exists(tokenId));
        return INonfungibleTokenPositionDescriptor(_tokenDescriptor).tokenURI(this, tokenId);
    }

    // save bytecode by removing implementation of unused method
    function baseURI() public pure override returns (string memory) {}

    /// @inheritdoc INonfungiblePositionManager
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        Position storage position = positions[params.tokenId];

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolIdToPoolKey[position.poolId]));

        pool.increaseLiquidity(poolIdToPoolKey[position.poolId], position, params);
    }

    /// @inheritdoc INonfungiblePositionManager
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (uint256 amount0, uint256 amount1)
    {
        isAuthorizedForToken(params.tokenId);

        IUniswapV3Pool pool =
            IUniswapV3Pool(PoolAddress.computeAddress(factory, poolIdToPoolKey[positions[params.tokenId].poolId]));

        (amount0, amount1) = pool.decreaseLiquidity(positions[params.tokenId], params);
    }

    /// @inheritdoc INonfungiblePositionManager
    function collect(CollectParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        isAuthorizedForToken(params.tokenId);

        Position storage position = positions[params.tokenId];

        IUniswapV3Pool pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolIdToPoolKey[position.poolId]));

        (amount0, amount1) = pool.collect(position, poolIdToPoolKey[position.poolId], params);
    }

    /// @inheritdoc INonfungiblePositionManager
    function burn(uint256 tokenId) external payable override {
        isAuthorizedForToken(tokenId);

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
