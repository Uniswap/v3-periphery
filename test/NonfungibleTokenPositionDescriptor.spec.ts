import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { expect } from './shared/expect'
import { Fixture } from 'ethereum-waffle'
import { NonfungibleTokenPositionDescriptor, TestERC20 } from '../typechain'

describe('NonfungibleTokenPositionDescriptor', () => {
  const wallets = waffle.provider.getWallets()

  const nftPositionDescriptorFixture: Fixture<{
    tokens: [TestERC20, TestERC20, TestERC20, TestERC20, TestERC20]
    nftPositionDescriptor: NonfungibleTokenPositionDescriptor
  }> = async (wallets, provider) => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const NonfungibleTokenPositionDescriptorFactory = await ethers.getContractFactory(
      'NonfungibleTokenPositionDescriptor'
    )
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu25e6 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20, TestERC20, TestERC20, TestERC20]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))
    const nftPositionDescriptor = (await NonfungibleTokenPositionDescriptorFactory.deploy()) as NonfungibleTokenPositionDescriptor
    return {
      nftPositionDescriptor,
      tokens,
    }
  }

  let nftPositionDescriptor: NonfungibleTokenPositionDescriptor
  let tokens: [TestERC20, TestERC20, TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ nftPositionDescriptor, tokens } = await loadFixture(nftPositionDescriptorFixture))
    await nftPositionDescriptor.initialize([
      { token: tokens[0].address, priority: -2 },
      { token: tokens[1].address, priority: -1 },
      { token: tokens[3].address, priority: 1 },
      { token: tokens[4].address, priority: 2 },
    ])
  })

  describe('#flipRatio', () => {
    it('returns false if neither token has priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[2].address, tokens[2].address)).to.eq(false)
    })

    it('returns true if both tokens are numerators but token0 has a higher priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[4].address, tokens[3].address)).to.eq(true)
    })

    it('returns true if both tokens are denominators but token1 has lower priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[1].address, tokens[0].address)).to.eq(true)
    })

    it('returns true if token0 is a numerator and token1 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[3].address, tokens[1].address)).to.eq(true)
    })

    it('returns false if token1 is a numerator and token0 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[1].address, tokens[3].address)).to.eq(false)
    })
  })
})
