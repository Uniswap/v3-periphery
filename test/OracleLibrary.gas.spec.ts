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
import snapshotGasCost from './shared/snapshotGasCost'

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

describe('OracleLibrary gas tests', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let factory: IUniswapV3Factory
  let oracle: OracleTest
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
    oracle = fixtures['oracle']
  })

  describe('#consult', () => {
    it('base token: token 0', async () => {
      const secondsAgo = BigNumber.from(5)
      await snapshotGasCost(
        oracle.consultNonView(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          secondsAgo
        )
      )
    })

    it('base token: token 1', async () => {
      const secondsAgo = BigNumber.from(5)
      await snapshotGasCost(
        oracle.consultNonView(
          factory.address,
          token0.address,
          token1.address,
          FeeAmount.MEDIUM,
          BASE_AMOUNT,
          secondsAgo
        )
      )
    })
  })
})
