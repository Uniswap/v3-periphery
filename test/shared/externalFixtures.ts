import { abi as FACTORY_V2_ABI, bytecode as FACTORY_V2_BYTECODE } from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { Fixture } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { IUniswapV3Factory, IWETH9, MockTimeSwapRouter } from '../../typechain'

import WETH9 from '../contracts/WETH9.json'
import { Contract } from '@ethersproject/contracts'
import { constants } from 'ethers'

const wethFixture: Fixture<{ weth9: IWETH9 }> = async ([wallet]) => {
  const weth9 = (await waffle.deployContract(wallet, {
    bytecode: WETH9.bytecode,
    abi: WETH9.abi,
  })) as IWETH9

  return { weth9 }
}

export const v2FactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
  const factory = await waffle.deployContract(
    wallet,
    {
      bytecode: FACTORY_V2_BYTECODE,
      abi: FACTORY_V2_ABI,
    },
    [constants.AddressZero]
  )

  return { factory }
}

const deployLib = async (name: string, libraries?: any): Promise<string> => {
  const lib = await (await ethers.getContractFactory(name, { libraries })).deploy()
  return lib.address
}

const v3CoreFactoryFixture: Fixture<IUniswapV3Factory> = async ([wallet]) => {
  const position = await deployLib('Position')
  const oracle = await deployLib('Oracle')
  const tick = await deployLib('Tick')
  const tickBitmap = await deployLib('TickBitmap')
  const tickMath = await deployLib('TickMath')
  const stateLibs = {
    Oracle: oracle,
    TickBitmap: tickBitmap,
    TickMath: tickMath,
  }
  const stateMath = await deployLib('StateMath', stateLibs)

  const libraries = {
    Position: position,
    Oracle: oracle,
    StateMath: stateMath,
    Tick: tick,
    TickMath: tickMath,
  }

  const factoryFactory = await ethers.getContractFactory('UniswapV3Factory', {
    libraries: {
      UniswapV3PoolDeployer: await deployLib('UniswapV3PoolDeployer', libraries),
    },
  })
  const factory = (await factoryFactory.deploy()) as IUniswapV3Factory
  return factory.connect(wallet)
}

export const v3RouterFixture: Fixture<{
  weth9: IWETH9
  factory: IUniswapV3Factory
  router: MockTimeSwapRouter
}> = async ([wallet], provider) => {
  const { weth9 } = await wethFixture([wallet], provider)
  const factory = await v3CoreFactoryFixture([wallet], provider)

  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    weth9.address
  )) as MockTimeSwapRouter

  return { factory, weth9, router }
}
