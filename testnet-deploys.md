# Testnet Deploys

The latest version of `@uniswap/v3-core`, `@uniswap/v3-periphery`, 
and supporting contracts (e.g. `WETH9`, `Multicall2`) are all 
deployed to testnets.

These addresses are as of the following package versions:

- `@uniswap/v3-core`: `1.0.0-rc.2`
- `@uniswap/v3-periphery`: `1.0.0-beta.20`

Below you will find the addresses of each contract on each testnet. The
keys are mapped to their respective source code in the table below:

| Key                                         | Source Code                                                                                                                 |
|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `v3CoreFactoryAddress`                      | https://github.com/Uniswap/uniswap-v3-core/blob/v1.0.0-rc.2/contracts/UniswapV3Factory.sol                                  |
| `weth9Address`                              | https://rinkeby.etherscan.io/address/0xc778417E063141139Fce010982780140Aa0cD5Ab#code                                        |
| `multicall2Address`                         | https://rinkeby.etherscan.io/address/0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696#code                                        |
| `proxyAdminAddress`                         | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0-solc-0.7/contracts/proxy/ProxyAdmin.sol                  |
| `tickLensAddress`                           | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/lens/TickLens.sol                             |
| `quoterAddress`                             | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/lens/Quoter.sol                               |
| `swapRouter`                                | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/SwapRouter.sol                                |
| `nonfungibleTokenPositionDescriptorAddress` | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/NonfungibleTokenPositionDescriptor.sol        |
| `descriptorProxyAddress`                    | https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0-solc-0.7/contracts/proxy/TransparentUpgradeableProxy.sol |
| `nonfungibleTokenPositionManagerAddress`    | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/NonfungiblePositionManager.sol                |
| `v3MigratorAddress`                         | https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0-beta.20/contracts/V3Migrator.sol                                |

## Ropsten

```json
{
  "v3CoreFactoryAddress": "0x864e344eCd7f3a9A4368dEC11Be8104db5770364",
  "weth9Address": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xAE28628c0fdFb5e54d60FEDC6C9085199aec14dF",
  "tickLensAddress": "0xc97c7D6C2F1EE518bE4D4B8566bcEb917dED4F39",
  "quoterAddress": "0x2d31366B7D446d629ac36933F12bdbca96860f84",
  "swapRouter": "0x7046f9311663DB8B7cf218BC7B6F3f17B0Ea1047",
  "nonfungibleTokenPositionDescriptorAddress": "0x8dF824f7885611c587AA45924BF23153EC832b89",
  "descriptorProxyAddress": "0x3b1aC1c352F3A18A58471908982b8b870c836EC0",
  "nonfungibleTokenPositionManagerAddress": "0x539BF58f052dE91ae369dAd59f1ac6887dF39Bc5",
  "v3MigratorAddress": "0xbBca0fFBFE60F60071630A8c80bb6253dC9D6023"
}
```

## Kovan

```json
{
  "v3CoreFactoryAddress": "0xd4013a706fa79487989b595Df35eF8AD1ffBb422",
  "weth9Address": "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xDD1B8aA26ac2330e39f8B291eA1E6a82A40E65C4",
  "tickLensAddress": "0xD2AAa0217a203d9FaB6e5272b211Be2Aba52f385",
  "quoterAddress": "0xAc03019C975F5e79215FeDAB4a1DC30Af3E478F2",
  "swapRouter": "0x921647f0c094e2e59CDE6DEfafD77743012f52bd",
  "nonfungibleTokenPositionDescriptorAddress": "0x30Ba713F78Ad3c175a25aD767e3f423549Ac2D65",
  "descriptorProxyAddress": "0x864e344eCd7f3a9A4368dEC11Be8104db5770364",
  "nonfungibleTokenPositionManagerAddress": "0xAE28628c0fdFb5e54d60FEDC6C9085199aec14dF",
  "v3MigratorAddress": "0xc97c7D6C2F1EE518bE4D4B8566bcEb917dED4F39"
}
```

## Rinkeby

```json
{
  "v3CoreFactoryAddress": "0xAE28628c0fdFb5e54d60FEDC6C9085199aec14dF",
  "weth9Address": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xc97c7D6C2F1EE518bE4D4B8566bcEb917dED4F39",
  "tickLensAddress": "0x2d31366B7D446d629ac36933F12bdbca96860f84",
  "quoterAddress": "0x7046f9311663DB8B7cf218BC7B6F3f17B0Ea1047",
  "swapRouter": "0x8dF824f7885611c587AA45924BF23153EC832b89",
  "nonfungibleTokenPositionDescriptorAddress": "0x3b1aC1c352F3A18A58471908982b8b870c836EC0",
  "descriptorProxyAddress": "0x539BF58f052dE91ae369dAd59f1ac6887dF39Bc5",
  "nonfungibleTokenPositionManagerAddress": "0xbBca0fFBFE60F60071630A8c80bb6253dC9D6023",
  "v3MigratorAddress": "0xc4b81504F9a2bd6a6f2617091FB01Efb38D119c8"
}
```

### Goerli

```json
{
  "v3CoreFactoryAddress": "0x864e344eCd7f3a9A4368dEC11Be8104db5770364",
  "weth9Address": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  "multicall2Address": "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  "proxyAdminAddress": "0xAE28628c0fdFb5e54d60FEDC6C9085199aec14dF",
  "tickLensAddress": "0xc97c7D6C2F1EE518bE4D4B8566bcEb917dED4F39",
  "quoterAddress": "0x2d31366B7D446d629ac36933F12bdbca96860f84",
  "swapRouter": "0x7046f9311663DB8B7cf218BC7B6F3f17B0Ea1047",
  "nonfungibleTokenPositionDescriptorAddress": "0x8dF824f7885611c587AA45924BF23153EC832b89",
  "descriptorProxyAddress": "0x3b1aC1c352F3A18A58471908982b8b870c836EC0",
  "nonfungibleTokenPositionManagerAddress": "0x539BF58f052dE91ae369dAd59f1ac6887dF39Bc5",
  "v3MigratorAddress": "0xbBca0fFBFE60F60071630A8c80bb6253dC9D6023"
}
```

