import { Fixture } from 'ethereum-waffle'
import { constants, Contract } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { MockTimeNonfungiblePositionManager, TestERC20, TickLens } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'

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
  let tickLens: TickLens

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ factory, tokens, nft } = await loadFixture(nftFixture))
  })

  describe('#getPopulatedTicks', () => {
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
      const lensFactory = await ethers.getContractFactory('TickLens')
      tickLens = (await lensFactory.deploy()) as TickLens
    })

    beforeEach(async () => {
      const { sqrtPriceX96, tick, liquidity } = await tickLens.getStaticData(poolAddress)

      expect(sqrtPriceX96).to.be.eq(encodePriceSqrt(1, 1))
      expect(tick).to.be.eq(0)
      expect(liquidity).to.be.eq(fullRangeLiquidity)
    })

    it('works for min/max', async () => {
      const [max, min] = await tickLens.getPopulatedTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it('works for min/max and -1/0/1', async () => {
      const minus = -TICK_SPACINGS[FeeAmount.MEDIUM]
      const plus = -minus

      await mint(tokens[0].address, tokens[1].address, minus, 0, 1)
      await mint(tokens[0].address, tokens[1].address, minus, plus, 3)
      await mint(tokens[0].address, tokens[1].address, 0, plus, 5)

      const [max, one, zero, negativeOne, min] = await tickLens.getPopulatedTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(negativeOne.tick).to.be.eq(minus)
      expect(negativeOne.liquidityNet).to.be.eq(3 + 1)
      expect(negativeOne.liquidityGross).to.be.eq(4)

      expect(zero.tick).to.be.eq(0)
      expect(zero.liquidityNet).to.be.eq(5 - 1)
      expect(zero.liquidityGross).to.be.eq(6)

      expect(one.tick).to.be.eq(plus)
      expect(one.liquidityNet).to.be.eq(-5 - 3)
      expect(one.liquidityGross).to.be.eq(8)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(max.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it.skip('works for every 50th tick', async () => {
      const max = getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      const interval = 50
      for (let tick = TICK_SPACINGS[FeeAmount.MEDIUM]; tick < max; tick += TICK_SPACINGS[FeeAmount.MEDIUM] * interval) {
        console.log(`${((tick / max) * 100).toFixed(1)}%`)
        await mint(tokens[0].address, tokens[1].address, -tick, tick, 1)
      }
      console.log('100%')

      const populatedTicks = await tickLens.getPopulatedTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      console.log(`Fetching ${populatedTicks.length} populated ticks`)

      for (let i = 0; i < populatedTicks.length; i++) {
        if (i > 0) expect(populatedTicks[i].tick).to.be.lt(populatedTicks[i - 1].tick)
        expect(populatedTicks[i].liquidityGross).to.be.gt(0)
      }
    }).timeout(60000 * 5)
  })
})
