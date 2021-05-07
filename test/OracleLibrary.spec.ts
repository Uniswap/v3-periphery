import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber } from 'ethers'
import {
  IUniswapV3Pool,
  IUniswapV3Factory,
  TickMathTest,
  OracleTest,
  TestUniswapV3Callee,
  TestERC20,
} from '../typechain'
import { getNearestTick, initializePool, PoolTestCase, SwapTestCase } from './shared/poolUtilities'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'
import completeFixture from './shared/completeFixture'
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'

const ONE_FOR_ZERO_SWAP_TESTS: SwapTestCase[] = [
  {
    zeroForOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(5),
    increaseTime: 3,
  },
  {
    zeroForOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(5),
    increaseTime: 5,
  },
]

const ZERO_FOR_ONE_SWAP_TESTS: SwapTestCase[] = [
  {
    zeroForOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(5),
    increaseTime: 3,
  },
  {
    zeroForOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(5),
    increaseTime: 5,
  },
]

const TEST_POOLS: PoolTestCase[] = [
  {
    description: 'medium fee, 1:1 price, 2e18 max range liquidity, positive tick',
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
    swapTests: ONE_FOR_ZERO_SWAP_TESTS,
  },
  {
    description: 'medium fee, 1:1 price, 2e18 max range liquidity, negative tick',
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
    swapTests: ZERO_FOR_ONE_SWAP_TESTS,
  },
  {
    description: 'medium fee, sqrtRatio overflow uint128, 2eb18 max range liquidity',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(BigNumber.from(2).pow(127), 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
    swapTests: ONE_FOR_ZERO_SWAP_TESTS,
  },
]

describe('OracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let factory: IUniswapV3Factory
  let pool: IUniswapV3Pool
  let oracle: OracleTest
  let tickMath: TickMathTest
  let tokens: TestERC20[]

  const provider = waffle.provider
  const wallets = waffle.provider.getWallets()

  for (const poolCase of TEST_POOLS) {
    const BASE_AMOUNT = expandTo18Decimals(1)
    const SECONDS_AGO = BigNumber.from(7)

    describe(poolCase.description, () => {
      const oracleTestFixture = async () => {
        const { factory, tokens } = await completeFixture(wallets, provider)

        const tickMathTestFactory = await ethers.getContractFactory('TickMathTest')
        const tickMath = await tickMathTestFactory.deploy()

        const oracleFactory = await ethers.getContractFactory('OracleTest')
        const oracle = await oracleFactory.deploy()

        const calleeFactory = await ethers.getContractFactory('TestUniswapV3Callee')
        const swapTarget = (await calleeFactory.deploy()) as TestUniswapV3Callee

        await factory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        const pool = poolAtAddress(
          computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM),
          wallets[0]
        )

        await initializePool(poolCase, provider, wallets, tokens, pool, swapTarget)

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
        tokens = fixtures['tokens']
        pool = fixtures['pool']
        oracle = fixtures['oracle']
        tickMath = fixtures['tickMath']
      })

      const testConsult = async (
        baseToken: string,
        quoteToken: string,
        getCalculatedQuoteAmount: (period: BigNumber) => Promise<BigNumber>
      ) => {
        const secondsAgo = BigNumber.from(SECONDS_AGO)
        const calculatedQuoteAmount = await getCalculatedQuoteAmount(secondsAgo)
        const oracleQuoteAmount = await oracle.consult(
          factory.address,
          baseToken,
          quoteToken,
          poolCase.feeAmount,
          BASE_AMOUNT,
          secondsAgo
        )

        expect(oracleQuoteAmount).to.equal(calculatedQuoteAmount)
      }

      const testConsultGas = async (baseToken: string, quoteToken: string) => {
        const secondsAgo = BigNumber.from(SECONDS_AGO)
        await snapshotGasCost(
          oracle.getGasCostOfConsult(
            factory.address,
            baseToken,
            quoteToken,
            poolCase.feeAmount,
            BASE_AMOUNT,
            secondsAgo
          )
        )
      }

      it('reverts when period is 0', async () => {
        await expect(
          oracle.consult(
            factory.address,
            tokens[0].address,
            tokens[1].address,
            poolCase.feeAmount,
            BASE_AMOUNT,
            BigNumber.from(0)
          )
        ).to.be.revertedWith('BP')
      })

      it('token0: output correct quote', async () => {
        const getCalculatedQuoteAmount = async (period: BigNumber) => {
          const tick = await getNearestTick(period, pool)
          const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

          if (sqrtRatioX96.lte(MaxUint128)) {
            const ratioX192 = sqrtRatioX96.pow(2)
            return ratioX192.mul(BASE_AMOUNT).div(BigNumber.from(2).pow(192))
          } else {
            const ratioX128 = sqrtRatioX96.pow(2).div(BigNumber.from(2).pow(64))
            return ratioX128.mul(BASE_AMOUNT).div(BigNumber.from(2).pow(128))
          }
        }

        await testConsult(tokens[0].address, tokens[1].address, getCalculatedQuoteAmount)
      })

      it('token0: gas test', async () => {
        await testConsultGas(tokens[0].address, tokens[1].address)
      })

      it('token1: output correct quote', async () => {
        const getCalculatedQuoteAmount = async (period: BigNumber) => {
          const tick = await getNearestTick(period, pool)
          const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

          if (sqrtRatioX96.lte(MaxUint128)) {
            const ratioX192 = sqrtRatioX96.pow(2)
            return BigNumber.from(2).pow(192).mul(BASE_AMOUNT).div(ratioX192)
          } else {
            const ratioX128 = sqrtRatioX96.pow(2).div(BigNumber.from(2).pow(64))
            return BigNumber.from(2).pow(128).mul(BASE_AMOUNT).div(ratioX128)
          }
        }

        await testConsult(tokens[1].address, tokens[0].address, getCalculatedQuoteAmount)
      })

      it('token1: gas test', async () => {
        await testConsultGas(tokens[0].address, tokens[1].address)
      })
    })
  }
})
