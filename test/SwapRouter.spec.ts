import { Fixture } from 'ethereum-waffle'
import { BigNumber, constants, Contract, ContractTransaction } from 'ethers'
import { waffle } from 'hardhat'
import { IWETH9, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'

describe('SwapRouter', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, trader] = wallets

  const swapRouterFixture: Fixture<{
    weth9: IWETH9
    factory: Contract
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
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

    return {
      weth9,
      factory,
      router,
      tokens,
      nft,
    }
  }

  let factory: Contract
  let weth9: IWETH9
  let router: MockTimeSwapRouter
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let getBalances: (
    who: string
  ) => Promise<{
    weth9: BigNumber
    token0: BigNumber
    token1: BigNumber
    token2: BigNumber
  }>

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  // helper for getting weth and token balances
  beforeEach('load fixture', async () => {
    ;({ router, weth9, factory, tokens, nft } = await loadFixture(swapRouterFixture))

    getBalances = async (who: string) => {
      const balances = await Promise.all([
        weth9.balanceOf(who),
        tokens[0].balanceOf(who),
        tokens[1].balanceOf(who),
        tokens[2].balanceOf(who),
      ])
      return {
        weth9: balances[0],
        token0: balances[1],
        token1: balances[2],
        token2: balances[3],
      }
    }
  })

  it('bytecode size', async () => {
    expect(((await router.provider.getCode(router.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('swaps', () => {
    const liquidity = 1000000
    async function createPool(tokenAddressA: string, tokenAddressB: string) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: liquidity,
        deadline: 1,
      }

      return nft.firstMint(liquidityParams)
    }

    async function createPoolWETH9(tokenAddress: string) {
      await weth9.deposit({ value: liquidity })
      await weth9.approve(nft.address, constants.MaxUint256)
      return createPool(weth9.address, tokenAddress)
    }

    beforeEach(async () => {
      await createPool(tokens[0].address, tokens[1].address)
      await createPool(tokens[1].address, tokens[2].address)
    })

    describe('#exactInput', () => {
      async function exactInput(
        tokens: string[],
        amountIn: number = 3,
        amountOutMinimum: number = 1
      ): Promise<ContractTransaction> {
        const inputIsWETH = [weth9.address].includes(tokens[0])
        const outputIsWETH9 = tokens[tokens.length - 1] === weth9.address

        const value = inputIsWETH ? amountIn : 0

        const params = {
          path: encodePath(tokens, new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
          recipient: outputIsWETH9 ? router.address : trader.address,
          deadline: 1,
        }

        const data = [router.interface.encodeFunctionData('exactInput', [params, amountIn, amountOutMinimum])]
        if (outputIsWETH9)
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        await expect(
          router.connect(trader).exactInput(params, amountIn, amountOutMinimum + 1, { value })
        ).to.be.revertedWith('Too little received')

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInput(params, amountIn, amountOutMinimum, { value })
          : router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.slice(0, 2).map((token) => token.address))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('1 -> 0', async () => {
          const pool = await factory.getPool(tokens[1].address, tokens[0].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address)
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens.map((token) => token.address),
            5,
            1
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.map((token) => token.address).reverse(), 5, 1)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        })
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].address)
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([weth9.address, tokens[0].address]))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WETH9 -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([weth9.address, tokens[0].address, tokens[1].address], 5))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.address, 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].address)
            await createPoolWETH9(tokens[1].address)
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].address, weth9.address, FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].address, weth9.address]))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })

          it('0 -> 1 -> WETH9', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].address, tokens[1].address, weth9.address], 5))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          })
        })
      })
    })

    describe('#exactOutput', () => {
      async function exactOutput(
        tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3
      ): Promise<ContractTransaction> {
        const inputIsWETH9 = tokens[0] === weth9.address
        const outputIsWETH9 = tokens[tokens.length - 1] === weth9.address

        const value = inputIsWETH9 ? amountInMaximum : 0

        const params = {
          path: encodePath(tokens.slice().reverse(), new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
          recipient: outputIsWETH9 ? router.address : trader.address,
          deadline: 1,
        }

        const data = [router.interface.encodeFunctionData('exactOutput', [params, amountOut, amountInMaximum])]
        if (inputIsWETH9) data.push(router.interface.encodeFunctionData('unwrapWETH9', [0, trader.address]))
        if (outputIsWETH9) data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOut, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        await expect(
          router.connect(trader).exactOutput(params, amountOut, amountInMaximum - 1, { value })
        ).to.be.revertedWith('Too much requested')

        return router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.slice(0, 2).map((token) => token.address))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('1 -> 0', async () => {
          const pool = await factory.getPool(tokens[1].address, tokens[0].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address)
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens.map((token) => token.address),
            1,
            5
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.map((token) => token.address).reverse(), 1, 5)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        })
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].address)
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([weth9.address, tokens[0].address]))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WETH9 -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([weth9.address, tokens[0].address, tokens[1].address], 1, 5))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.address, 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].address)
            await createPoolWETH9(tokens[1].address)
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].address, weth9.address, FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].address, weth9.address]))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })

          it('0 -> 1 -> WETH9', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].address, tokens[1].address, weth9.address], 1, 5))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          })
        })
      })
    })
  })
})
