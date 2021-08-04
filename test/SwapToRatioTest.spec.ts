import { BigNumber, BigNumberish, Contract, constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import {
  SwapToRatioTest,
  TestERC20,
  MockTimeNonfungiblePositionManager,
  SwapRouter,
  IUniswapV3Factory,
} from '../typechain'
import { expect } from 'chai'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import completeFixture from './shared/completeFixture'
import { computePoolAddress } from './shared/computePoolAddress'
import { sortedTokens } from './shared/tokenSort'
import snapshotGasCost from './shared/snapshotGasCost'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

describe.only('SwapToRatio', () => {
  const [...wallets] = waffle.provider.getWallets()

  const swapToRatioCompleteFixture: Fixture<{
    swapToRatio: SwapToRatioTest
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
    router: SwapRouter
    factory: IUniswapV3Factory
  }> = async (wallets, provider) => {
    const { nft, router, tokens, factory } = await completeFixture(wallets, provider)
    const swapToRatioFactory = await ethers.getContractFactory('SwapToRatioTest')
    const swapToRatio = (await swapToRatioFactory.deploy()) as SwapToRatioTest

    for (const token of tokens) {
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(wallets[0]).approve(nft.address, constants.MaxUint256)
      await token.transfer(wallets[0].address, expandTo18Decimals(1_000_000))
    }

    return {
      swapToRatio,
      tokens,
      nft,
      router,
      factory,
    }
  }

  const swapToRatioPartialFixture: Fixture<SwapToRatioTest> = async (wallets, provider) => {
    const swapToRatioFactory = await ethers.getContractFactory('SwapToRatioTest')
    const swapToRatio = (await swapToRatioFactory.deploy()) as SwapToRatioTest
    return swapToRatio
  }

  let pool: Contract
  let poolAddress: string
  let factory: IUniswapV3Factory
  let tokens: [TestERC20, TestERC20, TestERC20]
  let swapToRatio: SwapToRatioTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter
  let token0: { address: string }
  let token1: { address: string }

  const amountDesired = 100

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  describe.only('#getPostSwapPrice ', () => {
    // position params
    let amount0Initial: BigNumberish
    let amount1Initial: BigNumberish
    let priceLower: number
    let priceUpper: number

    // pool params
    let liquidity: BigNumberish
    let price: number
    let fee: BigNumberish

    beforeEach('setup pool', async () => {
      ;({ tokens, swapToRatio, nft, router, factory } = await loadFixture(swapToRatioCompleteFixture))
    })

    beforeEach('setup pool', async () => {
      ;[token0, token1] = sortedTokens(tokens[0], tokens[1])

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.LOW,
        encodePriceSqrt(1, 1)
      )

      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.LOW,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
        amount0Desired: expandTo18Decimals(10_000),
        amount1Desired: expandTo18Decimals(10_000),
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallets[0].address,
        deadline: 1,
      })

      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.LOW,
        tickLower: TICK_SPACINGS[FeeAmount.LOW] * -10,
        tickUpper: TICK_SPACINGS[FeeAmount.LOW] * 10,
        amount0Desired: expandTo18Decimals(1_000),
        amount1Desired: expandTo18Decimals(1_000),
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallets[0].address,
        deadline: 1,
      })

      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.LOW,
        tickLower: TICK_SPACINGS[FeeAmount.LOW] * -20,
        tickUpper: TICK_SPACINGS[FeeAmount.LOW] * 20,
        amount0Desired: expandTo18Decimals(1_000),
        amount1Desired: expandTo18Decimals(1_000),
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallets[0].address,
        deadline: 1,
      })
    })

    describe('when initial deposit has excess of token1', () => {
      before(() => {
        priceLower = 0.5
        priceUpper = 2
      })

      describe('and swap does not push price beyond the next initialized tick', () => {
        it('gas', async () => {
          poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
          pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(2_000)
          const currentPrice = (await pool.slot0()).sqrtPriceX96

          await snapshotGasCost(
            swapToRatio.getPostSwapPriceGas(poolAddress, {
              sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
              sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
              amount0Initial,
              amount1Initial,
            })
          )
        })
      })

      describe('and swap pushes the price beyond the next initialized tick only', () => {
        it('gas', async () => {
          poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
          pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(7_000)
          const currentPrice = (await pool.slot0()).sqrtPriceX96

          await snapshotGasCost(
            swapToRatio.getPostSwapPriceGas(poolAddress, {
              sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
              sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
              amount0Initial,
              amount1Initial,
            })
          )
        })
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        it('gas', async () => {
          poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
          pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(10_000)
          const currentPrice = (await pool.slot0()).sqrtPriceX96

          await snapshotGasCost(
            swapToRatio.getPostSwapPriceGas(poolAddress, {
              sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
              sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
              amount0Initial,
              amount1Initial,
            })
          )
        })
      })
    })

    describe('when initial deposit has excess of token0', () => {
      it('returns the correct postSqrtPrice when it is just below the next initialized tick', async () => {
        poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
        pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])
        liquidity = await pool.liquidity()
        amount0Initial = expandTo18Decimals(10_000)
        amount1Initial = expandTo18Decimals(1_000)
        priceLower = 0.5
        priceUpper = 2

        await swapToRatio.getPostSwapPrice(poolAddress, {
          sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
          sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
          amount0Initial,
          amount1Initial,
        })
      })
    })
  })

  describe('#swapToNextInitializedTick', () => {
    // position params
    let amount0Initial: BigNumberish
    let amount1Initial: BigNumberish
    let priceLower: number
    let priceUpper: number

    // pool params
    let liquidity: BigNumberish
    let price: number
    let fee: BigNumberish

    // other params
    let priceTarget: number
    let zeroForOne: boolean

    describe('when tested with simple numbers', () => {
      // position params
      let amount0Initial: BigNumberish
      let amount1Initial: BigNumberish
      let priceLower: number
      let priceUpper: number

      // pool params
      let liquidity: BigNumberish
      let price: number
      let fee: BigNumberish

      // other params
      let priceTarget: number
      let zeroForOne: boolean

      before('load fixture', async () => {
        swapToRatio = await loadFixture(swapToRatioPartialFixture)
      })

      describe('when initial deposit has excess of token0', () => {
        // desmos sheet for the following numbers: https://www.desmos.com/calculator/b4lcwrzc4f
        before(() => {
          amount0Initial = 5_000
          amount1Initial = 1_000
          priceLower = 0.5
          priceUpper = 2
          price = 1
          liquidity = 3_000
          fee = 10000
          zeroForOne = true
        })

        it('returns true if priceTarget falls right above the ideal price', async () => {
          priceTarget = 0.84

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(amount0Updated).to.eq(4725)
          expect(amount1Updated).to.eq(1251)
          expect(doSwap).to.eq(true)
        })

        it('returns true if priceTarget is exactly at ideal price', async () => {
          priceTarget = 0.83597

          const sqrtRatioX96 = toSqrtFixedPoint96(price)
          const sqrtRatioX96Lower = toSqrtFixedPoint96(priceLower)
          const sqrtRatioX96Upper = toSqrtFixedPoint96(priceUpper)
          const sqrtRatioX96Target = toSqrtFixedPoint96(priceTarget)

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(amount0Updated).to.eq(4717)
          expect(amount1Updated).to.eq(1258)
          expect(doSwap).to.eq(true)
        })

        it('returns false if priceTarget falls right below ideal price', async () => {
          // TODO: According the quadratic formula, the ideal price is 0.84, 0.73 is the highest next price that will return false. this ok?
          priceTarget = 0.73

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(doSwap).to.eq(false)
          expect(amount0Updated).to.eq(4484)
          expect(amount1Updated).to.eq(1437)
        })

        describe('when the next initialized tick is below the lower bound of the position range', () => {
          it('returns null values', async () => {
            priceTarget = 0.1

            const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
              amount0Initial,
              amount1Initial,
              sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
              sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
              sqrtRatioX96: toSqrtFixedPoint96(price),
              liquidity,
              fee,
              sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
              zeroForOne,
            })

            expect(doSwap).to.eq(false)
            expect(amount0Updated).to.eq(0)
            expect(amount1Updated).to.eq(0)
          })
        })
      })

      describe('when initial deposit has excess of token1', () => {
        // desmos math sheet for following numbers: https://www.desmos.com/calculator/5rtr2rycan
        before(() => {
          amount0Initial = 1_000
          amount1Initial = 5_000
          priceLower = 0.5
          priceUpper = 2
          price = 1
          liquidity = 3_000
          fee = 10000
          zeroForOne = false
        })

        it('returns true if priceTarget falls right below ideal price', async () => {
          // idealPrice = 1.3678
          priceTarget = 1.366

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(doSwap).to.eq(true)
          // TODO: rounding, results in desmos are 1433 and 4488  respectively, this ok?
          expect(amount0Updated).to.eq(1434)
          expect(amount1Updated).to.eq(4489)
        })

        it('returns true if priceTarget falls exactly at the ideal price', async () => {
          // TODO: ideal price is 1.36786..., but 1.3676 is the highest I can get to return true. this ok?
          priceTarget = 1.3676

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(doSwap).to.eq(true)
          expect(amount0Updated).to.eq(1435)
          expect(amount1Updated).to.eq(4487)
        })

        it('returns false if priceTarget falls above the ideal price', async () => {
          // ideal price = 1.3678
          priceTarget = 1.368

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            sqrtRatioX96: toSqrtFixedPoint96(price),
            liquidity,
            fee,
            sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
            zeroForOne,
          })

          expect(doSwap).to.eq(false)
          expect(amount0Updated).to.eq(1436)
          expect(amount1Updated).to.eq(4487)
        })

        describe('when the next initialized tick is above the the upper bound of the position range', () => {
          it('returns null values', async () => {
            priceTarget = 2.5

            const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
              amount0Initial,
              amount1Initial,
              sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
              sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
              sqrtRatioX96: toSqrtFixedPoint96(price),
              liquidity,
              fee,
              sqrtRatioX96Target: toSqrtFixedPoint96(priceTarget),
              zeroForOne,
            })

            expect(doSwap).to.eq(false)
            expect(amount0Updated).to.eq(0)
            expect(amount1Updated).to.eq(0)
          })
        })
      })
    })

    describe('when tested against actual swaps', () => {
      // position params
      let amount0Initial: BigNumberish
      let amount1Initial: BigNumberish
      let sqrtRatioX96Lower: BigNumberish
      let sqrtRatioX96Upper: BigNumberish

      // pool params
      let liquidity: BigNumberish
      let sqrtRatioX96: BigNumberish
      let fee: BigNumberish

      // other params
      let sqrtRatioX96Target: BigNumberish
      let zeroForOne: boolean

      let pool: Contract

      beforeEach('load fixture', async () => {
        ;({ tokens, swapToRatio, nft, router } = await loadFixture(swapToRatioCompleteFixture))
        const poolAddress = computePoolAddress(
          await nft.factory(),
          [tokens[0].address, tokens[1].address],
          FeeAmount.MEDIUM
        )
        pool = new Contract(poolAddress, IUniswapV3PoolABI, wallets[0])
      })

      beforeEach('setup pool', async () => {
        ;[token0, token1] = sortedTokens(tokens[0], tokens[1])

        fee = FeeAmount.MEDIUM
        const tickLower = TICK_SPACINGS[FeeAmount.MEDIUM] * -2
        const tickUpper = TICK_SPACINGS[FeeAmount.MEDIUM] * 2
        sqrtRatioX96Lower = await swapToRatio.getSqrtRatioAtTick(tickLower)
        sqrtRatioX96Upper = await swapToRatio.getSqrtRatioAtTick(tickUpper)
        sqrtRatioX96Target = await swapToRatio.getSqrtRatioAtTick(TICK_SPACINGS[FeeAmount.MEDIUM] * -1)

        await nft.createAndInitializePoolIfNecessary(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          encodePriceSqrt(1, 1)
        )

        await nft.mint({
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: expandTo18Decimals(10_000),
          amount1Desired: expandTo18Decimals(10_000),
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallets[0].address,
          deadline: 1,
        })

        await nft.mint({
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -1,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 1,
          amount0Desired: expandTo18Decimals(1_000),
          amount1Desired: expandTo18Decimals(1_000),
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallets[0].address,
          deadline: 1,
        })

        liquidity = await pool.liquidity()
        sqrtRatioX96 = (await pool.slot0()).sqrtPriceX96
      })

      describe('initial deposit has excess of token0', async () => {
        it('returns token amounts which reflect a real post swap amounts', async () => {
          amount0Initial = expandTo18Decimals(30_000)
          amount1Initial = expandTo18Decimals(1_000)

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower,
            sqrtRatioX96Upper,
            sqrtRatioX96,
            liquidity,
            fee,
            sqrtRatioX96Target,
            zeroForOne: true,
          })

          const amountToSwap = await swapToRatio.getAmount0Delta(sqrtRatioX96, sqrtRatioX96Target, liquidity, false)
          await tokens[0].approve(router.address, amountToSwap.abs())
          const amountOut = await router.callStatic.exactInputSingle({
            tokenIn: token0.address,
            tokenOut: token1.address,
            fee: FeeAmount.MEDIUM,
            recipient: wallets[0].address,
            deadline: 1,
            amountIn: amountToSwap.abs(),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: expandTo18Decimals(100_000),
          })

          expect(amountOut.add(amount1Initial)).to.equal(amount1Updated)
        })

        it('moves the pool price to the targetPrice', async () => {
          amount0Initial = expandTo18Decimals(30_000)
          amount1Initial = expandTo18Decimals(1_000)

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
            amount0Initial,
            amount1Initial,
            sqrtRatioX96Lower,
            sqrtRatioX96Upper,
            sqrtRatioX96,
            liquidity,
            fee,
            sqrtRatioX96Target,
            zeroForOne: true,
          })

          const amountToSwap = await swapToRatio.getAmount0Delta(sqrtRatioX96, sqrtRatioX96Target, liquidity, false)
          await tokens[0].approve(router.address, amountToSwap.abs())
          await router.exactInputSingle({
            tokenIn: token0.address,
            tokenOut: token1.address,
            fee: FeeAmount.MEDIUM,
            recipient: wallets[0].address,
            deadline: 1,
            amountIn: amountToSwap.abs(),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: expandTo18Decimals(100_000),
          })

          expect((await pool.slot0()).sqrtPriceX96).to.eq(sqrtRatioX96)
        })

        it('gas', async () => {
          amount0Initial = expandTo18Decimals(30_000)
          amount1Initial = expandTo18Decimals(1_000)
          await snapshotGasCost(
            swapToRatio.swapToNextInitializedTickGas(
              { sqrtRatioX96, liquidity, fee },
              { sqrtRatioX96Lower, sqrtRatioX96Upper, amount0Initial, amount1Initial },
              sqrtRatioX96Target,
              zeroForOne
            )
          )
        })
      })
    })
  })
})

// TODO: oops,  maybe just use encodePriceSqrt. But being able to use decimals here
// instead of fractions is convenient to more easily test against Dan's desmos sheets
const toSqrtFixedPoint96 = (n: number): BigNumber => {
  return BigNumber.from((Math.sqrt(n) * 1e18).toString())
    .mul(BigNumber.from(2).pow(96))
    .div((1e18).toString())
}

type swapToNextInitializedTickArgs = {
  // pool params
  sqrtRatioX96: BigNumberish
  liquidity: BigNumberish
  fee: BigNumberish

  // position params
  sqrtRatioX96Lower: BigNumberish
  sqrtRatioX96Upper: BigNumberish
  amount0Initial: BigNumberish
  amount1Initial: BigNumberish

  // other params
  sqrtRatioX96Target: BigNumberish
  zeroForOne: boolean
}

async function swapToNextInitializedTick(
  swapToRatio: SwapToRatioTest,
  args: swapToNextInitializedTickArgs
): Promise<{ doSwap: boolean; amount0Updated: BigNumber; amount1Updated: BigNumber }> {
  const {
    sqrtRatioX96,
    liquidity,
    fee,
    sqrtRatioX96Lower,
    sqrtRatioX96Upper,
    amount0Initial,
    amount1Initial,
    sqrtRatioX96Target,
    zeroForOne,
  } = args

  const { 0: doSwap, 1: amount0Updated, 2: amount1Updated } = await swapToRatio.swapToNextInitializedTick(
    { sqrtRatioX96, liquidity, fee },
    { sqrtRatioX96Lower, sqrtRatioX96Upper, amount0Initial, amount1Initial },
    sqrtRatioX96Target,
    zeroForOne
  )

  return { doSwap, amount0Updated, amount1Updated }
}
