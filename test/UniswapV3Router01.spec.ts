import { BigNumber, constants, Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { MockTimeUniswapV3Router01, WETH9, WETH10, TestERC20 } from '../typechain'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'
import { encodePath } from './shared/path'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

describe('UniswapV3Router01', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const routerFixture: Fixture<{
    router: MockTimeUniswapV3Router01
    weth9: WETH9
    weth10: WETH10
    v3CoreFactory: Contract
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const weth9Factory = await ethers.getContractFactory('WETH9')
    const weth9 = (await weth9Factory.deploy()) as WETH9

    const weth10Factory = await ethers.getContractFactory('WETH10')
    const weth10 = (await weth10Factory.deploy()) as WETH10

    const routerFactory = await ethers.getContractFactory('MockTimeUniswapV3Router01')
    const router = (await routerFactory.deploy(
      v3CoreFactory.address,
      weth9.address,
      weth10.address
    )) as MockTimeUniswapV3Router01

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20, TestERC20]

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.connect(other).approve(router.address, constants.MaxUint256)
      await token.transfer(other.address, expandTo18Decimals(1_000_000))
    }

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      weth9,
      weth10,
      router,
      v3CoreFactory,
      tokens,
    }
  }

  // helper for getting token0-2 balances
  // helper for getting the token0-2 balances
  const balances = async ([token0, token1, token2]: TestERC20[], who: string) => {
    return {
      weth9: await weth9.balanceOf(who),
      token0: await token0.balanceOf(who),
      token1: await token1.balanceOf(who),
      token2: await token2.balanceOf(who),
    }
  }

  let v3CoreFactory: Contract
  let weth9: WETH9
  let weth10: WETH10
  let router: MockTimeUniswapV3Router01
  let tokens: [TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ router, weth9, weth10, v3CoreFactory, tokens } = await loadFixture(routerFixture))
  })

  it('bytecode size', async () => {
    expect(((await router.provider.getCode(router.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('swaps', () => {
    const trader = other

    beforeEach(async () => {
      let liquidityParams = {
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 1000000,
        deadline: 1,
      }

      // create pools
      await router.createPoolAndAddLiquidity(liquidityParams)
      liquidityParams.token0 = tokens[1].address
      liquidityParams.token1 = tokens[2].address
      await router.createPoolAndAddLiquidity(liquidityParams)

      // create weth9 pools at the beginning
      await weth9.deposit({ value: 1000000 })
      await weth9.approve(router.address, constants.MaxUint256)
      liquidityParams.token0 = weth9.address < tokens[0].address ? weth9.address : tokens[0].address
      liquidityParams.token1 = weth9.address < tokens[0].address ? tokens[0].address : weth9.address
      await router.createPoolAndAddLiquidity(liquidityParams)
    })

    describe('ETH input', () => {
      it('#exactInput', async () => {
        const path = encodePath(
          [weth9, tokens[0]].map((token) => token.address),
          [FeeAmount.MEDIUM]
        )
        let params = {
          path,
          amountIn: 3,
          amountOutMinimum: 1,
          recipient: trader.address,
          deadline: 1,
        }
        const data = []
        data.push(router.interface.encodeFunctionData('exactInput', [params]))

        const pool = await v3CoreFactory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

        // get balances before
        const poolBefore = await balances(tokens, pool)
        const traderBefore = await balances(tokens, trader.address)

        await expect(router.connect(trader).multicall(data, { value: params.amountIn }))
          .to.emit(weth9, 'Deposit') // trader (w)eth amount check
          .withArgs(router.address, params.amountIn)

        // get balances after
        const poolAfter = await balances(tokens, pool)
        const traderAfter = await balances(tokens, trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.add(3))
        expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
      })

      describe('#exactOutput', () => {
        let params: any
        let data: string[]
        beforeEach(async () => {
          const path = encodePath(
            [tokens[0], weth9].map((token) => token.address),
            [FeeAmount.MEDIUM]
          )
          params = {
            path,
            amountOut: 1,
            amountInMaximum: 3,
            recipient: trader.address,
            deadline: 1,
          }
          data = []
          data.push(router.interface.encodeFunctionData('exactOutput', [params]))
          // the ETH amount for exactOutput swaps that pay in ETH isn't always exact, we have to unwrap at the end
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [trader.address]))
        })

        it('works', async () => {
          const pool = await v3CoreFactory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool)
          const traderBefore = await balances(tokens, trader.address)

          await expect(router.connect(trader).multicall(data, { value: params.amountInMaximum }))
            .to.emit(weth9, 'Deposit') // trader (w)eth amount check
            .withArgs(router.address, params.amountInMaximum)

          // get balances after
          const poolAfter = await balances(tokens, pool)
          const traderAfter = await balances(tokens, trader.address)

          // TODO add trader balance check for ETH
          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.add(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
        })

        it('takes all ETH', async () => {
          await expect(router.connect(trader).multicall(data, { value: params.amountInMaximum + 1 }))
            .to.emit(weth9, 'Deposit')
            .withArgs(router.address, params.amountInMaximum + 1)
        })

        // TODO
        it('refunds extra ETH')
      })
    })

    describe('ETH output', () => {
      describe('#exactInput', () => {
        let params: any
        let data: string[]
        beforeEach(async () => {
          const path = encodePath(
            [tokens[0], weth9].map((token) => token.address),
            [FeeAmount.MEDIUM]
          )
          params = {
            path,
            amountIn: 3,
            amountOutMinimum: 1,
            recipient: router.address, // send to the router
            deadline: 1,
          }
          data = []
          data.push(router.interface.encodeFunctionData('exactInput', [params]))
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [trader.address]))
        })

        it('works', async () => {
          const pool = await v3CoreFactory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool)
          const traderBefore = await balances(tokens, trader.address)

          await expect(router.connect(trader).multicall(data))
            .to.emit(weth9, 'Withdrawal') // trader (w)eth amount check
            .withArgs(router.address, params.amountOutMinimum)

          // get balances after
          const poolAfter = await balances(tokens, pool)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.sub(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
        })

        it('sends ETH')
      })

      describe('#exactOutput', () => {
        let params: any
        let data: string[]
        beforeEach(async () => {
          const path = encodePath(
            [weth9, tokens[0]].map((token) => token.address),
            [FeeAmount.MEDIUM]
          )
          params = {
            path,
            amountOut: 1,
            amountInMaximum: 3,
            recipient: router.address, // send to the router
            deadline: 1,
          }
          data = []
          data.push(router.interface.encodeFunctionData('exactOutput', [params]))
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [trader.address]))
        })

        it('works', async () => {
          const pool = await v3CoreFactory.getPool(weth9.address, tokens[0].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool)
          const traderBefore = await balances(tokens, trader.address)

          await expect(router.connect(trader).multicall(data))
            .to.emit(weth9, 'Withdrawal') // trader (w)eth amount check
            .withArgs(router.address, params.amountOut)

          // get balances after
          const poolAfter = await balances(tokens, pool)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(poolAfter.weth9).to.be.eq(poolBefore.weth9.sub(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
        })

        it('sends ETH')
      })
    })

    // TODO do we even care about supporting this? circular paths, basically. i guess, for arb?
    it('ETH input and output')

    describe('#exactInput', () => {
      describe('single-pair', async () => {
        // helper for executing a single pair exact input trade
        const singlePair = async (zeroForOne: boolean) => {
          const tokenAddresses = tokens.slice(0, 2).map((t) => t.address)
          const fees = [FeeAmount.MEDIUM]
          const path = encodePath(zeroForOne ? tokenAddresses : tokenAddresses.reverse(), fees)

          let params = {
            path,
            amountIn: 3,
            amountOutMinimum: 1,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountOutMinimum = 2
          await expect(router.connect(trader).exactInput(params)).to.be.revertedWith('too little received')
          params.amountOutMinimum = 1

          await router.connect(trader).exactInput(params)
        }

        it('zero for one', async () => {
          const pool0 = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool0)
          const traderBefore = await balances(tokens, trader.address)

          await singlePair(true)

          // get balances after
          const poolAfter = await balances(tokens, pool0)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('one for zero', async () => {
          const pool1 = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool1)
          const traderBefore = await balances(tokens, trader.address)

          await singlePair(false)

          // get balances after
          const poolAfter = await balances(tokens, pool1)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pair', async () => {
        const multiPair = async (startFromZero: boolean) => {
          const tokenAddresses = tokens.map((t) => t.address)
          const fees = [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          const path = encodePath(startFromZero ? tokenAddresses : tokenAddresses.reverse(), fees)

          let params = {
            path,
            amountIn: 5,
            amountOutMinimum: 1,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountOutMinimum = 2
          await expect(router.connect(trader).exactInput(params)).to.be.revertedWith('too little received')
          params.amountOutMinimum = 1

          await router.connect(trader).exactInput(params)
        }

        it('start from zero', async () => {
          const traderBefore = await balances(tokens, trader.address)
          await multiPair(true)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('end at zero', async () => {
          const traderBefore = await balances(tokens, trader.address)
          await multiPair(false)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
        })
      })
    })

    describe('#exactOutput', () => {
      describe('single-pair', async () => {
        // helper for executing a single pair exact output trade
        const singlePair = async (zeroForOne: boolean) => {
          const tokenAddresses = tokens.slice(0, 2).map((t) => t.address)
          const fees = [FeeAmount.MEDIUM]
          // reverse the path
          const path = encodePath(zeroForOne ? tokenAddresses.reverse() : tokenAddresses, fees)

          let params = {
            path,
            amountOut: 1,
            amountInMaximum: 3,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountInMaximum = 2
          await expect(router.connect(trader).exactOutput(params)).to.be.revertedWith('too much requested')
          params.amountInMaximum = 3

          await router.connect(trader).exactOutput(params)
        }

        it('zero for one', async () => {
          const pool0 = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool0)
          const traderBefore = await balances(tokens, trader.address)

          await singlePair(true)

          // get balances after
          const poolAfter = await balances(tokens, pool0)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('one for zero', async () => {
          const pool1 = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await balances(tokens, pool1)
          const traderBefore = await balances(tokens, trader.address)

          await singlePair(false)

          // get balances after
          const poolAfter = await balances(tokens, pool1)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pair', async () => {
        const multiPair = async (startFromZero: boolean) => {
          const tokenAddresses = tokens.map((t) => t.address)
          const fees = [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          // reverse the path
          const path = encodePath(startFromZero ? tokenAddresses.reverse() : tokenAddresses, fees)

          let params = {
            path,
            amountOut: 1,
            amountInMaximum: 5,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountInMaximum = 4
          await expect(router.connect(trader).exactOutput(params)).to.be.revertedWith('too much requested')
          params.amountInMaximum = 5

          await router.connect(trader).exactOutput(params)
        }

        it('start from zero', async () => {
          const traderBefore = await balances(tokens, trader.address)
          await multiPair(true)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('end at zero', async () => {
          const traderBefore = await balances(tokens, trader.address)
          await multiPair(false)
          const traderAfter = await balances(tokens, trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
        })
      })
    })
  })
})
