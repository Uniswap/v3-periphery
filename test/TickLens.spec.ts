import { Fixture } from 'ethereum-waffle'
import { BigNumber, BigNumberish, constants, Contract } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { MockTimeNonfungiblePositionManager, TestERC20, TickLensTest } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'
import snapshotGasCost from './shared/snapshotGasCost'

describe('TickLens', () => {
  const wallets = waffle.provider.getWallets()

  const nftFixture: Fixture<{
    factory: Contract
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { factory, tokens, nft } = await completeFixture(wallets, provider)

    for (const token of tokens) {
      await token.approve(nft.address, constants.MaxUint256)
    }

    return {
      factory,
      nft,
      tokens,
    }
  }

  let factory: Contract
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let poolAddress: string
  let tickLens: TickLensTest

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ factory, tokens, nft } = await loadFixture(nftFixture))
  })

  describe('#getPopulatedTicksInWord', () => {
    const fullRangeLiquidity = 1000000
    async function createPool(tokenAddressA: string, tokenAddressB: string) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      await nft.createAndInitializePoolIfNecessary(
        tokenAddressA,
        tokenAddressB,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount: fullRangeLiquidity,
        amount0Max: constants.MaxUint256,
        amount1Max: constants.MaxUint256,
        deadline: 1,
      }

      return nft.mint(liquidityParams)
    }

    async function mint(
      tokenAddressA: string,
      tokenAddressB: string,
      tickLower: number,
      tickUpper: number,
      amount: number
    ) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower,
        tickUpper,
        amount,
        amount0Max: constants.MaxUint256,
        amount1Max: constants.MaxUint256,
        recipient: wallets[0].address,
        deadline: 1,
      }

      return nft.mint(liquidityParams)
    }

    beforeEach(async () => {
      await createPool(tokens[0].address, tokens[1].address)
      poolAddress = computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM)
    })

    beforeEach(async () => {
      const lensFactory = await ethers.getContractFactory('TickLensTest')
      tickLens = (await lensFactory.deploy()) as TickLensTest
    })

    function getTickBitmapIndex(tick: BigNumberish, tickSpacing: number): BigNumber {
      const intermediate = BigNumber.from(tick).div(tickSpacing)
      // see https://docs.soliditylang.org/en/v0.7.6/types.html#shifts
      return intermediate.lt(0) ? intermediate.add(1).div(BigNumber.from(2).pow(8)).sub(1) : intermediate.shr(8)
    }

    it('works for min/max', async () => {
      const [min] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it('works for min/max and -2/-1/0/1', async () => {
      const minus = -TICK_SPACINGS[FeeAmount.MEDIUM]
      const plus = -minus

      await mint(tokens[0].address, tokens[1].address, minus * 2, minus, 2)
      await mint(tokens[0].address, tokens[1].address, minus * 2, 0, 3)
      await mint(tokens[0].address, tokens[1].address, minus * 2, plus, 5)
      await mint(tokens[0].address, tokens[1].address, minus, 0, 7)
      await mint(tokens[0].address, tokens[1].address, minus, plus, 11)
      await mint(tokens[0].address, tokens[1].address, 0, plus, 13)

      const [min] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [negativeOne, negativeTwo] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(minus, TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [one, zero] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(plus, TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(negativeTwo.tick).to.be.eq(minus * 2)
      expect(negativeTwo.liquidityNet).to.be.eq(2 + 3 + 5)
      expect(negativeTwo.liquidityGross).to.be.eq(10)

      expect(negativeOne.tick).to.be.eq(minus)
      expect(negativeOne.liquidityNet).to.be.eq(7 + 11 - 2)
      expect(negativeOne.liquidityGross).to.be.eq(20)

      expect(zero.tick).to.be.eq(0)
      expect(zero.liquidityNet).to.be.eq(13 - 3 - 7)
      expect(zero.liquidityGross).to.be.eq(23)

      expect(one.tick).to.be.eq(plus)
      expect(one.liquidityNet).to.be.eq(-5 - 11 - 13)
      expect(one.liquidityGross).to.be.eq(29)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(max.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it('gas for single populated tick', async () => {
      await snapshotGasCost(
        tickLens.getGasCostOfGetPopulatedTicksInWord(
          poolAddress,
          getTickBitmapIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
        )
      )
    })

    it('fully populated ticks', async () => {
      // fully populate a word
      await Promise.all(
        new Array(128)
          .fill(0)
          .map((_, i) =>
            mint(
              tokens[0].address,
              tokens[1].address,
              i * TICK_SPACINGS[FeeAmount.MEDIUM],
              (255 - i) * TICK_SPACINGS[FeeAmount.MEDIUM],
              1
            )
          )
      )

      const ticks = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickBitmapIndex(0, TICK_SPACINGS[FeeAmount.MEDIUM])
      )
      expect(ticks.length).to.be.eq(256)

      await snapshotGasCost(
        tickLens.getGasCostOfGetPopulatedTicksInWord(
          poolAddress,
          getTickBitmapIndex(0, TICK_SPACINGS[FeeAmount.MEDIUM])
        )
      )
    })
  })
})
