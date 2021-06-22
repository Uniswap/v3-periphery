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

    it('correct output when tick is 0', async () => {
      const period = 3
      const secondsPerLiqCumulatives: [BigNumberish, BigNumberish] = [10, 20]
      const mockObservable = await observableWith({
        period,
        tickCumulatives: [12, 12],
        secondsPerLiqCumulatives
      })
      const [observation] = await oracle.consult([mockObservable.address], period)

      expect(observation.timeWeightedAverageTick).to.equal(0)
      expect(observation.timeWeightedHarmonicMeanLiquidity).to.equal(calculateHarmonicMeanLiq(period, secondsPerLiqCumulatives))
    })

    it('correct rounding for .5 negative tick', async () => {
      const period = 4

      const secondsPerLiqCumulatives: [BigNumberish, BigNumberish] = [10, 11]
      const mockObservable = await observableWith({
        period,
        tickCumulatives: [-10, -12],
        secondsPerLiqCumulatives
      })

      const [observation] = await oracle.consult([mockObservable.address], period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(observation.timeWeightedAverageTick).to.equal(-1)
      expect(observation.timeWeightedHarmonicMeanLiquidity).to.equal(calculateHarmonicMeanLiq(period, secondsPerLiqCumulatives))
    })

    it('correct output for multiple pools', async () => {
      const period = 3
      const secondsPerLiqCumulatives1: [BigNumberish, BigNumberish] = [10, 100]
      const secondsPerLiqCumulatives2: [BigNumberish, BigNumberish] = [0, 50]

      const mockObservable1 = await observableWith({
        period,
        tickCumulatives: [7, 12],
        secondsPerLiqCumulatives: secondsPerLiqCumulatives1
      })

      const mockObservable2 = await observableWith({
        period,
        tickCumulatives: [-7, -12],
        secondsPerLiqCumulatives: secondsPerLiqCumulatives2
      })

      const [observation1, observation2] = await oracle.consult([mockObservable1.address, mockObservable2.address], period)

      expect(observation1.timeWeightedAverageTick).to.equal(1)
      expect(observation1.timeWeightedHarmonicMeanLiquidity).to.equal(calculateHarmonicMeanLiq(period, secondsPerLiqCumulatives1))

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(observation2.timeWeightedAverageTick).to.equal(-2)
      expect(observation2.timeWeightedHarmonicMeanLiquidity).to.equal(calculateHarmonicMeanLiq(period, secondsPerLiqCumulatives2))
    })

    function calculateHarmonicMeanLiq(period: number, secondsPerLiqCumulatives: [BigNumberish, BigNumberish]) {
      const [secondsPerLiq0, secondsPerLiq1] = secondsPerLiqCumulatives.map(BigNumber.from)
      const delta = secondsPerLiq1.sub(secondsPerLiq0)

      const maxUint160 = BigNumber.from(2).pow(160).sub(1)
      return maxUint160.mul(period).div(delta.shl(32))
    }

    function observableWith({
      period,
      tickCumulatives,
      secondsPerLiqCumulatives,
    }: {
      period: number
      tickCumulatives: [BigNumberish, BigNumberish]
      secondsPerLiqCumulatives: [BigNumberish, BigNumberish]
    }) {
      return mockObservableFactory.deploy(
        [period, 0],
        tickCumulatives.map(BigNumber.from),
        secondsPerLiqCumulatives.map(BigNumber.from),
      )
    }

  })

  describe('#getArithmeticMeanWeightedTick', () => {

    it('single observation returns average tick', async () => {
      const averageTick = 10
      const observation = observationWith({ averageTick, harmonicMeanLiquidity: 10 })

      const oracleTick = await oracle.getArithmeticMeanWeightedTick([observation])

      expect(oracleTick).to.equal(averageTick)
    })

    it('multiple observations with same weight result in average across tiers', async () => {
      const observation1 = observationWith({ averageTick: 10, harmonicMeanLiquidity: 10 })
      const observation2 = observationWith({ averageTick: 20, harmonicMeanLiquidity: 10 })

      const oracleTick = await oracle.getArithmeticMeanWeightedTick([observation1, observation2])

      expect(oracleTick).to.equal(15)
    })

    it('multiple observations with different weights are weighted correctly', async () => {
      const observation1 = observationWith({ averageTick: 10, harmonicMeanLiquidity: 10 })
      const observation2 = observationWith({ averageTick: 20, harmonicMeanLiquidity: 15 })

      const oracleTick = await oracle.getArithmeticMeanWeightedTick([observation1, observation2])

      expect(oracleTick).to.equal(16)
    })

    function observationWith({
      averageTick,
      harmonicMeanLiquidity,
    }: {
      averageTick: BigNumberish
      harmonicMeanLiquidity: BigNumberish
    }) {
      return {
        timeWeightedAverageTick: averageTick,
        timeWeightedHarmonicMeanLiquidity: harmonicMeanLiquidity
      }
    }
  })
})
