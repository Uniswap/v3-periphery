import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, ContractTransaction } from 'ethers'
import {
  IUniswapV3Pool,
  IUniswapV3Factory,
  TickMathTest,
  OracleTest,
  TestUniswapV3Callee,
  TestERC20,
} from '../typechain'
import { createPoolFunctions, MintFunction, SwapFunction } from './shared/poolUtilities'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import completeFixture from './shared/completeFixture'
import poolAtAddress from './shared/poolAtAddress'

interface SwapExact0For1TestCase {
  zeroForOne: true
  exactOut: false
  amount0: BigNumberish
  sqrtPriceLimit?: BigNumber
  increaseTime: number
}

interface SwapExact1For0TestCase {
  zeroForOne: false
  exactOut: false
  amount1: BigNumberish
  sqrtPriceLimit?: BigNumber
  increaseTime: number
}

type SwapTestCase = SwapExact0For1TestCase | SwapExact1For0TestCase

describe('OracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let factory: IUniswapV3Factory
  let pool: IUniswapV3Pool
  let oracle: OracleTest
  let tickMath: TickMathTest
  let token0: TestERC20, token1: TestERC20

  let swapExact0For1: SwapFunction
  let swapExact1For0: SwapFunction
  let mint: MintFunction

  const provider = waffle.provider
  const wallets = waffle.provider.getWallets()
  const BASE_AMOUNT = expandTo18Decimals(1)
  const SWAP_RECIPIENT_ADDRESS = constants.AddressZero.slice(0, -1) + '1'
  const INIT_SWAPS: SwapTestCase[] = [
    {
      zeroForOne: false,
      exactOut: false,
      amount1: expandTo18Decimals(1),
      increaseTime: 3,
    },
    {
      zeroForOne: false,
      exactOut: false,
      amount1: expandTo18Decimals(1),
      increaseTime: 5,
    },
  ]

  const NEGATIVE_TICK_SWAPS: SwapTestCase[] = [
    {
      zeroForOne: true,
      exactOut: false,
      amount0: expandTo18Decimals(3),
      increaseTime: 3,
    },
    {
      zeroForOne: true,
      exactOut: false,
      amount0: expandTo18Decimals(3),
      increaseTime: 5,
    },
  ]

  const executeSwap = async (testCase: SwapTestCase): Promise<ContractTransaction> => {
    let swap: ContractTransaction

    await provider.send('evm_increaseTime', [testCase.increaseTime])

    if (testCase.zeroForOne) {
      swap = await swapExact0For1(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
    } else {
      swap = await swapExact1For0(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
    }

    return swap
  }

  const oracleTestFixture = async () => {
    const { factory, tokens } = await completeFixture(wallets, provider)
    const token0 = tokens[0]
    const token1 = tokens[1]

    const calleeFactory = await ethers.getContractFactory('TestUniswapV3Callee')
    const swapTarget = (await calleeFactory.deploy()) as TestUniswapV3Callee

    const createPoolReceipt = await (
      await factory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
    ).wait()
    const poolAddress = createPoolReceipt?.events?.pop()?.args?.pool
    const pool = poolAtAddress(poolAddress, wallets[0])

    const tickMathTestFactory = await ethers.getContractFactory('TickMathTest')
    const tickMath = await tickMathTestFactory.deploy()

    const oracleFactory = await ethers.getContractFactory('OracleTest')
    const oracle = await oracleFactory.deploy()

    ;({ swapExact0For1, swapExact1For0, mint } = createPoolFunctions({ swapTarget, token0, token1, pool }))

    await pool.initialize(encodePriceSqrt(1, 1))
    await pool.increaseObservationCardinalityNext(5)
    await mint(
      wallets[0].address,
      getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      expandTo18Decimals(1000)
    )

    for (const testCase of INIT_SWAPS) {
      await executeSwap(testCase)
    }

    return {
      factory: factory as IUniswapV3Factory,
      tokens: tokens as TestERC20[],
      pool: pool as IUniswapV3Pool,
      oracle: oracle as OracleTest,
      tickMath: tickMath as TickMathTest,
    }
  }

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(oracleTestFixture)
    factory = fixtures['factory']
    token0 = fixtures['tokens'][0]
    token1 = fixtures['tokens'][1]
    pool = fixtures['pool']
    oracle = fixtures['oracle']
    tickMath = fixtures['tickMath']
  })

  const getNearestTick = async (period: BigNumberish) => {
    const tickCumulatives = (await pool.observe([period, 0]))['tickCumulatives']
    const tickCumulativesDelta = tickCumulatives[1].sub(tickCumulatives[0])
    const tick = tickCumulativesDelta.div(period)

    // Always round tick to negative infinity
    return tick.lt(0) && !tickCumulativesDelta.mod(period).eq(0) ? tick.sub(1) : tick
  }

  describe('#consult', () => {
    it('reverts when period is 0', async () => {
      await expect(
        oracle.consult(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          BigNumber.from(0)
        )
      ).to.be.revertedWith('BP')
    })

    describe('when token0 is base token', async () => {
      const getCalculatedQuoteAmount = async (period: BigNumber) => {
        const tick = await getNearestTick(period)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)
        const ratioX192 = sqrtRatioX96.pow(2)

        return ratioX192.mul(BASE_AMOUNT).div(BigNumber.from(2).pow(192))
      }

      it('returns correct value on positive tick', async () => {
        const period = BigNumber.from(5)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('returns correct value on negative tick', async () => {
        for (const testCase of NEGATIVE_TICK_SWAPS) {
          await executeSwap(testCase)
        }

        const period = BigNumber.from(5)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('rounds positive tick to negative infinity', async () => {
        const period = BigNumber.from(7)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('rounds negative tick to negative infinity', async () => {
        for (const testCase of NEGATIVE_TICK_SWAPS) {
          await executeSwap(testCase)
        }

        const period = BigNumber.from(7)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })
    })

    describe('when token1 is base token', async () => {
      const getCalculatedQuoteAmount = async (period: BigNumber) => {
        const tick = await getNearestTick(period)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)
        const ratioX192 = sqrtRatioX96.pow(2)

        return BigNumber.from(2).pow(192).mul(BASE_AMOUNT).div(ratioX192)
      }

      it('returns correct value on positive tick', async () => {
        const period = BigNumber.from(5)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token1.address,
          token0.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('returns correct value on negative tick', async () => {
        for (const testCase of NEGATIVE_TICK_SWAPS) {
          await executeSwap(testCase)
        }

        const period = BigNumber.from(5)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token1.address,
          token0.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('rounds positive tick to negative infinity', async () => {
        const period = BigNumber.from(7)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token1.address,
          token0.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })

      it('rounds negative tick to negative infinity', async () => {
        for (const testCase of NEGATIVE_TICK_SWAPS) {
          await executeSwap(testCase)
        }

        const period = BigNumber.from(7)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(period)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          token1.address,
          token0.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          period
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      })
    })
  })
})
