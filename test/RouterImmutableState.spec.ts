import { Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { RouterImmutableState, WETH9, TestERC20 } from '../typechain'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'

describe('RouterImmutableState', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const nonfungiblePositionManagerFixture: Fixture<{
    weth: WETH9
    v3CoreFactory: Contract
    state: RouterImmutableState
  }> = async (wallets, provider) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const wethFactory = await ethers.getContractFactory('WETH9')
    const weth = (await wethFactory.deploy()) as WETH9

    const stateFactory = await ethers.getContractFactory('RouterImmutableState')
    const state = (await stateFactory.deploy(v3CoreFactory.address, weth.address)) as RouterImmutableState

    return {
      weth,
      v3CoreFactory,
      state,
    }
  }

  let v3CoreFactory: Contract
  let weth: WETH9
  let state: RouterImmutableState

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ state, weth, v3CoreFactory } = await loadFixture(nonfungiblePositionManagerFixture))
  })

  it('bytecode size', async () => {
    expect(((await state.provider.getCode(state.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#WETH', () => {
    it('points to WETH', async () => {
      expect(await state.WETH()).to.eq(weth.address)
    })
  })

  describe('#factory', () => {
    it('points to v3 core factory', async () => {
      expect(await state.factory()).to.eq(v3CoreFactory.address)
    })
  })
})
