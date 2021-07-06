import { BigNumber, BigNumberish, constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { SwapToRatioTest, TestERC20, MockTimeNonfungiblePositionManager, SwapRouter } from '../typechain'
import { expect } from 'chai'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import completeFixture from './shared/completeFixture'

const toFixedPoint96 = (n: BigNumberish): BigNumberish => {
  return BigNumber.from(n).mul(BigNumber.from(2).pow(96))
}

type tradeToNextTickArgs = {
  sqrtPrice: BigNumberish
  liquidity: BigNumberish
  fee: BigNumberish
  sqrtPriceLower: BigNumberish
  sqrtPriceUpper: BigNumberish
  amount0Initial: BigNumberish
  amount1Initial: BigNumberish
  sqrtPriceTarget: BigNumberish
  zeroForOne: boolean
}

async function tradeToNextTick(swapToRatio: SwapToRatioTest, args: tradeToNextTickArgs): Promise<boolean> {
  const {
    sqrtPrice,
    liquidity,
    fee,
    sqrtPriceLower,
    sqrtPriceUpper,
    amount0Initial,
    amount1Initial,
    sqrtPriceTarget,
    zeroForOne,
  } = args
  const sqrtRatioX96 = toFixedPoint96(sqrtPrice)
  const sqrtRatioX96Lower = toFixedPoint96(sqrtPriceLower)
  const sqrtRatioX96Upper = toFixedPoint96(sqrtPriceUpper)
  const sqrtRatioX96Target = toFixedPoint96(sqrtPriceTarget)
  return swapToRatio.tradeToNextTick(
    { sqrtRatioX96, liquidity, fee },
    { sqrtRatioX96Lower, sqrtRatioX96Upper, amount0Initial, amount1Initial },
    sqrtRatioX96Target,
    zeroForOne
  )
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

  describe('#tradeToNextTick', () => {
    // position params
    let amount0Initial: BigNumberish
    let amount1Initial: BigNumberish
    let sqrtPriceLower: BigNumberish
    let sqrtPriceUpper: BigNumberish

    // pool params
    let liquidity: BigNumberish
    let sqrtPrice: BigNumberish
    let fee: BigNumberish

    // other params
    let sqrtPriceTarget: BigNumberish
    let zeroForOne: boolean

    before('load fixture', async () => {
      swapToRatio = await loadFixture(swapToRatioPartialFixture)
    })

    describe('when initial deposit has excess of token0', () => {
      it('returns true if sqrtPriceTarget falls right below next tick')
      it('returns true if sqrtPriceTarget falls exactly at next tick')
      it('returns false if sqrtPriceTarget falls right above next tick')
    })

    describe.only('when initial deposit has excess of token1', () => {
      it('returns false if sqrtPriceTarget falls right below next tick')
      it('returns false if sqrtPriceTarget falls exactly at next tick', async () => {
        amount0Initial = 2_000
        amount1Initial = 8_000
        sqrtPriceLower = 1_000
        sqrtPriceUpper = 2_000
        sqrtPrice = 1_500
        liquidity = 3_000
        fee = 10000
        sqrtPriceTarget = 1_505
        zeroForOne = false

        await tradeToNextTick(swapToRatio, {
          amount0Initial,
          amount1Initial,
          sqrtPriceLower,
          sqrtPriceUpper,
          sqrtPrice,
          liquidity,
          fee,
          sqrtPriceTarget,
          zeroForOne,
        })
      })

      it('returns true if sqrtPriceTarget falls right above next tick')
    })
  })
})
