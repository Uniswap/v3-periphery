import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, constants, ContractFactory } from 'ethers'
import { OracleTest, TestERC20 } from '../typechain'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import snapshotGasCost from './shared/snapshotGasCost'

describe('OracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let tokens: TestERC20[]
  let oracle: OracleTest

  const wallets = waffle.provider.getWallets()

  const oracleTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    const oracleFactory = await ethers.getContractFactory('OracleTest')
    const oracle = await oracleFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      oracle: oracle as OracleTest,
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
      await expect(oracle.consult(oracle.address, 0)).to.be.revertedWith('BP')
    })

    it('correct output when tick is 0', async () => {
      const period = 3
      const tickCumulatives = [BigNumber.from(12), BigNumber.from(12)]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      expect(oracleTick).to.equal(BigNumber.from(0))
    })

    it('correct output for positive tick', async () => {
      const period = 3
      const tickCumulatives = [BigNumber.from(7), BigNumber.from(12)]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      // Always round to negative infinity
      // In this case, we don't have do anything
      expect(oracleTick).to.equal(BigNumber.from(1))
    })

    it('correct output for negative tick', async () => {
      const period = 3
      const tickCumulatives = [BigNumber.from(-7), BigNumber.from(-12)]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(oracleTick).to.equal(BigNumber.from(-2))
    })

    it('correct rounding for .5 negative tick', async () => {
      const period = 4
      const tickCumulatives = [BigNumber.from(-10), BigNumber.from(-12)]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(oracleTick).to.equal(BigNumber.from(-1))
    })

    it('correct output for tick cumulatives across overflow boundaries', async () => {
      const period = 4
      const tickCumulatives = [BigNumber.from(-100), BigNumber.from('36028797018963967')]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      // Always round to negative infinity
      // In this case, we don't have do anything
      expect(oracleTick).to.equal(BigNumber.from(24))
    })

    it('correct output for tick cumulatives across underflow boundaries', async () => {
      const period = 4
      const tickCumulatives = [BigNumber.from(100), BigNumber.from('-36028797018963967')]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])
      const oracleTick = await oracle.consult(mockObservable.address, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(oracleTick).to.equal(BigNumber.from(-25))
    })

    it('gas test', async () => {
      const period = 3
      const tickCumulatives = [BigNumber.from(7), BigNumber.from(12)]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0])

      await snapshotGasCost(oracle.getGasCostOfConsult(mockObservable.address, period))
    })
  })

  describe('#getQuoteAtTick', () => {
    // sanity check
    it('token0: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(0),
        expandTo18Decimals(1),
        tokens[0].address,
        tokens[1].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    // sanity check
    it('token1: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(0),
        expandTo18Decimals(1),
        tokens[1].address,
        tokens[0].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    it('token0: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(-887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1'))
    })

    it('token1: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(-887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(
        BigNumber.from('115783384738768196242144082653949453838306988932806144552194799290216044976282')
      )
    })

    it('token0: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(
        BigNumber.from('115783384785599357996676985412062652720342362943929506828539444553934033845703')
      )
    })

    it('token1: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1'))
    })

    it('gas test', async () => {
      await snapshotGasCost(
        oracle.getGasCostOfGetQuoteAtTick(
          BigNumber.from(10),
          expandTo18Decimals(1),
          tokens[0].address,
          tokens[1].address
        )
      )
    })
  })
})
