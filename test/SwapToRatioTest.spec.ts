import { BigNumber, BigNumberish, constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { SwapToRatioTest, TestERC20, MockTimeNonfungiblePositionManager, SwapRouter } from '../typechain'
import { expect } from 'chai'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import completeFixture from './shared/completeFixture'

const toFixedPoint96 = (n: number): BigNumber => {
  return BigNumber.from((Math.sqrt(n) * 1e18).toString())
    .mul(BigNumber.from(2).pow(96))
    .div((1e18).toString())
}

type swapToNextTickArgs = {
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

async function swapToNextTick(
  swapToRatio: SwapToRatioTest,
  args: swapToNextTickArgs
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
  const sqrtRatioX96 = toFixedPoint96(price)
  const sqrtRatioX96Lower = toFixedPoint96(priceLower)
  const sqrtRatioX96Upper = toFixedPoint96(priceUpper)
  const sqrtRatioX96Target = toFixedPoint96(priceTarget)

  const { 0: doSwap, 1: amount0Updated, 2: amount1Updated } = await swapToRatio.swapToNextTick(
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
  }> = async (wallets, provider) => {
    const { nft, router, tokens } = await completeFixture(wallets, provider)
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
    }
  }

  const swapToRatioPartialFixture: Fixture<SwapToRatioTest> = async (wallets, provider) => {
    const swapToRatioFactory = await ethers.getContractFactory('SwapToRatioTest')
    const swapToRatio = (await swapToRatioFactory.deploy()) as SwapToRatioTest
    return swapToRatio
  }

  let tokens: [TestERC20, TestERC20, TestERC20]
  let swapToRatio: SwapToRatioTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter

  const amountDesired = 100

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  describe('#getPostSwapPrice ', () => {
    describe('when initial deposit has excess of token0', () => {
      describe('and swap does not push price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        // it returns the correct postSqrtPrice for various values
      })

      it('returns the correct postSqrtPrice when it is just below the next initialized tick')
      it('returns the correct postSqrtPrice when it corresponds exactly with the next initialized tick')
      it('returns the correct postSqrtPrice when it is just above the next initialized tick')
      it('returns the correct postSqrtPrice when fee cancels out benefit of swapping')
    })

    describe('when initial deposit has excess of token1', () => {
      describe('and swap does not push price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        // it returns the correct postSqrtPrice for various values
      })

      it('returns the correct postSqrtPrice when it is just below the next initialized tick')
      it('returns the correct postSqrtPrice when it corresponds exactly with the next initialized tick')
      it('returns the correct postSqrtPrice when it is just above the next initialized tick')
      it('returns the correct postSqrtPrice when fee cancels out benefit of swapping')
    })
  })

  describe.only('#swapToNextTick', () => {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

        const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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

          const { doSwap, amount0Updated, amount1Updated } = await swapToNextTick(swapToRatio, {
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
