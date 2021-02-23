import { Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { UniswapV3Router01, WETH9 } from '../typechain'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'

describe('UniswapV3Router01', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const routerFixture: Fixture<{ router: UniswapV3Router01; weth: WETH9; v3CoreFactory: Contract }> = async (
    wallets,
    provider
  ) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const wethFactory = await ethers.getContractFactory('WETH9')
    const weth = (await wethFactory.deploy()) as WETH9

    const routerFactory = await ethers.getContractFactory('UniswapV3Router01')
    const router = (await routerFactory.deploy(v3CoreFactory.address, weth.address)) as UniswapV3Router01
    return {
      weth,
      router,
      v3CoreFactory,
    }
  }

  let v3CoreFactory: Contract
  let weth: WETH9
  let router: UniswapV3Router01

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ router, weth, v3CoreFactory } = await loadFixture(routerFixture))
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
})
