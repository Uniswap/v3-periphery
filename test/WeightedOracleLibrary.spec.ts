import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, ContractFactory } from 'ethers'
import { TestERC20, WeightedOracleTest } from '../typechain'

describe('WeightedOracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let tokens: TestERC20[]
  let oracle: WeightedOracleTest

  const wallets = waffle.provider.getWallets()

  const oracleTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    const oracleFactory = await ethers.getContractFactory('WeightedOracleTest')
    const oracle = await oracleFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      oracle: oracle as WeightedOracleTest,
    }
  }

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(oracleTestFixture)
    tokens = fixtures['tokens']
    oracle = fixtures['oracle']
  })

  describe('#consult', () => {
    let mockObservableFactory: ContractFactory

    before('create mockObservableFactory', async () => {
      mockObservableFactory = await ethers.getContractFactory('MockObservable')
    })

    it('reverts when period is 0', async () => {
      await expect(oracle.consult([oracle.address], 0)).to.be.revertedWith('BP')
    })

    it('single pool returns average tick', async () => {
      const period = 3
      const averageTick = 10
      const mockObservable = await observableWith({ period, averageTick, liquidityWeight: 10 })

      const oracleTick = await oracle.consult([mockObservable.address], period)

      expect(oracleTick).to.equal(averageTick)
    })

    it('multiple pools with same weight result in average across tiers', async () => {
      const period = 3
      const mockObservable1 = await observableWith({ period, averageTick: 10, liquidityWeight: 10 })
      const mockObservable2 = await observableWith({ period, averageTick: 20, liquidityWeight: 10 })

      const oracleTick = await oracle.consult([mockObservable1.address, mockObservable2.address], period)

      expect(oracleTick).to.equal(15)
    })

    it('multiple pools with different weights are weighted correctly', async () => {
      const period = 3
      const mockObservable1 = await observableWith({ period, averageTick: 10, liquidityWeight: 10 })
      const mockObservable2 = await observableWith({ period, averageTick: 20, liquidityWeight: 15 })

      const oracleTick = await oracle.consult([mockObservable1.address, mockObservable2.address], period)

      expect(oracleTick).to.equal(16)
    })

    function observableWith({
      period,
      averageTick,
      liquidityWeight,
    }: {
      period: number
      averageTick: BigNumberish
      liquidityWeight: BigNumberish
    }) {
      return mockObservableFactory.deploy(
        [period, 0],
        [0, BigNumber.from(averageTick).mul(period)],
        [0, BigNumber.from(period).shl(128).div(liquidityWeight)]
      )
    }
  })
})
