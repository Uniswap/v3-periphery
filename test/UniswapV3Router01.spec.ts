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
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

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
      const params = {
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      }
      await router.createPoolAndAddLiquidity(params)

      await expect(router.createPoolAndAddLiquidity(params)).to.be.reverted
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
      const pool = poolAtAddress(poolAddress, wallet)
      const { sqrtPriceX96, tick } = await pool.slot0()
      expect(sqrtPriceX96).to.eq(encodePriceSqrt(1, 1))
      expect(tick).to.eq(0)
    })

    it('fails if deadline is in past')

    it('gas', async () => {
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
        const poolAddress = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        await poolAtAddress(poolAddress, wallet).initialize(startingPrice)
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

      it('gas', async () => {
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

    it('creates a token', async () => {
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      expect(await router.balanceOf(other.address)).to.eq(1)
      expect(await router.tokenOfOwnerByIndex(other.address, 0)).to.eq(1)
      const {
        fee,
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await router.positions(1)
      expect(token0).to.eq(tokens[0].address)
      expect(token1).to.eq(tokens[1].address)
      expect(fee).to.eq(FeeAmount.MEDIUM)
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(liquidity).to.eq(10)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
      expect(feeGrowthInside0LastX128).to.eq(0)
      expect(feeGrowthInside1LastX128).to.eq(0)
    })

    it('fails if pool already exists', async () => {
      const params = {
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      }
      await router.firstMint(params)

      await expect(router.firstMint(params)).to.be.reverted
    })

    it('gas', async () => {
      await snapshotGasCost(
        router.firstMint({
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

  describe('#mint', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        router.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.reverted
    })

    it('creates a token', async () => {
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await router.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Max: constants.MaxUint256,
        amount1Max: constants.MaxUint256,
        amount: 15,
        deadline: 10,
        fee: FeeAmount.MEDIUM,
      })
      expect(await router.balanceOf(other.address)).to.eq(2)
      expect(await router.tokenOfOwnerByIndex(other.address, 1)).to.eq(2)
      const {
        fee,
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await router.positions(2)
      expect(token0).to.eq(tokens[0].address)
      expect(token1).to.eq(tokens[1].address)
      expect(fee).to.eq(FeeAmount.MEDIUM)
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(liquidity).to.eq(15)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
      expect(feeGrowthInside0LastX128).to.eq(0)
      expect(feeGrowthInside1LastX128).to.eq(0)
    })

    it('gas', async () => {
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await snapshotGasCost(
        router.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
          amount: 15,
          deadline: 10,
          fee: FeeAmount.MEDIUM,
        })
      )
    })
  })

  describe('#increaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('increases position liquidity', async () => {
      await router.increaseLiquidity(tokenId, 150, constants.MaxUint256, constants.MaxUint256, 1)
      const { liquidity } = await router.positions(tokenId)
      expect(liquidity).to.eq(250)
    })

    it('gas', async () => {
      await snapshotGasCost(router.increaseLiquidity(tokenId, 150, constants.MaxUint256, constants.MaxUint256, 1))
    })
  })

  describe('#decreaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await router.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('cannot be called by other addresses', async () => {
      await expect(router.decreaseLiquidity(tokenId, 50, 0, 0)).to.be.revertedWith('AUTH')
    })

    it('decreases position liquidity', async () => {
      await router.connect(other).decreaseLiquidity(tokenId, 25, 0, 0)
      const { liquidity } = await router.positions(tokenId)
      expect(liquidity).to.eq(75)
    })

    it('accounts for tokens owed', async () => {
      await router.connect(other).decreaseLiquidity(tokenId, 25, 0, 0)
      const { tokensOwed0, tokensOwed1 } = await router.positions(tokenId)
      expect(tokensOwed0).to.eq(24)
      expect(tokensOwed1).to.eq(24)
    })

    it('gas partial decrease', async () => {
      await snapshotGasCost(router.connect(other).decreaseLiquidity(tokenId, 50, 0, 0))
    })

    it('gas complete decrease', async () => {
      await snapshotGasCost(router.connect(other).decreaseLiquidity(tokenId, 100, 0, 0))
    })
  })
})
