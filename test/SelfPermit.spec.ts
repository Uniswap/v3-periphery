import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { MockTimeUniswapV3Router01, TestERC20 } from '../typechain'
import { expect } from 'chai'
import { getPermitSignature } from './shared/permit'
import { v3RouterFixture } from './shared/fixtures'

describe('SelfPermit', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const fixture: Fixture<{
    token: TestERC20
    router: MockTimeUniswapV3Router01
  }> = async (wallets, provider) => {
    const factory = await ethers.getContractFactory('TestERC20')
    const token = (await factory.deploy(0)) as TestERC20

    const { router } = await v3RouterFixture(wallets, provider)

    return {
      token,
      router,
    }
  }

  let token: TestERC20
  let router: MockTimeUniswapV3Router01

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ token, router } = await loadFixture(fixture))
  })

  it('#permit', async () => {
    const value = 123

    const { v, r, s } = await getPermitSignature(wallet, token, other.address, value)

    expect(await token.allowance(wallet.address, other.address)).to.be.eq(0)
    await token.permit(wallet.address, other.address, value, constants.MaxUint256, v, r, s)
    expect(await token.allowance(wallet.address, other.address)).to.be.eq(value)
  })

  describe('#selfPermit', () => {
    const value = 456

    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, value)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await router.selfPermit(token.address, value, constants.MaxUint256, v, r, s)
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(value)
    })

    it('fails if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, value)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await token.permit(wallet.address, router.address, value, constants.MaxUint256, v, r, s)
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(value)

      await expect(router.selfPermit(token.address, value, constants.MaxUint256, v, r, s)).to.be.revertedWith(
        'ERC20Permit: invalid signature'
      )
    })
  })

  describe('#selfPermitIfNecessary', () => {
    const value = 789

    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, value)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await router.selfPermitIfNecessary(token.address, value, constants.MaxUint256, v, r, s)
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(value)
    })

    it('does not fail if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, value)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await token.permit(wallet.address, router.address, value, constants.MaxUint256, v, r, s)
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(value)

      await router.selfPermitIfNecessary(token.address, value, constants.MaxUint256, v, r, s)
    })
  })
})
