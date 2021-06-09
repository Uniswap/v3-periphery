# Uniswap V3 Periphery

[![Tests](https://github.com/Uniswap/uniswap-v3-periphery/workflows/Tests/badge.svg)](https://github.com/Uniswap/uniswap-v3-periphery/actions?query=workflow%3ATests)
[![Lint](https://github.com/Uniswap/uniswap-v3-periphery/workflows/Lint/badge.svg)](https://github.com/Uniswap/uniswap-v3-periphery/actions?query=workflow%3ALint)

This repository contains the periphery smart contracts for the Uniswap V3 Protocol.
For the lower level core contracts, see the [uniswap-v3-core](https://github.com/Uniswap/uniswap-v3-core)
repository.

## Testing

Because these contracts and tests are modified for OVM support, there are some changes that mean we can no longer simply run `yarn test` and `yarn test:ovm` and expect all tests to pass for both the EVM and OVM. There are a few reasons for this:

1. EVM vs. OVM contracts will use different amounts of gas, so the gas tests will fail
2. `PoolAddress.sol` has a hardcoded bytecode hash, but this hash will be different for EVM vs. OVM bytecode
3. In Uniswap V3 Core and Periphery contracts some logic was pulled out into library contracts to reduce contract size. The original EVM contracts had deterministic bytecode, so a bytecode hash can be easily hardcoded in `PoolAddress.sol`, but this is no longer true. The contracts now require linking libraries, and therefore the bytecode and bytecode hash is dependent on the library addresses, which are dependent on the deployer account and nonce

Therefore, we must follow the steps below to run EVM tests in this repo:
1. Open `PoolAddress.sol` and set `POOL_INIT_CODE_HASH` to `0x00ded91a6d45ab1ebbbcb964c55ea9e6aa7bcbb5d83a3888ffb5785f23be9836`
2. Run `UPDATE_SNAPSHOT=1 yarn test` which will ensure gas costs snapshots are updated (i.e. tests will not fail for gas cost reasons)

And to run OVM tests:
1. Open `PoolAddress.sol` and set `POOL_INIT_CODE_HASH` to `0x789bbcb4d36a7a15d68e07c192ff256236e3486610523115567871e609a917ca`
2. Run `UPDATE_SNAPSHOT=1 yarn test` which will ensure gas costs snapshots are updated (i.e. tests will not fail for gas cost reasons)
3. On subsequent test runs, run `yarn optimism-down && yarn optimism-up && UPDATE_SNAPSHOT=1 yarn test:ovm`. This is required so the deployer account nonce is reset to zero, which is necessary to get the above bytecode hash when deploying contracts

## Bug bounty

This repository is subject to the Uniswap V3 bug bounty program,
per the terms defined [here](./bug-bounty.md).

## Local deployment

In order to deploy this code to a local testnet, you should install the npm package
`@uniswap/v3-periphery`
and import bytecode imported from artifacts located at
`@uniswap/v3-periphery/artifacts/contracts/*/*.json`.
For example:

```typescript
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'

// deploy the bytecode
```

This will ensure that you are testing against the same bytecode that is deployed to
mainnet and public testnets, and all Uniswap code will correctly interoperate with
your local deployment.

## Using solidity interfaces

The Uniswap v3 periphery interfaces are available for import into solidity smart contracts
via the npm artifact `@uniswap/v3-periphery`, e.g.:

```solidity
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract MyContract {
  ISwapRouter router;

  function doSomethingWithSwapRouter() {
    // router.exactInput(...);
  }
}

```
