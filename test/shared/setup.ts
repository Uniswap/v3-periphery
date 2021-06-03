/**
 * Converting the V3 Core contracts to be OVM-compatible required introducing additional libraries (to reduce contract
 * size). Therefore the default UniswapV3Pool and UniswapV3Factory bytecode includes placeholders for library addresses
 * which need to be linked at deployment. However, this breaks the deterministic pair address + deterministic bytecode
 * assumptions made, since different bytecode (from different library addresses) will occur each time the fixture is
 * ran (because l2geth does not support evm_snapshot and evm_revert methods, so we actually redeploy the contracts each
 * time). To account for this, this file ensures we only deploy contracts once for all tests, and returns an already
 * deployed instance all other times.
 */
import { ethers, waffle } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { IUniswapV3Factory, IWETH9, MockTimeSwapRouter } from '../../typechain'

// Default wallet attached to contracts
const wallet = waffle.provider.getWallets()[0]

// The first two variables were previously constant and deterministic, but are now a function of library address. So we
// initialize them here and define them in v3CoreFactoryFixtureSetup which should only be run one time. After the first
// run we return the saved values here. Similarly, we only want to deploy WETH once because it is a constructor
// argument and we want to ensure the WETH address is always safe to use as a constructor argument
let factory: IUniswapV3Factory
let poolBytecode: string
let weth: IWETH9

// Helper method for deploying libraries
const deployLib = async (name: string, libraries?: any): Promise<string> => {
  const lib = await (await ethers.getContractFactory(name, { libraries })).deploy()
  return lib.address
}

// This method is called within _Setup.spec.ts to ensure contracts are only deployed once
export const v3CoreFactoryFixtureSetup: Fixture<IUniswapV3Factory> = async () => {
  // If factory was already deployed, return it
  if (factory) return factory

  // Otherwise deploy contracts
  const position = await deployLib('Position')
  const oracle = await deployLib('Oracle')
  const tick = await deployLib('Tick')
  const tickBitmap = await deployLib('TickBitmap')
  const tickMath = await deployLib('TickMath')
  const swapMath = await deployLib('SwapMath')

  const libraries = {
    Position: position,
    Oracle: oracle,
    Tick: tick,
    TickMath: tickMath,
    TickBitmap: tickBitmap,
    SwapMath: swapMath,
  }

  const poolFactory = await ethers.getContractFactory('UniswapV3Pool', { libraries })
  poolBytecode = poolFactory.bytecode

  const factoryFactory = await ethers.getContractFactory('UniswapV3Factory', {
    libraries: {
      UniswapV3PoolDeployer: await deployLib('UniswapV3PoolDeployer', libraries),
    },
  })
  factory = (await factoryFactory.deploy()).connect(wallet) as IUniswapV3Factory
  return factory
}

export const getPoolBytecode = async () => {
  // @ts-expect-error We don't pass inputs to v3CoreFactoryFixtureSetup since it has defaults
  if (!poolBytecode) await v3CoreFactoryFixtureSetup() // this sets the poolBytecode variable
  return poolBytecode
}

// This method is called within _Setup.spec.ts to ensure WETH is only deployed once per test suite run
export const wethFixtureSetup: Fixture<{ weth9: IWETH9 }> = async () => {
  // If weth was already deployed, return it
  if (weth) return { weth9: weth }

  // Otherwise deploy it
  weth = (await (await ethers.getContractFactory('WETH9', wallet)).deploy()) as IWETH9
  return { weth9: weth }
}
