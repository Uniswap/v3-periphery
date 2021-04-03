import { ContractFactory, BigNumberish, constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { expect } from './shared/expect'
import { Fixture } from 'ethereum-waffle'
import {
  MockTimeNonfungiblePositionManager,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IWETH9,
  IUniswapV3Factory,
  SwapRouter,
  TransparentUpgradeableProxy,
  ProxyAdmin,
} from '../typechain'

describe('NonfungibleTokenPositionDescriptor', () => {
  const [user, deployer, admin, ...wallets] = waffle.provider.getWallets()

  const nftPositionDescriptorCompleteFixture: Fixture<{
    tokens: [TestERC20, TestERC20, TestERC20, TestERC20, TestERC20]
    nftPositionDescriptor: NonfungibleTokenPositionDescriptor
    newImplementation: NonfungibleTokenPositionDescriptor
    proxyAdmin: ProxyAdmin
    proxy: TransparentUpgradeableProxy
  }> = async (wallets, provider) => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const NonfungibleTokenPositionDescriptorFactory = await ethers.getContractFactory(
      'NonfungibleTokenPositionDescriptor'
    )
    const ProxyAdminFactory = await ethers.getContractFactory('ProxyAdmin')
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
      'TransparentUpgradeableProxy'
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
    const newImplementation = (await NonfungibleTokenPositionDescriptorFactory.deploy()) as NonfungibleTokenPositionDescriptor
    const proxyAdmin = (await ProxyAdminFactory.connect(admin).deploy()) as ProxyAdmin
    const proxy = (await TransparentUpgradeableProxy.connect(deployer).deploy(
      nftPositionDescriptor.address,
      proxyAdmin.address,
      nftPositionDescriptor.interface.encodeFunctionData('initialize', [
        proxyAdmin.address,
        [
          { token: tokens[0].address, priority: -2 },
          { token: tokens[1].address, priority: -1 },
          { token: tokens[3].address, priority: 1 },
          { token: tokens[4].address, priority: 2 },
        ],
      ])
    )) as TransparentUpgradeableProxy

    return {
      nftPositionDescriptor,
      newImplementation,
      tokens,
      proxy,
      proxyAdmin
    }
  }

  let proxy: TransparentUpgradeableProxy
  let proxyAdmin: ProxyAdmin
  let nftPositionDescriptor: NonfungibleTokenPositionDescriptor
  let newImplementation: NonfungibleTokenPositionDescriptor
  let tokens: [TestERC20, TestERC20, TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ nftPositionDescriptor, newImplementation, tokens, proxy, proxyAdmin } = await loadFixture(nftPositionDescriptorCompleteFixture))
    const NonfungibleTokenPositionDescriptorFactory = await ethers.getContractFactory(
      'NonfungibleTokenPositionDescriptor'
    )
    // call nftPositionDescriptor through proxy contract
    nftPositionDescriptor = NonfungibleTokenPositionDescriptorFactory.attach(proxy.address) as NonfungibleTokenPositionDescriptor
  })

  describe('upgradeability', () => {
    it('initalizes owner', async () => {
      expect(await nftPositionDescriptor.owner()).to.eq(proxyAdmin.address)
    })

    it('initializes token priority storage', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[0].address)).to.eq(-2)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[1].address)).to.eq(-1)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[2].address)).to.eq(0)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[3].address)).to.eq(1)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[4].address)).to.eq(2)
    })

    it('correctly updates token priority storage on implementation upgrade', async () => {
      await proxyAdmin.connect(admin).upgradeAndCall(
        proxy.address,
        newImplementation.address,
        nftPositionDescriptor.interface.encodeFunctionData('setStorage', [
          [
            { token: tokens[0].address, priority: 2 },
            { token: tokens[1].address, priority: 0},
            { token: tokens[2].address, priority: 1 },
          ],
        ])
      )
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[0].address)).to.eq(2)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[1].address)).to.eq(0)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[2].address)).to.eq(1)
      // unset storage remains the same
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[3].address)).to.eq(1)
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[4].address)).to.eq(2)
    })

    it('cannot call setStorage from non proxyAdmin accounts', async () => {
      expect(nftPositionDescriptor.connect(user).setStorage(
        [
          { token: tokens[0].address, priority: 2 },
          { token: tokens[1].address, priority: 0},
          { token: tokens[2].address, priority: 1 },
          ]
        )
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
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
