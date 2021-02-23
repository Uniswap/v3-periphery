import { Contract, ContractFactory } from 'ethers'
import { Fixture } from 'ethereum-waffle'

import {
  bytecode as FACTORY_BYTECODE,
  abi as FACTORY_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

export const v3CoreFactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
  const factory = await new ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, wallet).deploy()
  return { factory }
}
