import { waffle, ethers } from 'hardhat'
import { constants } from 'ethers'
import { Fixture } from 'ethereum-waffle'
import {
  PositionValueTest,
  SwapRouter,
  MockTimeNonfungiblePositionManager,
  IUniswapV3Pool,
  TestERC20,
} from '../typechain'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePath } from './shared/path'
import { computePoolAddress } from './shared/computePoolAddress'
import completeFixture from './shared/completeFixture'

import { expect } from './shared/expect'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

describe('PositionValue', async () => {
  const [...wallets] = waffle.provider.getWallets()
  const positionValueCompleteFixture: Fixture<{
    positionValue: PositionValueTest
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
    router: SwapRouter
  }> = async (wallets, provider) => {
    const { nft, router, tokens } = await completeFixture(wallets, provider)
    const positionValueFactory = await ethers.getContractFactory('PositionValueTest')
    const positionValue = (await positionValueFactory.deploy()) as PositionValueTest

    for (const token of tokens) {
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(wallets[0]).approve(nft.address, constants.MaxUint256)
      await token.transfer(wallets[0].address, expandTo18Decimals(1_000_000))
    }

    return {
      positionValue,
      tokens,
      nft,
      router,
    }
  }

  let tokens: [TestERC20, TestERC20, TestERC20]
  let positionValue: PositionValueTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter

  const amountDesired = 100

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach(async () => {
    ;({ positionValue, tokens, nft, router } = await loadFixture(positionValueCompleteFixture))
    await nft.createAndInitializePoolIfNecessary(
      tokens[0].address,
      tokens[1].address,
      FeeAmount.MEDIUM,
      encodePriceSqrt(1, 1)
    )
  })

  describe('#principal', () => {
    it('returns the correct values when price is in the middle of the range', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const principal = await positionValue.principal(nft.address, 1)
      expect(principal.amount0).to.equal(14)
      expect(principal.amount1).to.equal(14)
    })

    it('returns the correct values when range is below current price', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: -60,
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const principal = await positionValue.principal(nft.address, 1)
      expect(principal.amount0).to.equal(0)
      expect(principal.amount1).to.equal(14)
    })

    it('returns the correct values when range is below current price', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: 60,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const principal = await positionValue.principal(nft.address, 1)
      expect(principal.amount0).to.equal(14)
      expect(principal.amount1).to.equal(0)
    })

    it('returns the correct values when range is skewed above price', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: -6_000,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const principal = await positionValue.principal(nft.address, 1)
      expect(principal.amount0).to.equal(14)
      expect(principal.amount1).to.equal(3)
    })

    it('returns the correct values when range is skewed below price', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: 6_000,
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const principal = await positionValue.principal(nft.address, 1)
      expect(principal.amount0).to.equal(3)
      expect(principal.amount1).to.equal(14)
    })
  })

  describe('#fees', () => {
    it.only('return the correct amount of fees', async () => {
      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })

      const swapAmount = 10000
      await tokens[0].approve(router.address, swapAmount)
      await router.exactInput({
        recipient: wallets[0].address,
        deadline: 1,
        path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
        amountIn: swapAmount,
        amountOutMinimum: 0,
      })

      // this works
      const fees = await nft.callStatic.collect({
        tokenId: 1,
        recipient: wallets[0].address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      })
      // console.log(fees.amount0.toString())
      // console.log(fees.amount1.toString())

      const pool = new ethers.Contract(
        computePoolAddress(await nft.factory(), [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM),
        IUniswapV3PoolABI,
        wallets[0]
      )

      // this reverts with "NP"
      await pool.burn(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), 0, {
        gasLimit: 12_450_000,
      })
      const fees2 = await positionValue.fees(nft.address, 1)
      console.log(fees2.amount0.toString())
      console.log(fees2.amount1.toString())
    })
  })
})
