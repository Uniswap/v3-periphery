import { constants, utils } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { PoolAddressTest } from '../typechain'
import { expect } from './shared/expect'
import { bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'

describe('PoolAddress', () => {
  const wallets = waffle.provider.getWallets()

  let poolAddress: PoolAddressTest

  const poolAddressTestFixture = async () => {
    const poolAddressTestFactory = await ethers.getContractFactory('PoolAddressTest')
    return (await poolAddressTestFactory.deploy()) as PoolAddressTest
  }

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy PoolAddressTest', async () => {
    poolAddress = await loadFixture(poolAddressTestFixture)
  })

  describe('#POOL_INIT_CODE_HASH', () => {
    it('is as expected', async () => {
      expect(await poolAddress.POOL_INIT_CODE_HASH()).to.eq(utils.keccak256(bytecode))
    })
  })

  describe('#computeAddress', () => {
    it('zero arguments', async () => {
      expect(
        await poolAddress.computeAddress(constants.AddressZero, constants.AddressZero, constants.AddressZero, 0)
      ).to.eq('0xF5FF66EC5e900a5c63c478b3d50CD758E47F3661')
    })
  })
})
