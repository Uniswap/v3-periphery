import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, constants } from 'ethers'
import { OracleTest, TestERC20 } from '../typechain'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { getMaxTick, getMinTick } from './shared/ticks'
import snapshotGasCost from './shared/snapshotGasCost'
import { FeeAmount } from './shared/constants'

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

    const oracleFactory = await ethers.getContractFactory('OracleTest')
    const oracle = await oracleFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      oracle: oracle as OracleTest,
    }
  }

  describe('#consult', () => {
    before('create fixture loader', async () => {
      loadFixture = waffle.createFixtureLoader(wallets)
    })

    beforeEach('deploy fixture', async () => {
      const fixtures = await loadFixture(oracleTestFixture)
      tokens = fixtures['tokens']
      oracle = fixtures['oracle']
    })

    it('reverts when period is 0', async () => {
      await expect(oracle.consult(oracle.address, BigNumber.from(0))).to.be.revertedWith('BP')
    })

    it('correct output when tick is positve', async () => {
      const PERIOD = BigNumber.from(11)

      // Always round to negative infinity
      // In this case, we don't have do anything
      const tickCumulatives = [BigNumber.from(109740), BigNumber.from(421229)]
      const calculatedTick = tickCumulatives[1].sub(tickCumulatives[0]).div(BigNumber.from(PERIOD))

      const oracleTick = await oracle.consult(oracle.address, PERIOD)

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('correct output when tick is negative', async () => {
      const PERIOD = BigNumber.from(22)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      const tickCumulatives = [BigNumber.from(-109746), BigNumber.from(-421246)]
      const calculatedTick = tickCumulatives[1]
        .sub(tickCumulatives[0])
        .div(BigNumber.from(PERIOD))
        .sub(BigNumber.from(1))

      const oracleTick = await oracle.consult(oracle.address, PERIOD)

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('gas test', async () => {
      const PERIOD = BigNumber.from(11)

      await snapshotGasCost(oracle.getGasCostOfConsult(oracle.address, PERIOD))
    })
  })

  describe('#getQuoteAtTick', () => {
    before('create fixture loader', async () => {
      loadFixture = waffle.createFixtureLoader(wallets)
    })

    beforeEach('deploy fixture', async () => {
      const fixtures = await loadFixture(oracleTestFixture)
      tokens = fixtures['tokens']
      oracle = fixtures['oracle']
    })

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
        BigNumber.from(getMinTick(FeeAmount.MEDIUM)),
        BigNumber.from(2).pow(128).sub(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1'))
    })

    it('token1: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(getMinTick(FeeAmount.MEDIUM)),
        BigNumber.from(2).pow(128).sub(1),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(
        BigNumber.from('92252781291700498937204549452667720836827086935960705402076732007916912115530')
      )
    })

    it('token0: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(getMaxTick(FeeAmount.MEDIUM)),
        BigNumber.from(2).pow(128).sub(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(
        BigNumber.from('92252781303487840575489571037701809782439021325602413126085498571520800050278')
      )
    })

    it('token1: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(getMaxTick(FeeAmount.MEDIUM)),
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
