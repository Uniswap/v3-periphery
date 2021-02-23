import { constants, Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { UniswapV3Router01, WETH9, TestERC20 } from '../typechain'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'
import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt, FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from './shared/utilities'

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
      tokenFactory.deploy(constants.MaxUint256),
      tokenFactory.deploy(constants.MaxUint256),
      tokenFactory.deploy(constants.MaxUint256),
    ])) as [TestERC20, TestERC20, TestERC20]

    // approve all tokens from wallet
    await Promise.all(tokens.map((token) => token.approve(router.address, constants.MaxUint256)))

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      weth,
      router,
      v3CoreFactory,
      tokens,
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

  describe('#createPairAndAddLiquidity', () => {
    it('creates a pair', async () => {
      await router.createPairAndAddLiquidity({
        tokenA: tokens[0].address,
        tokenB: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('gas cost', async () => {
      await snapshotGasCost(
        router.createPairAndAddLiquidity({
          tokenA: tokens[0].address,
          tokenB: tokens[1].address,
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
})
