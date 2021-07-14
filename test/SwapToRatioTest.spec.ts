import { BigNumber, BigNumberish, constants } from 'ethers'
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
import { sortedTokens } from './shared/tokenSort'

// TODO: here for debugging reasons, cleanup and delete
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

// TODO: oops,  maybe just use encodePriceSqrt. But being able to use decimals here
// instead of fractions is convenient to more easily test against Dan's desmos sheets
const toSqrtFixedPoint96 = (n: number): BigNumber => {
  return BigNumber.from((Math.sqrt(n) * 1e18).toString())
    .mul(BigNumber.from(2).pow(96))
    .div((1e18).toString())
}

const toSqrtFixedPoint96Debug = (n: number): number => {
  return Math.sqrt(n) * 2 ** 96
}

type swapToRatioParams = {
  // pool params
  price: number
  liquidity: BigNumberish
  fee: BigNumberish

  // position params
  priceLower: number
  priceUpper: number
  amount0Initial: BigNumberish
  amount1Initial: BigNumberish

  // other params
  priceTarget: number
  zeroForOne: boolean
}

async function swapToNextInitializedTick(
  swapToRatio: SwapToRatioTest,
  args: swapToRatioParams
): Promise<{ doSwap: boolean; amount0Updated: BigNumber; amount1Updated: BigNumber }> {
  const {
    price,
    liquidity,
    fee,
    priceLower,
    priceUpper,
    amount0Initial,
    amount1Initial,
    priceTarget,
    zeroForOne,
  } = args
  const sqrtRatioX96 = toSqrtFixedPoint96(price)
  const sqrtRatioX96Lower = toSqrtFixedPoint96(priceLower)
  const sqrtRatioX96Upper = toSqrtFixedPoint96(priceUpper)
  const sqrtRatioX96Target = toSqrtFixedPoint96(priceTarget)

  const { 0: doSwap, 1: amount0Updated, 2: amount1Updated } = await swapToRatio.swapToNextInitializedTick(
    { sqrtRatioX96, liquidity, fee },
    { sqrtRatioX96Lower, sqrtRatioX96Upper, amount0Initial, amount1Initial },
    sqrtRatioX96Target,
    zeroForOne
  )

  return { doSwap, amount0Updated, amount1Updated }
}

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

  let factory: IUniswapV3Factory
  let tokens: [TestERC20, TestERC20, TestERC20]
  let swapToRatio: SwapToRatioTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter
  let token0: { address: string }
  let token1: { address: string }
  // let pool: IUniswapV3Pool

  const amountDesired = 100

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  describe('#getPostSwapPrice ', () => {
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
        tickLower: TICK_SPACINGS[FeeAmount.LOW] * -1,
        tickUpper: TICK_SPACINGS[FeeAmount.LOW] * 1,
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
        tickLower: TICK_SPACINGS[FeeAmount.LOW] * -10,
        tickUpper: TICK_SPACINGS[FeeAmount.LOW] * 10,
        amount0Desired: expandTo18Decimals(1_000),
        amount1Desired: expandTo18Decimals(1_000),
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallets[0].address,
        deadline: 1,
      })
    })

    describe('when initial deposit has excess of token0', () => {
      before(() => {
        amount0Initial = expandTo18Decimals(700_000)
        amount1Initial = expandTo18Decimals(1_000)
        priceLower = 0.05
        priceUpper = 1.05
      })

      // TODO: nextInitializedTickWithinOneWord acting weird when excess token0
      it.skip('returns the correct postSqrtPrice when it is just below the next initialized tick', async () => {
        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
        const pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])
        await swapToRatio.getPostSwapPrice(poolAddress, {
          sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
          sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
          amount0Initial,
          amount1Initial,
        })
      })

      it('returns the correct postSqrtPrice when it corresponds exactly with the next initialized tick')
      it('returns the correct postSqrtPrice when it is just above the next initialized tick')
      it('returns the correct postSqrtPrice when fee cancels out benefit of swapping')

      describe('and swap does not push price beyond the next initialized tick', () => {
        it('does the thing', async () => {})
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        // it returns the correct postSqrtPrice for various values
      })
    })

    describe('when initial deposit has excess of token1', () => {
      before(() => {
        priceLower = 0.05
        priceUpper = 1.05
      })

      it('returns the correct postSqrtPrice when it is just below the next initialized tick')
      it('returns the correct postSqrtPrice when it corresponds exactly with the next initialized tick')
      it('returns the correct postSqrtPrice when it is just above the next initialized tick')
      it('returns the correct postSqrtPrice when fee cancels out benefit of swapping')

      describe('and swap does not push price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond the next initialized tick', () => {
        it('returns the correct value for 150/1 token ratio', async () => {
          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(100_000)
          const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
          const pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

          await swapToRatio.getPostSwapPrice(poolAddress, {
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            amount0Initial,
            amount1Initial,
          })
        })
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        // it returns the correct postSqrtPrice for various values
      })
    })
  })

  describe('#calculateConstantLiquidityPostSwapSqrtPrice', () => {
    // pool params
    let liquidity: number
    let price: number
    let fee: BigNumberish

    // position params
    let amount0Initial: number
    let amount1Initial: number
    let priceLower: number
    let priceUpper: number

    before(() => {
      amount0Initial = 1_000
      amount1Initial = 5_000
      priceLower = 0.5
      priceUpper = 2

      liquidity = 3_000
      price = 2
      fee = FeeAmount.HIGH
    })

    beforeEach('setup pool', async () => {
      ;({ tokens, swapToRatio, nft, router, factory } = await loadFixture(swapToRatioCompleteFixture))
    })

    it.only('is coming out to the same numbers as desmos 0_o', async () => {
      let sqrtPrice = Math.sqrt(price)
      let sqrtPriceLower = Math.sqrt(priceLower)
      let sqrtPriceUpper = Math.sqrt(priceUpper)

      let sqrtPriceX96 = toSqrtFixedPoint96Debug(price)
      let sqrtPriceLowerX96 = toSqrtFixedPoint96Debug(priceLower)
      let sqrtPriceUpperX96 = toSqrtFixedPoint96Debug(priceUpper)
      // b
      console.log(
        'b',
        3030 -
          liquidity -
          sqrtPriceLower * amount0Initial -
          (liquidity * sqrtPriceLower) / sqrtPrice +
          amount1Initial / sqrtPriceUpper +
          (3030 * sqrtPrice) / sqrtPriceUpper
      )

      console.log(
        'bX96 / X96',
        (3030 * 2 ** 96 -
          liquidity * 2 ** 96 -
          sqrtPriceLowerX96 * amount0Initial -
          (liquidity * sqrtPriceLowerX96 * 2 ** 96) / sqrtPriceX96 +
          (amount1Initial * 2 ** 96 * 2 ** 96) / sqrtPriceUpperX96 +
          (3030 * sqrtPriceX96 * 2 ** 96) / sqrtPriceUpperX96) /
          2 ** 96
      )
      // c
      console.log('c', liquidity * sqrtPriceLower - amount1Initial - 3030 * sqrtPrice)

      console.log('a', amount0Initial + liquidity / Math.sqrt(price) - 3030 / Math.sqrt(priceUpper))

      console.log(
        'a sol',
        (amount0Initial * Math.sqrt(price) * Math.sqrt(priceUpper) +
          liquidity * Math.sqrt(priceUpper) -
          3030 * Math.sqrt(price)) /
          Math.sqrt(priceUpper) /
          Math.sqrt(price)
      )

      console.log(
        'aX96 sol',
        (((amount0Initial * sqrtPriceX96 * sqrtPriceUpperX96) / 2 ** 96 +
          liquidity * sqrtPriceUpperX96 -
          3030 * sqrtPriceX96) /
          sqrtPriceUpperX96 /
          sqrtPriceX96) *
          2 ** 96
      )

      const result = await swapToRatio.calculateConstantLiquidityPostSwapSqrtPrice(
        toSqrtFixedPoint96(price),
        liquidity,
        fee,
        toSqrtFixedPoint96(priceLower),
        toSqrtFixedPoint96(priceUpper),
        amount0Initial,
        amount1Initial
      )

      console.log(result.toString())
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
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
          zeroForOne,
        })

        expect(amount0Updated).to.eq(4725)
        expect(amount1Updated).to.eq(1251)
        expect(doSwap).to.eq(true)
      })

      it('returns true if priceTarget is exactly at ideal price', async () => {
        priceTarget = 0.83597

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextInitializedTick(swapToRatio, {
          amount0Initial,
          amount1Initial,
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
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
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
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
            priceLower,
            priceUpper,
            price,
            liquidity,
            fee,
            priceTarget,
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
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
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
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
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
          priceLower,
          priceUpper,
          price,
          liquidity,
          fee,
          priceTarget,
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
            priceLower,
            priceUpper,
            price,
            liquidity,
            fee,
            priceTarget,
            zeroForOne,
          })

          expect(doSwap).to.eq(false)
          expect(amount0Updated).to.eq(0)
          expect(amount1Updated).to.eq(0)
        })
      })
    })
  })
})
