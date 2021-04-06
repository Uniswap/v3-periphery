// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/lib/contracts/libraries/SafeERC20Namer.sol';
import './base/ChainId.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './interfaces/IERC20Metadata.sol';
import './libraries/PoolAddress.sol';
import './libraries/NFTDescriptor.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor, ChainId {
    address public immutable WETH9;

    constructor(address _WETH9) {
        WETH9 = _WETH9;
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
        return tokenRatioPriority(token0) > tokenRatioPriority(token1);
    }

    function tokenRatioPriority(address token) public view returns (int256) {
        if (token == WETH9) {
            return -100;
        }
        if (_chainid() == 1) {
            if (token == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
                // USDC
                return 250;
            } else if (token == 0xdAC17F958D2ee523a2206206994597C13D831ec7) {
                // USDT
                return 200;
            } else if (token == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
                // DAI
                return 100;
            } else if (token == 0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa) {
                // TBTC
                return -200;
            } else if (token == 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) {
                // WBTC
                return -250;
            } else {
                return 0;
            }
        }
        return 0;
    }
}
