import { Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { PeripheryImmutableState, IWETH9, IWETH10 } from '../typechain'
import { expect } from './shared/expect'
import { v3RouterFixture } from './shared/externalFixtures'

describe('PeripheryImmutableState', () => {
  const wallets = waffle.provider.getWallets()

  const nonfungiblePositionManagerFixture: Fixture<{
    weth9: IWETH9
    weth10: IWETH10
    factory: Contract
    state: PeripheryImmutableState
  }> = async (wallets, provider) => {
    const { weth9, weth10, factory } = await v3RouterFixture(wallets, provider)

    const stateFactory = await ethers.getContractFactory('PeripheryImmutableState')
    const state = (await stateFactory.deploy(factory.address, weth9.address, weth10.address)) as PeripheryImmutableState

    return {
      weth9,
      weth10,
      factory,
      state,
    }
  }

  let factory: Contract
  let weth9: IWETH9
  let weth10: IWETH10
  let state: PeripheryImmutableState

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ state, weth9, weth10, factory } = await loadFixture(nonfungiblePositionManagerFixture))
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
      expect(await state.factory()).to.eq(factory.address)
    })
  })
})
