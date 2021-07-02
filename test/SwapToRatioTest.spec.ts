import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { Fixture } from 'ethereum-waffle'
import { SwapToRatioTest } from '../typechain'
import { expect } from 'chai'

describe('SwapToRatio', () => {
  const [...wallets] = waffle.provider.getWallets()
  const positionValueCompleteFixture: Fixture<{
    swapToRatio: SwapToRatioTest
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
  let swapToRatioTest: SwapToRatioTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter

  const amountDesired = 100

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
    })
  })
})
