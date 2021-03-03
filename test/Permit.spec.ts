import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { TestERC20WithPermit } from '../typechain'
import { splitSignature } from 'ethers/lib/utils'
import { expect } from 'chai'
import { getPermitSignature } from './shared/permit'

describe('Permit', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const fixture: Fixture<{
    tokenWithPermit: TestERC20WithPermit
  }> = async () => {
    const factory = await ethers.getContractFactory('TestERC20WithPermit')
    const tokenWithPermit = (await factory.deploy(constants.MaxUint256.div(2))) as TestERC20WithPermit

    return {
      tokenWithPermit,
    }
  }

  let tokenWithPermit: TestERC20WithPermit

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ tokenWithPermit } = await loadFixture(fixture))
  })

  it('permit works', async () => {
    const value = 123

    const { v, r, s } = await getPermitSignature(wallet, tokenWithPermit, other.address, value)

    expect(await tokenWithPermit.allowance(wallet.address, other.address)).to.be.eq(0)
    await tokenWithPermit.permit(wallet.address, other.address, value, constants.MaxUint256, v, r, s)
    expect(await tokenWithPermit.allowance(wallet.address, other.address)).to.be.eq(value)
  })
})
