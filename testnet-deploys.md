# Testnet Deploys

The latest version of `@uniswap/v3-core`, `@uniswap/v3-periphery`, and supporting contracts (e.g. `WETH9`, `Multicall2`)
are all deployed to testnets.

Note these addresses are not final, they will be changed as we make final updates to the periphery repository. These
addresses are given as of the following releases (tagged commits + npm packages):

- `@uniswap/v3-core`: `1.0.0-rc.2`
- `@uniswap/v3-periphery`: `1.0.0-beta.22`

Below you will find the addresses of each contract on each testnet. The keys are mapped to their respective source code
in the table below:

| Key                                         | Source Code                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `v3CoreFactoryAddress`                      | https://github.com/Uniswap/uniswap-v3-core/blob/v1.0.0-rc.2/contracts/UniswapV3Factory.sol                                    |
| `weth9Address`                              | https://rinkeby.etherscan.io/address/0xc778417E063141139Fce010982780140Aa0cD5Ab#code                                          |
| `multicall2Address`                         | https://rinkeby.etherscan.io/address/0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696#code                                          |
| `proxyAdminAddress`                         | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/ProxyAdmin.sol                  |
| `tickLensAddress`                           | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/lens/TickLens.sol                               |
| `quoterAddress`                             | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/lens/Quoter.sol                                 |
| `swapRouter`                                | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/SwapRouter.sol                                  |
| `nonfungibleTokenPositionDescriptorAddress` | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/NonfungibleTokenPositionDescriptor.sol          |
| `descriptorProxyAddress`                    | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/TransparentUpgradeableProxy.sol |
| `nonfungibleTokenPositionManagerAddress`    | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/NonfungiblePositionManager.sol                  |
| `v3MigratorAddress`                         | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.22/contracts/V3Migrator.sol                                  |

## Ropsten

Unable to deploy due to gas prices.

## Kovan

```json
{"v3CoreFactoryAddress":"0x58f6b77148BE49BF7898472268ae8f26377d0AA6","weth9Address":"0xd0A1E359811322d97991E03f863a0C30C2cF029C","multicall2Address":"0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696","proxyAdminAddress":"0xeb86f5BE368c3C5e562f7eA1470ACC431d30fB0C","tickLensAddress":"0xB79bDE60fc227217f4EE2102dC93fa1264E33DaB","quoterAddress":"0x865F20efC14A5186bF985aD42c64f5e71C055376","swapRouter":"0x1988F2e49A72C4D73961C7f4Bb896819d3d2F6a3","nonfungibleTokenPositionDescriptorAddress":"0x40b8b8657d756D163e1255B78419bD8bCC14dCB3","descriptorProxyAddress":"0x49A6d0854B0fF95065f0dA247b8a2d440D92D2c7","nonfungibleTokenPositionManagerAddress":"0xA31B47971cdC5376E41CfA2D4378912156ab1F10","v3MigratorAddress":"0xFeabCc62240297F1e4b238937D68e7516f0918D7"}
```

## Rinkeby

```json
{"v3CoreFactoryAddress":"0xFeabCc62240297F1e4b238937D68e7516f0918D7","weth9Address":"0xc778417E063141139Fce010982780140Aa0cD5Ab","multicall2Address":"0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696","proxyAdminAddress":"0x80AacDBEe92DC1c2Fbaa261Fb369696AF1AD9f98","tickLensAddress":"0x3d137e860008BaF6d1c063158e5ec0baBbcFefF8","quoterAddress":"0x91a64CCaead471caFF912314E466D9CF7C55E0E8","swapRouter":"0x273Edaa13C845F605b5886Dd66C89AB497A6B17b","nonfungibleTokenPositionDescriptorAddress":"0x0Fb45B7E5e306fdE29602dE0a0FA2bE088d04899","descriptorProxyAddress":"0xd6852c52B9c97cBfb7e79B6ab4407AA20Ba31439","nonfungibleTokenPositionManagerAddress":"0x2F9e608FD881861B8916257B76613Cb22EE0652c","v3MigratorAddress":"0x03782388516e94FcD4c18666303601A12Aa729Ea"}
```

### Goerli

```json
{"v3CoreFactoryAddress":"0xA31B47971cdC5376E41CfA2D4378912156ab1F10","weth9Address":"0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6","multicall2Address":"0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696","proxyAdminAddress":"0xFeabCc62240297F1e4b238937D68e7516f0918D7","tickLensAddress":"0x80AacDBEe92DC1c2Fbaa261Fb369696AF1AD9f98","quoterAddress":"0x3d137e860008BaF6d1c063158e5ec0baBbcFefF8","swapRouter":"0x91a64CCaead471caFF912314E466D9CF7C55E0E8","nonfungibleTokenPositionDescriptorAddress":"0x273Edaa13C845F605b5886Dd66C89AB497A6B17b","descriptorProxyAddress":"0x0Fb45B7E5e306fdE29602dE0a0FA2bE088d04899","nonfungibleTokenPositionManagerAddress":"0xd6852c52B9c97cBfb7e79B6ab4407AA20Ba31439","v3MigratorAddress":"0x2F9e608FD881861B8916257B76613Cb22EE0652c"}
```
