import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, constants } from 'ethers'
import { OracleTest, TestERC20 } from '../typechain'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import snapshotGasCost from './shared/snapshotGasCost'

describe('OracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let tokens: TestERC20[]
  let oracles: OracleTest[]

  const wallets = waffle.provider.getWallets()

  const PERIOD = 11
  const POSITIVE_TICK_CUMULATIVES = [BigNumber.from(109740), BigNumber.from(421229)]
  const NEGATIVE_TICK_CUMULATIVES = [BigNumber.from(-109746), BigNumber.from(-421229)]

  const oracleTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    const oracleFactory = await ethers.getContractFactory('OracleTest')
    const oracles = (await Promise.all([
      oracleFactory.deploy([PERIOD, 0], POSITIVE_TICK_CUMULATIVES, [0, 0]), // do not use maxu256 to avoid overflowing
      oracleFactory.deploy([PERIOD, 0], NEGATIVE_TICK_CUMULATIVES, [0, 0]),
    ])) as [OracleTest, OracleTest]

    return {
      tokens: tokens as TestERC20[],
      oracles: oracles as OracleTest[],
    }
  }

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(oracleTestFixture)
    tokens = fixtures['tokens']
    oracles = fixtures['oracles']
  })

  describe('#consult', () => {
    it('reverts when period is 0', async () => {
      await expect(oracles[0].consult(oracles[0].address, 0)).to.be.revertedWith('BP')
    })

    it('correct output when tick is positve', async () => {
      // Always round to negative infinity
      // In this case, we don't have do anything
      const calculatedTick = POSITIVE_TICK_CUMULATIVES[1].sub(POSITIVE_TICK_CUMULATIVES[0]).div(PERIOD)
      const oracleTick = await oracles[0].consult(oracles[0].address, PERIOD)

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('correct output when tick is negative', async () => {
      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      const calculatedTick = NEGATIVE_TICK_CUMULATIVES[1].sub(NEGATIVE_TICK_CUMULATIVES[0]).div(PERIOD).sub(1)
      const oracleTick = await oracles[1].consult(oracles[1].address, PERIOD)

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('gas test', async () => {
      await snapshotGasCost(oracles[1].getGasCostOfConsult(oracles[1].address, PERIOD))
    })
  })

  describe('#getQuoteAtTick', () => {
    // sanity check
    it('token0: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracles[0].getQuoteAtTick(
        BigNumber.from(0),
        expandTo18Decimals(1),
        tokens[0].address,
        tokens[1].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    // sanity check
    it('token1: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracles[0].getQuoteAtTick(
        BigNumber.from(0),
        expandTo18Decimals(1),
        tokens[1].address,
        tokens[0].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    it('token0: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracles[0].getQuoteAtTick(
        BigNumber.from(-887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1'))
    })

    it('token1: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracles[0].getQuoteAtTick(
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
      const quoteAmount = await oracles[0].getQuoteAtTick(
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
      const quoteAmount = await oracles[0].getQuoteAtTick(
        BigNumber.from(887272),
        BigNumber.from(2).pow(128).sub(1),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1'))
    })

    it('gas test', async () => {
      await snapshotGasCost(
        oracles[0].getGasCostOfGetQuoteAtTick(
          BigNumber.from(10),
          expandTo18Decimals(1),
          tokens[0].address,
          tokens[1].address
        )
      )
    })
  })
})
