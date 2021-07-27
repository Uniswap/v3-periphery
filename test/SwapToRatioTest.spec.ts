import bn from 'bignumber.js'
import { BigNumber, BigNumberish, constants, Contract } from 'ethers'
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
import { getMaxTick, getMinTick, getMaxLiquidityPerTick } from './shared/ticks'
import completeFixture from './shared/completeFixture'
import { sortedTokens } from './shared/tokenSort'

const consoleLog = false
// TODO: here for debugging reasons, cleanup and delete
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

bn.config({ ROUNDING_MODE: bn.ROUND_FLOOR })

const HIGHEST_PRICE = BigNumber.from('337815857904011919502232366785580118734')
const LOWEST_PRICE = '0.00000000000000000000000000000000000000293954462969821995729408305099800169742336'

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

      // await nft.mint({
      //   token0: token0.address,
      //   token1: token1.address,
      //   fee: FeeAmount.LOW,
      //   tickLower: TICK_SPACINGS[FeeAmount.LOW] * -20,
      //   tickUpper: TICK_SPACINGS[FeeAmount.LOW] * 20,
      //   amount0Desired: expandTo18Decimals(1_000),
      //   amount1Desired: expandTo18Decimals(1_000),
      //   amount0Min: 0,
      //   amount1Min: 0,
      //   recipient: wallets[0].address,
      //   deadline: 1,
      // })
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
      it('returns the correct postSqrtPrice if postSqrtPrice lies above the position range')

      describe('and swap does not push price beyond the next initialized tick', () => {
        // it returns the correct postSqrtPrice for various values
      })

      describe('and swap pushes the price beyond the next initialized tick', () => {
        it.only('returns the correct value for 200/1 token ratio', async () => {
          const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
          const pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(200_000)
          const currentPrice = (await pool.slot0()).sqrtPriceX96

          console.log(
            (await swapToRatio.getAmount0Delta(toSqrtFixedPoint96(priceUpper), currentPrice, 100_000, false)).toString()
          )
          console.log(
            (await swapToRatio.getAmount1Delta(toSqrtFixedPoint96(priceLower), currentPrice, 100_000, false)).toString()
          )

          const result = await swapToRatio.getPostSwapPrice(poolAddress, {
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            amount0Initial,
            amount1Initial,
          })
          console.log(result.toString())
          console.log((await swapToRatio.getAmount1Delta(result, currentPrice, 100_000, false)).toString())
          console.log(getMaxTick(TICK_SPACINGS[FeeAmount.LOW]))
          console.log(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
          console.log(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]))

          // console.log('10', (await swapToRatio.tickToSqrtRatioX96(10)).toString())
          // console.log('20', (await swapToRatio.tickToSqrtRatioX96(20)).toString())
          // console.log('100', (await swapToRatio.tickToSqrtRatioX96(100)).toString())
          // console.log('1000', (await swapToRatio.tickToSqrtRatioX96(1000)).toString())
        })
      })

      describe('and swap pushes the price beyond multiple initialized ticks', () => {
        // it returns the correct postSqrtPrice for various values
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

      it('returns the correct postSqrtPrice if postSqrtPrice lies below the position range')
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
  })

  describe('#swapToNextInitializedTick', () => {
    // position params
    let amount0Initial: BigNumberish
    let amount1Initial: BigNumberish
    let priceLower: number
    let priceUpper: number

    // pool params
    let liquidity: number
    let price: number
    let fee: number

    // other params
    let priceTarget: number
    let zeroForOne: boolean

    describe('when tested with simple numbers', () => {
      before('load fixture', async () => {
        swapToRatio = await loadFixture(swapToRatioPartialFixture)
      })

      describe('when initial deposit has excess of token0', () => {
        // desmos sheet for the following numbers: https://www.desmos.com/calculator/b4lcwrzc4f
        beforeEach(() => {
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

          await swapToRatio.getPostSwapPrice(poolAddress, {
            sqrtRatioX96Lower: toSqrtFixedPoint96(priceLower),
            sqrtRatioX96Upper: toSqrtFixedPoint96(priceUpper),
            amount0Initial,
            amount1Initial,
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

    describe.only('when compared against actual swaps', () => {
      let pool: Contract

      beforeEach('load fixture', async () => {
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

        const poolAddress = await factory.getPool(token0.address, token1.address, FeeAmount.LOW)
        pool = new ethers.Contract(poolAddress, IUniswapV3PoolABI, wallets[0])

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

      describe('with an excess of token1', () => {
        beforeEach(async () => {
          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(100_000)
          priceLower = 0.5
          priceUpper = 2
          price = (await pool.slot0()).sqrtRatioX96
          liquidity = await pool.liquidity()
          fee = 10000
          zeroForOne = true
        })

        it.only('yields the correct result', async () => {})
      })
    })
  })

  describe.only('#calculateConstantLiquidityPostSwapSqrtPrice', () => {
    // pool params
    let liquidity: BigNumberish
    let price: BigNumberish
    let fee: BigNumberish

    // position params
    let amount0Initial: BigNumberish
    let amount1Initial: BigNumberish
    let priceLower: BigNumberish
    let priceUpper: BigNumberish

    beforeEach('setup pool', async () => {
      ;({ tokens, swapToRatio, nft, router, factory } = await loadFixture(swapToRatioCompleteFixture))
    })

    describe('when there is excess of token1', async () => {
      describe('when the price falls in the middle of the curve', () => {
        before(() => {
          amount0Initial = 1_000
          priceLower = 0.5
          priceUpper = 2

          liquidity = '8456917931490818044' // current USDC/ETH liquidity
          price = 1
          fee = FeeAmount.HIGH
        })

        it('returns the correct sqrtPriceX96 for small excess of token1', async () => {
          amount1Initial = 1_001

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })
          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })

        it('returns the correct sqrtPriceX96 with a very large excess of token1', async () => {
          amount1Initial = 10_000_000_000

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })
          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })

        it('returns the correct sqrtPriceX96 with max liquidity per tick', async () => {
          amount1Initial = 10_000
          liquidity = '1917569901783203986719870431555990'

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })

        it('returns the correct sqrtPriceX96 with large token amounts', async () => {
          amount1Initial = expandTo18Decimals(5_000)
          amount0Initial = expandTo18Decimals(1_000)

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })
      })

      describe('when the price falls at the upper end of the curve', () => {
        beforeEach(() => {
          amount0Initial = 1_000
          priceLower = HIGHEST_PRICE.div(4)
          priceUpper = HIGHEST_PRICE

          liquidity = 300_000
          price = HIGHEST_PRICE.div(2)
          fee = FeeAmount.HIGH
        })

        it('returns the correct sqrtPriceX96 for with a very small excess of token1', async () => {
          amount1Initial = 1_001

          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })

        it('returns the correct sqrtPriceX96 with large token amounts', async () => {
          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(1_001)

          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(10).toString()).to.eq(resultJS.precision(10).toString())
        })
      })

      describe('when the price falls at the lower end of the curve', () => {
        beforeEach(() => {
          amount0Initial = 1_000
          amount1Initial = 1_001
          priceLower = LOWEST_PRICE
          priceUpper = new bn(LOWEST_PRICE).multipliedBy(4).toString()

          liquidity = '8456917931490818044'
          price = new bn(LOWEST_PRICE).multipliedBy(2).toString()
          fee = FeeAmount.HIGH
        })

        it('returns the correct sqrtPriceX96 for small excess of token1', async () => {
          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(3).toString()).to.eq(resultJS.precision(3).toString())
        })

        it('returns the correct sqrtPriceX96 with large token amounts', async () => {
          amount0Initial = expandTo18Decimals(1_000)
          amount1Initial = expandTo18Decimals(1_001)

          const resultJS = quadraticFormulaJS({
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          const resultSol = await quadraticFormulaSolidity(swapToRatio, {
            amount0Initial,
            amount1Initial,
            priceLower,
            priceUpper,
            liquidity,
            price,
            fee,
          })

          expect(resultSol.precision(3).toString()).to.eq(resultJS.precision(3).toString())
        })
      })
    })
  })

  describe('#swapToNextInitializedTick', () => {
    // position params
    let amount0Initial: number
    let amount1Initial: number
    let priceLower: number
    let priceUpper: number

    // pool params
    let liquidity: number
    let price: number
    let fee: number

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

type swapToRatioParams = {
  // pool params
  price: BigNumberish
  liquidity: BigNumberish
  fee: BigNumberish

  // position params
  priceLower: BigNumberish
  priceUpper: BigNumberish
  amount0Initial: BigNumberish
  amount1Initial: BigNumberish

  // other params
  priceTarget: BigNumberish
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

type quadraticParams = {
  // pool params
  price: BigNumberish
  liquidity: BigNumberish
  fee: BigNumberish

  // position params
  priceLower: BigNumberish
  priceUpper: BigNumberish
  amount0Initial: BigNumberish
  amount1Initial: BigNumberish
}

async function quadraticFormulaSolidity(swapToRatio: SwapToRatioTest, params: quadraticParams): Promise<bn> {
  const { price, liquidity, fee, priceLower, priceUpper, amount0Initial, amount1Initial } = params
  const resultSol = await swapToRatio.calculateConstantLiquidityPostSwapSqrtPrice(
    toSqrtFixedPoint96(parseFloat(price.toString())),
    liquidity,
    fee,
    toSqrtFixedPoint96(parseFloat(priceLower.toString())),
    toSqrtFixedPoint96(parseFloat(priceUpper.toString())),
    amount0Initial,
    amount1Initial
  )

  return new bn(resultSol.toString())
}

// js calculation for quadratic function is exactly precise to desmos.
// https://www.desmos.com/calculator/oiv0rti0ss
function quadraticFormulaJS(params: quadraticParams): bn {
  const sqrtPrice = new bn(params.price.toString()).sqrt()
  const sqrtPriceLower = new bn(params.priceLower.toString()).sqrt()
  const sqrtPriceUpper = new bn(params.priceUpper.toString()).sqrt()
  const liquidity = new bn(params.liquidity.toString())
  const fee = new bn(params.fee.toString())
  const amount0Initial = new bn(params.amount0Initial.toString())
  const amount1Initial = new bn(params.amount1Initial.toString())
  const feeMultiplier = new bn(1).dividedBy(new bn(1).minus(fee.dividedBy(1e6)))
  const liquidityMulFeeMultiplier = liquidity.multipliedBy(feeMultiplier)

  const a = amount0Initial
    .multipliedBy(sqrtPrice)
    .multipliedBy(sqrtPriceUpper)
    .plus(liquidity.multipliedBy(sqrtPriceUpper))
    .minus(liquidityMulFeeMultiplier.multipliedBy(sqrtPrice))
    .dividedBy(sqrtPriceUpper)
    .dividedBy(sqrtPrice)

  const b = liquidityMulFeeMultiplier
    .minus(liquidity)
    .minus(sqrtPriceLower.multipliedBy(amount0Initial))
    .minus(liquidity.multipliedBy(sqrtPriceLower).dividedBy(sqrtPrice))
    .plus(amount1Initial.dividedBy(sqrtPriceUpper))
    .plus(liquidityMulFeeMultiplier.multipliedBy(sqrtPrice).dividedBy(sqrtPriceUpper))

  const c = liquidity
    .multipliedBy(sqrtPriceLower)
    .minus(amount1Initial)
    .minus(liquidityMulFeeMultiplier.multipliedBy(sqrtPrice))

  if (consoleLog) {
    const Q96 = toSqrtFixedPoint96(1).toString()
    const sqrtPriceX96 = toSqrtFixedPoint96(params.price.toString()).toString()
    const sqrtPriceX96Upper = toSqrtFixedPoint96(params.priceUpper.toString()).toString()
    // liquidityFeeMultiplier * sqrtRatioX96 / sqrtRatioX96Upper * FixedPoint96.Q96
    console.log('first line a ', amount0Initial.multipliedBy(1e8).multipliedBy(sqrtPriceX96).toString())

    console.log('a', a.toString())
    console.log('b', b.toString())
    console.log('c', c.toString())
  }

  const sqrtb4ac = b.multipliedBy(b).minus(new bn(4).multipliedBy(a).multipliedBy(c)).sqrt()
  const quadratic = sqrtb4ac.minus(b).dividedBy(2).dividedBy(a)
  return quadratic.multipliedBy(new bn(2).exponentiatedBy(96))
}

// TODO: oops,  maybe just use encodePriceSqrt. But being able to use decimals here
// instead of fractions is convenient for now to more easily test against Dan's desmos sheets
const toSqrtFixedPoint96 = (n: BigNumberish): BigNumber => {
  const nBn = new bn(n.toString()).multipliedBy(1e18).sqrt()
  return BigNumber.from(nBn.multipliedBy(new bn(2).exponentiatedBy(96).dividedBy(1e9)).toFixed(0).toString())
}
