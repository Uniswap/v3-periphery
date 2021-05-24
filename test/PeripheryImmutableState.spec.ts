import { Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { PeripheryImmutableStateTest, IWETH9 } from '../typechain'
import { expect } from './shared/expect'
import { v3RouterFixture } from './shared/externalFixtures'

describe('PeripheryImmutableState', () => {
  const wallets = waffle.provider.getWallets()

  const nonfungiblePositionManagerFixture: Fixture<{
    weth9: IWETH9
    factory: Contract
    state: PeripheryImmutableStateTest
  }> = async (wallets, provider) => {
    const { weth9, factory } = await v3RouterFixture(wallets, provider)

    const stateFactory = await ethers.getContractFactory('PeripheryImmutableStateTest')
    const state = (await stateFactory.deploy(factory.address, weth9.address)) as PeripheryImmutableStateTest

    return {
      weth9,
      factory,
      state,
    }
  }

  let factory: Contract
  let weth9: IWETH9
  let state: PeripheryImmutableStateTest

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ state, weth9, factory } = await loadFixture(nonfungiblePositionManagerFixture))
  })

  it('bytecode size', async () => {
    expect(((await state.provider.getCode(state.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#WETH9', () => {
    it('points to WETH9', async () => {
      // In commit de5a8d0 the WETH address was removed as an input and hardcoded as a constant. This was done
      // to reduce contract size, so as a result this test would fail because the hardcoded address returned from
      // `State.WETH9()` will not match the address of WETH that was deployed here. As a result, we modified this
      // test to hardcode the OVM WETH address here as well, to verify that the contract's WETH address is correct
      // https://github.com/ScopeLift/uniswap-v3-periphery-ovm/commit/de5a8d08c686471c1d5c29e9632bbe083ca88188
      expect(await state.WETH9()).to.eq('0x4200000000000000000000000000000000000006')
    })
  })

  describe('#factory', () => {
    it('points to v3 core factory', async () => {
      expect(await state.factory()).to.eq(factory.address)
    })
  })
})
