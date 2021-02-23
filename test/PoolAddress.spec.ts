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
    it('equals the hash of the pool bytecode', async () => {
      expect(await poolAddress.POOL_INIT_CODE_HASH()).to.eq(utils.keccak256(bytecode))
    })
  })

  describe('#computeAddress', () => {
    it('all arguments equal zero', async () => {
      expect(
        await poolAddress.computeAddress(constants.AddressZero, constants.AddressZero, constants.AddressZero, 0)
      ).to.eq('0x31FF4C93099D501240615BB40123f82E1Ff21f90')
    })

    it('matches example from core repo', async () => {
      expect(
        await poolAddress.computeAddress(
          '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          '0x1000000000000000000000000000000000000000',
          '0x2000000000000000000000000000000000000000',
          250
        )
      ).to.eq('0xF1b7a83f6B3A7fB812C0038CE25DeCCc68814ff4')
    })

    it('token argument order does not matter', async () => {
      expect(
        await poolAddress.computeAddress(
          '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          '0x2000000000000000000000000000000000000000',
          '0x1000000000000000000000000000000000000000',
          3000
        )
      ).to.eq('0x2724C7391008A1d24acD3Aa13562114addF00312')
    })
  })
})
