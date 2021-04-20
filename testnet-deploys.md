# Testnet Deploys

The latest version of `@uniswap/v3-core`, `@uniswap/v3-periphery`, and supporting contracts (e.g. `WETH9`, `Multicall2`)
are all deployed to testnets.

Note these addresses are not final, they will be changed as we make final updates to the periphery repository. These
addresses are given as of the following releases (tagged commits + npm packages):

- `@uniswap/v3-core`: `1.0.0-rc.2`
- `@uniswap/v3-periphery`: `1.0.0-beta.21`

Below you will find the addresses of each contract on each testnet. The keys are mapped to their respective source code
in the table below:

| Key                                         | Source Code                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `v3CoreFactoryAddress`                      | https://github.com/Uniswap/uniswap-v3-core/blob/v1.0.0-rc.2/contracts/UniswapV3Factory.sol                                    |
| `weth9Address`                              | https://rinkeby.etherscan.io/address/0xc778417E063141139Fce010982780140Aa0cD5Ab#code                                          |
| `multicall2Address`                         | https://rinkeby.etherscan.io/address/0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696#code                                          |
| `proxyAdminAddress`                         | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/ProxyAdmin.sol                  |
| `tickLensAddress`                           | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/lens/TickLens.sol                               |
| `quoterAddress`                             | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/lens/Quoter.sol                                 |
| `swapRouter`                                | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/SwapRouter.sol                                  |
| `nonfungibleTokenPositionDescriptorAddress` | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/NonfungibleTokenPositionDescriptor.sol          |
| `descriptorProxyAddress`                    | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.1-solc-0.7-2/contracts/proxy/TransparentUpgradeableProxy.sol |
| `nonfungibleTokenPositionManagerAddress`    | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/NonfungiblePositionManager.sol                  |
| `v3MigratorAddress`                         | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.21/contracts/V3Migrator.sol                                  |

## Ropsten

```json
{
  "v3CoreFactoryAddress": "0xDbe2c61E85D06eaA6E7916049f38B93288BA30f3",
  "weth9Address": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xd3808aBF85aC69D2DBf53794DEa08e75222Ad9a1",
  "tickLensAddress": "0x9dF511178D1438065F7672379414F5C46D5B51b4",
  "quoterAddress": "0x2051F6Fb61077b5A2A2c17535d31A1F2C858994f",
  "swapRouter": "0x58f6b77148BE49BF7898472268ae8f26377d0AA6",
  "nonfungibleTokenPositionDescriptorAddress": "0xeb86f5BE368c3C5e562f7eA1470ACC431d30fB0C",
  "descriptorProxyAddress": "0xB79bDE60fc227217f4EE2102dC93fa1264E33DaB",
  "nonfungibleTokenPositionManagerAddress": "0x865F20efC14A5186bF985aD42c64f5e71C055376",
  "v3MigratorAddress": "0x1988F2e49A72C4D73961C7f4Bb896819d3d2F6a3"
}
```

## Kovan

```json
{
  "v3CoreFactoryAddress": "0x7046f9311663DB8B7cf218BC7B6F3f17B0Ea1047",
  "weth9Address": "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0x8dF824f7885611c587AA45924BF23153EC832b89",
  "tickLensAddress": "0x3b1aC1c352F3A18A58471908982b8b870c836EC0",
  "quoterAddress": "0x539BF58f052dE91ae369dAd59f1ac6887dF39Bc5",
  "swapRouter": "0xbBca0fFBFE60F60071630A8c80bb6253dC9D6023",
  "nonfungibleTokenPositionDescriptorAddress": "0xc4b81504F9a2bd6a6f2617091FB01Efb38D119c8",
  "descriptorProxyAddress": "0xDbe2c61E85D06eaA6E7916049f38B93288BA30f3",
  "nonfungibleTokenPositionManagerAddress": "0xd3808aBF85aC69D2DBf53794DEa08e75222Ad9a1",
  "v3MigratorAddress": "0x9dF511178D1438065F7672379414F5C46D5B51b4"
}
```

## Rinkeby

```json
{
  "v3CoreFactoryAddress": "0xd3808aBF85aC69D2DBf53794DEa08e75222Ad9a1",
  "weth9Address": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0x9dF511178D1438065F7672379414F5C46D5B51b4",
  "tickLensAddress": "0x2051F6Fb61077b5A2A2c17535d31A1F2C858994f",
  "quoterAddress": "0x58f6b77148BE49BF7898472268ae8f26377d0AA6",
  "swapRouter": "0xeb86f5BE368c3C5e562f7eA1470ACC431d30fB0C",
  "nonfungibleTokenPositionDescriptorAddress": "0xB79bDE60fc227217f4EE2102dC93fa1264E33DaB",
  "descriptorProxyAddress": "0x865F20efC14A5186bF985aD42c64f5e71C055376",
  "nonfungibleTokenPositionManagerAddress": "0x1988F2e49A72C4D73961C7f4Bb896819d3d2F6a3",
  "v3MigratorAddress": "0x40b8b8657d756D163e1255B78419bD8bCC14dCB3"
}
```

### Goerli

```json
{
  "v3CoreFactoryAddress": "0xDbe2c61E85D06eaA6E7916049f38B93288BA30f3",
  "weth9Address": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xd3808aBF85aC69D2DBf53794DEa08e75222Ad9a1",
  "tickLensAddress": "0x9dF511178D1438065F7672379414F5C46D5B51b4",
  "quoterAddress": "0x2051F6Fb61077b5A2A2c17535d31A1F2C858994f",
  "swapRouter": "0x58f6b77148BE49BF7898472268ae8f26377d0AA6",
  "nonfungibleTokenPositionDescriptorAddress": "0xeb86f5BE368c3C5e562f7eA1470ACC431d30fB0C",
  "descriptorProxyAddress": "0xB79bDE60fc227217f4EE2102dC93fa1264E33DaB",
  "nonfungibleTokenPositionManagerAddress": "0x865F20efC14A5186bF985aD42c64f5e71C055376",
  "v3MigratorAddress": "0x1988F2e49A72C4D73961C7f4Bb896819d3d2F6a3"
}
```
