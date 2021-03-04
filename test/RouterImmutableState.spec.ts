import { Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { RouterImmutableState, WETH9, WETH10 } from '../typechain'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'

describe('RouterImmutableState', () => {
  const wallets = waffle.provider.getWallets()

  const nonfungiblePositionManagerFixture: Fixture<{
    weth9: WETH9
    weth10: WETH10
    v3CoreFactory: Contract
    state: RouterImmutableState
  }> = async (wallets, provider) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const weth9Factory = await ethers.getContractFactory('WETH9')
    const weth9 = (await weth9Factory.deploy()) as WETH9

    const weth10Factory = await ethers.getContractFactory('WETH10')
    const weth10 = (await weth10Factory.deploy()) as WETH10

    const stateFactory = await ethers.getContractFactory('RouterImmutableState')
    const state = (await stateFactory.deploy(
      v3CoreFactory.address,
      weth9.address,
      weth10.address
    )) as RouterImmutableState

    return {
      weth9,
      weth10,
      v3CoreFactory,
      state,
    }
  }

  let v3CoreFactory: Contract
  let weth9: WETH9
  let weth10: WETH10
  let state: RouterImmutableState

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ state, weth9, weth10, v3CoreFactory } = await loadFixture(nonfungiblePositionManagerFixture))
  })

  it('bytecode size', async () => {
    expect(((await state.provider.getCode(state.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#WETH9', () => {
    it('points to WETH9', async () => {
      expect(await state.WETH9()).to.eq(weth9.address)
    })
  })

  describe('#WETH10', () => {
    it('points to WETH10', async () => {
      expect(await state.WETH10()).to.eq(weth10.address)
    })
  })

  describe('#factory', () => {
    it('points to v3 core factory', async () => {
      expect(await state.factory()).to.eq(v3CoreFactory.address)
    })
  })
})
