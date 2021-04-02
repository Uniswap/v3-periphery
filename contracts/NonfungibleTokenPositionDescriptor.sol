// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/lib/contracts/libraries/SafeERC20Namer.sol';
import '@openzeppelin/contracts/proxy/Initializable.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './interfaces/IERC20Metadata.sol';
import './libraries/PoolAddress.sol';
import './libraries/NFTDescriptor.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor, Initializable {
    struct TokenRatioOrderPriority {
        address token;
        int256 priority;
    }

    // tokens that take priority order in price ratio - higher integers get numerator priority
    mapping(address => int256) public tokenRatioPriority;

    function initialize(TokenRatioOrderPriority[] calldata tokens) public initializer() {
        for (uint256 i = 0; i < tokens.length; i++) {
            updateTokenRatioPriority(tokens[i]);
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
                    flipRatio: flipRatio(token0, token1),
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickSpacing: pool.tickSpacing(),
                    fee: fee,
                    liquidity: liquidity,
                    poolAddress: address(pool)
                })
            );
    }

    function flipRatio(address token0, address token1) public view returns (bool) {
        return tokenRatioPriority[token0] > tokenRatioPriority[token1];
    }

    function updateTokenRatioPriority(TokenRatioOrderPriority calldata token) private {
        tokenRatioPriority[token.token] = token.priority;
        emit UpdateTokenRatioPriority(token.token, token.priority);
    }
}
