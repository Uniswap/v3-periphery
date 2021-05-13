import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber } from 'ethers'
import { IUniswapV3Factory, OracleTest, TestUniswapV3Callee, TestERC20, TickMathTest } from '../typechain'
import {
  createPoolFunctions,
  createPositions,
  createSwaps,
  PoolTestCase,
  SwapFunction,
  SwapTestCase,
} from './shared/poolUtilities'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'
import completeFixture from './shared/completeFixture'
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'

const TEST_POOL: PoolTestCase = {
  description: 'medium fee, 1:1 price, 2e18 max range liquidity',
  feeAmount: FeeAmount.MEDIUM,
  tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  startingPrice: encodePriceSqrt(1, 1),
  positions: [
    {
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      liquidity: expandTo18Decimals(2),
    },
  ],
  swapTests: [],
}

describe('OracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let factory: IUniswapV3Factory
  let tokens: TestERC20[]
  let oracle: OracleTest
  let swapExact0For1: SwapFunction
  let swapExact1For0: SwapFunction

  const provider = waffle.provider
  const wallets = waffle.provider.getWallets()

  const ONE_FOR_ZERO_SWAPS: SwapTestCase[] = [
    {
      zeroForOne: false,
      exactOut: false,
      amount1: expandTo18Decimals(3),
      increaseTime: 4,
    },
    {
      zeroForOne: false,
      exactOut: false,
      amount1: expandTo18Decimals(6),
      increaseTime: 9,
    },
    {
      zeroForOne: false,
      exactOut: false,
      amount1: expandTo18Decimals(2),
      increaseTime: 6,
    },
  ]

  const ZERO_FOR_ONE_SWAPS: SwapTestCase[] = [
    {
      zeroForOne: true,
      exactOut: false,
      amount0: expandTo18Decimals(3),
      increaseTime: 4,
    },
    {
      zeroForOne: true,
      exactOut: false,
      amount0: expandTo18Decimals(6),
      increaseTime: 9,
    },
    {
      zeroForOne: true,
      exactOut: false,
      amount0: expandTo18Decimals(2),
      increaseTime: 6,
    },
  ]

  const oracleTestFixture = async () => {
    const { factory, tokens } = await completeFixture(wallets, provider)

    const oracleFactory = await ethers.getContractFactory('OracleTest')
    const oracle = await oracleFactory.deploy()

    const calleeFactory = await ethers.getContractFactory('TestUniswapV3Callee')
    const swapTarget = (await calleeFactory.deploy()) as TestUniswapV3Callee

    await factory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
    const pool = poolAtAddress(
      computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM),
      wallets[0]
    )

    const { swapExact0For1, swapExact1For0, mint } = createPoolFunctions({
      swapTarget: swapTarget,
      token0: tokens[0],
      token1: tokens[1],
      pool: pool,
    })

    await pool.initialize(TEST_POOL.startingPrice)
    await pool.increaseObservationCardinalityNext(5)
    await createPositions(TEST_POOL.positions, wallets[0].address, mint)

    return {
      factory: factory as IUniswapV3Factory,
      tokens: tokens as TestERC20[],
      oracle: oracle as OracleTest,
      swapExact0For1: swapExact0For1 as SwapFunction,
      swapExact1For0: swapExact1For0 as SwapFunction,
    }
  }

  describe('#consult', () => {
    before('create fixture loader', async () => {
      loadFixture = waffle.createFixtureLoader(wallets)
    })

    beforeEach('deploy fixture', async () => {
      const fixtures = await loadFixture(oracleTestFixture)
      factory = fixtures['factory']
      tokens = fixtures['tokens']
      oracle = fixtures['oracle']
      swapExact0For1 = fixtures['swapExact0For1']
      swapExact1For0 = fixtures['swapExact1For0']
    })

    it('reverts when period is 0', async () => {
      await expect(
        oracle.consult(factory.address, tokens[0].address, tokens[1].address, TEST_POOL.feeAmount, BigNumber.from(0))
      ).to.be.revertedWith('BP')
    })

    it('correct output tick when tick is positve', async () => {
      const PERIOD = BigNumber.from(11)

      await createSwaps(ONE_FOR_ZERO_SWAPS, provider, swapExact0For1, swapExact1For0)

      // Always round to negative infinity
      // In this case, we don't have do anything
      const tickCumulatives = [BigNumber.from(109740), BigNumber.from(421229)]
      const calculatedTick = tickCumulatives[1].sub(tickCumulatives[0]).div(BigNumber.from(PERIOD))

      const oracleTick = await oracle.consult(
        factory.address,
        tokens[0].address,
        tokens[1].address,
        TEST_POOL.feeAmount,
        PERIOD
      )

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('correct output when tick is negative', async () => {
      const PERIOD = BigNumber.from(11)

      await createSwaps(ZERO_FOR_ONE_SWAPS, provider, swapExact0For1, swapExact1For0)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      const tickCumulatives = [BigNumber.from(-109746), BigNumber.from(-421246)]
      const calculatedTick = tickCumulatives[1]
        .sub(tickCumulatives[0])
        .div(BigNumber.from(PERIOD))
        .sub(BigNumber.from(1))

      const oracleTick = await oracle.consult(
        factory.address,
        tokens[0].address,
        tokens[1].address,
        TEST_POOL.feeAmount,
        PERIOD
      )

      expect(oracleTick).to.equal(BigNumber.from(calculatedTick))
    })

    it('gas test', async () => {
      const PERIOD = BigNumber.from(11)

      await createSwaps(ZERO_FOR_ONE_SWAPS, provider, swapExact0For1, swapExact1For0)

      await snapshotGasCost(
        oracle.getGasCostOfConsult(factory.address, tokens[0].address, tokens[1].address, TEST_POOL.feeAmount, PERIOD)
      )
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

    it('token0: returns correct value when 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(10),
        expandTo18Decimals(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('1001000450120021002'))
    })

    it('token1: returns correct value when 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(10),
        expandTo18Decimals(1),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('999000549780071479'))
    })

    it('token0: returns correct value when sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(getMaxTick(TEST_POOL.feeAmount)),
        expandTo18Decimals(1),
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('271106558174734753828546514948592044174000833692526031838'))
    })

    it('token1: returns correct value when sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracle.getQuoteAtTick(
        BigNumber.from(443637),
        expandTo18Decimals(10000000),
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(BigNumber.from('542067'))
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
