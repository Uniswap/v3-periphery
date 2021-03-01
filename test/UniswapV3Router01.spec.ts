import { constants, Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { UniswapV3Router01, WETH9, TestERC20 } from '../typechain'
import { computePoolAddress } from './shared/computePoolAddress'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'
import { encodePath } from './shared/path'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

import { abi as POOL_ABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'

describe('UniswapV3Router01', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const routerFixture: Fixture<{
    router: UniswapV3Router01
    weth: WETH9
    v3CoreFactory: Contract
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const wethFactory = await ethers.getContractFactory('WETH9')
    const weth = (await wethFactory.deploy()) as WETH9

    const routerFactory = await ethers.getContractFactory('MockTimeUniswapV3Router01')
    const router = (await routerFactory.deploy(v3CoreFactory.address, weth.address)) as UniswapV3Router01

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
      weth,
      router,
      v3CoreFactory,
      tokens,
    }
  }

  // helper for getting the token0-2 balances
  const balances = async ([token0, token1, token2]: TestERC20[], who: string) => {
    return {
      token0: await token0.balanceOf(who),
      token1: await token1.balanceOf(who),
      token2: await token2.balanceOf(who),
    }
  }

  let v3CoreFactory: Contract
  let weth: WETH9
  let router: UniswapV3Router01
  let tokens: [TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ router, weth, v3CoreFactory, tokens } = await loadFixture(routerFixture))
  })

  it('router bytecode size', async () => {
    expect(((await router.provider.getCode(router.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#WETH', () => {
    it('points to WETH', async () => {
      expect(await router.WETH()).to.eq(weth.address)
    })
  })

  describe('#factory', () => {
    it('points to v3 core factory', async () => {
      expect(await router.factory()).to.eq(v3CoreFactory.address)
    })
  })

  describe('#createPoolAndAddLiquidity', () => {
    it('creates a pool at expected address', async () => {
      const expectedAddress = computePoolAddress(
        v3CoreFactory.address,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.eq('0x')
      await router.createPoolAndAddLiquidity({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      const codeAfter = await wallet.provider.getCode(expectedAddress)
      expect(codeAfter).to.not.eq('0x')
    })

    it('fails if pool already exists', async () => {
      await router.createPoolAndAddLiquidity({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await expect(
        router.createPoolAndAddLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          sqrtPriceX96: encodePriceSqrt(1, 1),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.reverted
    })

    it('cannot take tokens in opposite order', async () => {
      await expect(
        router.createPoolAndAddLiquidity({
          token1: tokens[0].address,
          token0: tokens[1].address,
          sqrtPriceX96: encodePriceSqrt(1, 1),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.revertedWith('Token order')
    })

    it('deploys pool with expected parameters', async () => {
      await router.createPoolAndAddLiquidity({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      const poolAddress = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
      expect(poolAddress).to.not.eq(constants.AddressZero)
      const pool = new Contract(poolAddress, POOL_ABI, wallet)
      const { sqrtPriceX96, tick } = await pool.slot0()
      expect(sqrtPriceX96).to.eq(encodePriceSqrt(1, 1))
      expect(tick).to.eq(0)
    })

    it('fails if deadline is in past')

    it('gas cost', async () => {
      await snapshotGasCost(
        router.createPoolAndAddLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          sqrtPriceX96: encodePriceSqrt(1, 1),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      )
    })
  })

  describe('#addLiquidity', () => {
    it('reverts if pool does not exist', async () => {
      await expect(
        router.addLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
        })
      ).to.be.reverted
    })

    describe('pool exists', () => {
      const startingPrice = encodePriceSqrt(1, 1)
      beforeEach('create the pool directly', async () => {
        await v3CoreFactory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        const pool = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        await new Contract(pool, POOL_ABI, wallet).initialize(startingPrice)
      })

      it('allows adding liquidity', async () => {
        await router.addLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
        })
      })

      it('fails if deadline is in past')

      it('gas cost', async () => {
        await snapshotGasCost(
          router.addLiquidity({
            token0: tokens[0].address,
            token1: tokens[1].address,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            recipient: wallet.address,
            amount: 10,
            deadline: 1,
            fee: FeeAmount.MEDIUM,
            amount0Max: constants.MaxUint256,
            amount1Max: constants.MaxUint256,
          })
        )
      })
    })
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

      await router.connect(wallet).createPoolAndAddLiquidity(liquidityParams)
      liquidityParams.token0 = tokens[1].address
      liquidityParams.token1 = tokens[2].address
      await router.connect(wallet).createPoolAndAddLiquidity(liquidityParams)
    })

    describe('#exactInput', () => {
      describe('single-pair', async () => {
        // helper for executing a single pair exact input trade
        const singlePair = async (zeroForOne: boolean) => {
          const tokenAddresses = tokens.slice(0, 2).map((t) => t.address)
          const fees = [FeeAmount.MEDIUM]
          const path = encodePath(zeroForOne ? tokenAddresses : tokenAddresses.reverse(), fees)

          let params = {
            path,
            amount: 3,
            amountSlippage: 1,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountSlippage = 2
          await expect(router.connect(trader).exactInput(params)).to.be.revertedWith('too little received')
          params.amountSlippage = 1

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
            amount: 5,
            amountSlippage: 1,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountSlippage = 2
          await expect(router.connect(trader).exactInput(params)).to.be.revertedWith('too little received')
          params.amountSlippage = 1

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
            amount: 1,
            amountSlippage: 3,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountSlippage = 2
          await expect(router.connect(trader).exactOutput(params)).to.be.revertedWith('too much requested')
          params.amountSlippage = 3

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
            amount: 1,
            amountSlippage: 5,
            recipient: trader.address,
            deadline: 1,
          }

          // ensure that it fails if the limit is any tighter
          params.amountSlippage = 4
          await expect(router.connect(trader).exactOutput(params)).to.be.revertedWith('too much requested')
          params.amountSlippage = 5

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

  describe('#firstMint', () => {
    it('creates the pair at the expected address', async () => {
      const expectedAddress = computePoolAddress(
        v3CoreFactory.address,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.eq('0x')
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      const codeAfter = await wallet.provider.getCode(expectedAddress)
      expect(codeAfter).to.not.eq('0x')
    })
  })
})
