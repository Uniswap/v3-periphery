import { Fixture } from 'ethereum-waffle'
import { constants } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { MockTimeNonfungiblePositionManager, QuoterWithGas, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, MaxUint128 } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { createPool, createPoolWithMultiplePositions } from './shared/quoter'

describe('QuoterWithGas', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, trader] = wallets

  const swapRouterFixture: Fixture<{
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
    quoter: QuoterWithGas
  }> = async (wallets, provider) => {
    const { weth9, factory, router, tokens, nft } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      await Promise.all([
        token.approve(router.address, constants.MaxUint256),
        token.approve(nft.address, constants.MaxUint256),
        token.connect(trader).approve(router.address, constants.MaxUint256),
        token.transfer(trader.address, expandTo18Decimals(1_000_000)),
      ])
    }

    const quoterFactory = await ethers.getContractFactory('QuoterWithGas')
    quoter = (await quoterFactory.deploy(factory.address, weth9.address)) as QuoterWithGas

    return {
      tokens,
      nft,
      quoter,
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let quoter: QuoterWithGas

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  // helper for getting weth and token balances
  beforeEach('load fixture', async () => {
    ;({ tokens, nft, quoter } = await loadFixture(swapRouterFixture))
  })

  describe('quotes', () => {
    beforeEach(async () => {
      await createPool(nft, wallet, tokens[0].address, tokens[1].address)
      await createPool(nft, wallet, tokens[1].address, tokens[2].address)
      await createPoolWithMultiplePositions(nft, wallet, tokens[0].address, tokens[2].address)
    })

    describe('#quoteExactInputWithGas', () => {
      it('0 -> 2 -> 1 includes gas', async () => {
        const {
          amountOut,
          initializedTicksCrossedList,
          sqrtPriceX96AfterList,
          gasUsed,
        } = await quoter.callStatic.quoteExactInputWithGas(
          encodePath([tokens[0].address, tokens[2].address, tokens[1].address], [FeeAmount.MEDIUM, FeeAmount.MEDIUM]),
          10000
        )

        expect(gasUsed).to.eq(294311)
        expect(sqrtPriceX96AfterList.length).to.eq(2)
        expect(sqrtPriceX96AfterList[0]).to.eq('78461846509168490764501028180')
        expect(sqrtPriceX96AfterList[1]).to.eq('80007846861567212939802016351')
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(initializedTicksCrossedList[1]).to.eq(0)
        expect(amountOut).to.eq(9745)
      })
    })

    describe('#quoteExactInputSingleWithGas', () => {
      it('0 -> 2 includes gas', async () => {
        const {
          amountOut,
          gasUsed,
          sqrtPriceX96After,
          initializedTicksCrossed,
        } = await quoter.callStatic.quoteExactInputSingleWithGas(
          tokens[0].address,
          tokens[2].address,
          FeeAmount.MEDIUM,
          10000,
          encodePriceSqrt(100, 102)
        )

        expect(gasUsed).to.eq(190287)
        expect(initializedTicksCrossed).to.eq(2)
        expect(amountOut).to.eq(9871)
        expect(sqrtPriceX96After).to.eq('78461846509168490764501028180')
      })
    })

    describe('#quoteExactOutputWithGas', () => {
      it('0 -> 2 -> 1 includes gas', async () => {
        const {
          gasUsed,
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
        } = await quoter.callStatic.quoteExactOutputWithGas(
          encodePath([tokens[0].address, tokens[2].address, tokens[1].address].reverse(), [
            FeeAmount.MEDIUM,
            FeeAmount.MEDIUM,
          ]),
          9745
        )

        expect(gasUsed).to.eq(336363)
        expect(sqrtPriceX96AfterList.length).to.eq(2)
        expect(sqrtPriceX96AfterList[0]).to.eq('80007838904387594703933785072')
        expect(sqrtPriceX96AfterList[1]).to.eq('78461888503179331029803316753')
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(initializedTicksCrossedList[1]).to.eq(2)
        expect(amountIn).to.eq(10000)
      })
    })

    describe('#quoteExactOutputSingleWithGas', () => {
      it('0 -> 1 includes gas', async () => {
        const {
          gasUsed,
          amountIn,
          sqrtPriceX96After,
          initializedTicksCrossed,
        } = await quoter.callStatic.quoteExactOutputSingleWithGas(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          MaxUint128,
          encodePriceSqrt(100, 102)
        )

        expect(gasUsed).to.eq(113124)
        expect(amountIn).to.eq(9981)
        expect(initializedTicksCrossed).to.eq(0)
        expect(sqrtPriceX96After).to.eq('78447570448055484695608110440')
      })
    })
  })
})
