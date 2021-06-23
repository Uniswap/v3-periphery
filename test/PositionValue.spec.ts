import { waffle, ethers } from 'hardhat'
import { constants } from 'ethers'
import { Fixture } from 'ethereum-waffle'
import { PositionValueTest, MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import completeFixture from './shared/completeFixture'

import { expect } from './shared/expect'

describe('PositionValue', async () => {
  const [...wallets] = waffle.provider.getWallets()
  const positionValueCompleteFixture: Fixture<{
    positionValue: PositionValueTest
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
  }> = async (wallets, provider) => {
    const { factory, nft, router, nftDescriptor, tokens } = await completeFixture(wallets, provider)
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
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let positionValue: PositionValueTest

  const amountDesired = 15

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach(async () => {
    ;({ positionValue, nft, tokens } = await loadFixture(positionValueCompleteFixture))
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
})
