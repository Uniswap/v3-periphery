import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { MockTimeSwapRouter, TestERC20PermitAllowed } from '../typechain'
import { expect } from 'chai'
import { getPermitSignature } from './shared/permit'
import { v3RouterFixture } from './shared/externalFixtures'

describe('SelfPermit', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const fixture: Fixture<{
    token: TestERC20PermitAllowed
    router: MockTimeSwapRouter
  }> = async (wallets, provider) => {
    const tokenFactory = await ethers.getContractFactory('TestERC20PermitAllowed')
    const token = (await tokenFactory.deploy(0)) as TestERC20PermitAllowed

    const { router } = await v3RouterFixture(wallets, provider)

    return {
      token,
      router,
    }
  }

  let token: TestERC20PermitAllowed
  let router: MockTimeSwapRouter

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
    await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
      wallet.address,
      other.address,
      value,
      constants.MaxUint256,
      v,
      r,
      s
    )
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
      await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
        wallet.address,
        router.address,
        value,
        constants.MaxUint256,
        v,
        r,
        s
      )
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
      await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
        wallet.address,
        router.address,
        value,
        constants.MaxUint256,
        v,
        r,
        s
      )
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(value)

      await router.selfPermitIfNecessary(token.address, value, constants.MaxUint256, v, r, s)
    })
  })

  describe('#selfPermitAllowed', () => {
    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await expect(router.selfPermitAllowed(token.address, 0, constants.MaxUint256, v, r, s))
        .to.emit(token, 'Approval')
        .withArgs(wallet.address, router.address, constants.MaxUint256)
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(constants.MaxUint256)
    })

    it('fails if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await token['permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)'](
        wallet.address,
        router.address,
        0,
        constants.MaxUint256,
        true,
        v,
        r,
        s
      )
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(constants.MaxUint256)

      await expect(router.selfPermitAllowed(token.address, 0, constants.MaxUint256, v, r, s)).to.be.revertedWith(
        'TestERC20PermitAllowed::permit: wrong nonce'
      )
    })
  })

  describe('#selfPermitAllowedIfNecessary', () => {
    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, router.address)).to.eq(0)
      await expect(router.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s))
        .to.emit(token, 'Approval')
        .withArgs(wallet.address, router.address, constants.MaxUint256)
      expect(await token.allowance(wallet.address, router.address)).to.eq(constants.MaxUint256)
    })

    it('skips if already max approved', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await token.approve(router.address, constants.MaxUint256)
      await expect(router.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s)).to.not.emit(
        token,
        'Approval'
      )
      expect(await token.allowance(wallet.address, router.address)).to.eq(constants.MaxUint256)
    })

    it('does not fail if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, router.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, router.address)).to.be.eq(0)
      await token['permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)'](
        wallet.address,
        router.address,
        0,
        constants.MaxUint256,
        true,
        v,
        r,
        s
      )
      expect(await token.allowance(wallet.address, router.address)).to.be.eq(constants.MaxUint256)

      await router.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s)
    })
  })
})
