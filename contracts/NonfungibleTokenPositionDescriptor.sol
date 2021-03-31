// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/lib/contracts/libraries/SafeERC20Namer.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './interfaces/IERC20Metadata.sol';
import './libraries/PoolAddress.sol';
import './libraries/NFTDescriptor.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor, Ownable {
    // tokens that take priority as ratio numerator (such as stablecoins)
    mapping(address => bool) public ratioNumeratorTokens;
    // tokens that take priorty as ratio denominator (such as WETH)
    mapping(address => bool) public ratioDenominatorTokens;

    constructor(address[] memory numeratorTokens, address[] memory denominatorTokens) Ownable() {
        for (uint256 i = 0; i < numeratorTokens.length; i++) {
            ratioNumeratorTokens[numeratorTokens[i]] = true;
        }
        for (uint256 i = 0; i < denominatorTokens.length; i++) {
            ratioDenominatorTokens[denominatorTokens[i]] = true;
        }
    }

    /// @inheritdoc INonfungibleTokenPositionDescriptor
    function tokenURI(INonfungiblePositionManager positionManager, uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        (, , address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) =
            positionManager.positions(tokenId);

        IUniswapV3Pool pool =
            IUniswapV3Pool(
                PoolAddress.computeAddress(
                    positionManager.factory(),
                    PoolAddress.PoolKey({token0: token0, token1: token1, fee: fee})
                )
            );

        return
            NFTDescriptor.constructTokenURI(
                NFTDescriptor.ConstructTokenURIParams({
                    token0: token0,
                    token1: token1,
                    token0Symbol: SafeERC20Namer.tokenSymbol(token0),
                    token1Symbol: SafeERC20Namer.tokenSymbol(token1),
                    token0Decimals: IERC20Metadata(token0).decimals(),
                    token1Decimals: IERC20Metadata(token1).decimals(),
                    hasToken0RatioNumerator: hasToken0RatioNumerator(token0, token1),
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickSpacing: pool.tickSpacing(),
                    fee: fee,
                    liquidity: liquidity,
                    poolAddress: address(pool)
                })
            );
    }

    function hasToken0RatioNumerator(address token0, address token1) public view returns (bool) {
        if (ratioNumeratorTokens[token1]) {
            return false;
        } else if (ratioNumeratorTokens[token0]) {
            return true;
        } else if (ratioDenominatorTokens[token1]) {
            return true;
        } else {
            return false;
        }
    }

    function addRatioNumeratorToken(address token) external onlyOwner() {
        ratioNumeratorTokens[token] = true;
    }

    function addRatioDenominatorToken(address token) external onlyOwner() {
        ratioDenominatorTokens[token] = true;
    }
}
