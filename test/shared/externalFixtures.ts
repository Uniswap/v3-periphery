import { waffle, ethers } from 'hardhat'
import { Contract } from 'ethers'
import { Fixture } from 'ethereum-waffle'

import {
  bytecode as FACTORY_BYTECODE,
  abi as FACTORY_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

import WETH9 from '../contracts/WETH9.json'
import WETH10 from '../contracts/WETH10.json'
import { IWETH9, IWETH10, MockTimeSwapRouter } from '../../typechain'

const wethFixture: Fixture<{ weth9: IWETH9; weth10: IWETH10 }> = async ([wallet]) => {
  const [weth9, weth10] = await Promise.all([
    ((await waffle.deployContract(wallet, {
      bytecode: WETH9.bytecode,
      abi: WETH9.abi,
    })) as unknown) as Promise<IWETH9>,
    ((await waffle.deployContract(wallet, {
      bytecode: WETH10.bytecode,
      abi: WETH10.abi,
    })) as unknown) as Promise<IWETH10>,
  ])

  return { weth9, weth10 }
}

const v3CoreFactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
  const factory = await waffle.deployContract(wallet, { bytecode: FACTORY_BYTECODE, abi: FACTORY_ABI })
  return { factory }
}

export const v3RouterFixture: Fixture<{
  weth9: IWETH9
  weth10: IWETH10
  factory: Contract
  router: MockTimeSwapRouter
}> = async ([wallet], provider) => {
  const { weth9, weth10 } = await wethFixture([wallet], provider)
  const { factory } = await v3CoreFactoryFixture([wallet], provider)

  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    weth9.address,
    weth10.address
  )) as MockTimeSwapRouter

  return { factory, weth9, weth10, router }
}
