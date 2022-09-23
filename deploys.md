# Deployment addresses

The latest version of `@uniswap/v3-core`, `@uniswap/v3-periphery`, `@uniswap/swap-router-contracts`, and `@uniswap/v3-staker` are deployed at the addresses listed below. Integrators should **no longer assume that they are deployed to the same addresses across chains** and be extremely careful to confirm mappings below.

| Contract                                                                                                                                                     | Mainnet, Polygon, Optimism, Arbitrum, Testnets Address | Celo Address                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------- |
| [UniswapV3Factory](https://github.com/Uniswap/uniswap-v3-core/blob/v1.0.0/contracts/UniswapV3Factory.sol)                                                    | `0x1F98431c8aD98523631AE4a59f267346ea31F984`           | `0xAfE208a311B21f13EF87E33A90049fC17A7acDEc` |
| [Multicall2](https://etherscan.io/address/0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696#code)                                                                   | `0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696`           | `0x633987602DE5C4F337e3DbF265303A1080324204` |
| [ProxyAdmin](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/ProxyAdmin.sol)                                   | `0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2`           | `0xc1b262Dd7643D4B7cA9e51631bBd900a564BF49A` |
| [TickLens](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/lens/TickLens.sol)                                                          | `0xbfd8137f7d1516D3ea5cA83523914859ec47F573`           | `0x5f115D9113F88e0a0Db1b5033D90D4a9690AcD3D` |
| [Quoter](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/lens/Quoter.sol)                                                              | `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6`           | `0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8` |
| [SwapRouter](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/SwapRouter.sol)                                                           | `0xE592427A0AEce92De3Edee1F18E0157C05861564`           | `0x5615CDAb10dc425a742d643d949a7F474C01abc4` |
| [NFTDescriptor](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/libraries/NFTDescriptor.sol)                                           | `0x42B24A95702b9986e82d421cC3568932790A48Ec`           | `0xa9Fd765d85938D278cb0b108DbE4BF7186831186` |
| [NonfungibleTokenPositionDescriptor](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/NonfungibleTokenPositionDescriptor.sol)           | `0x91ae842A5Ffd8d12023116943e72A606179294f3`           | `0x644023b316bB65175C347DE903B60a756F6dd554` |
| [TransparentUpgradeableProxy](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/TransparentUpgradeableProxy.sol) | `0xEe6A57eC80ea46401049E92587E52f5Ec1c24785`           | `0x505B43c452AA4443e0a6B84bb37771494633Fde9` |
| [NonfungiblePositionManager](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/NonfungiblePositionManager.sol)                           | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`           | `0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A` |
| [V3Migrator](https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/V3Migrator.sol)                                                           | `0xA5644E29708357803b5A882D272c41cC0dF92B34`           | `0x3cFd4d48EDfDCC53D3f173F596f621064614C582` |

These addresses are final and were deployed from these npm package versions:

- `@uniswap/v3-core`: [`1.0.0`](https://github.com/Uniswap/uniswap-v3-core/tree/v1.0.0)
- `@uniswap/v3-periphery`: [`1.0.0`](https://github.com/Uniswap/uniswap-v3-periphery/tree/v1.0.0)

The source code is verified with Etherscan on all networks, for all contracts except `UniswapV3Pool`.
We are working on getting the `UniswapV3Pool` contract verified with Etherscan.
