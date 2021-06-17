import { Fixture } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import { constants } from 'ethers'
import {
  IWETH9,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  TestERC20,
  IUniswapV3Factory,
} from '../../typechain'

const completeFixture: Fixture<{
  weth9: IWETH9
  factory: IUniswapV3Factory
  router: MockTimeSwapRouter
  nft: MockTimeNonfungiblePositionManager
  tokens: [TestERC20, TestERC20, TestERC20]
}> = async (wallets, provider) => {
  const { weth9, factory, router } = await v3RouterFixture(wallets, provider)

  // OVM update: await each token deployment individually instead of awaiting Promise.all() to ensure nonce is properly
  // incremented on each deploy transaction when testing against l2geth
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const token0 = await tokenFactory.deploy(constants.MaxUint256.div(2)) // do not use maxu256 to avoid overflowing
  const token1 = await tokenFactory.deploy(constants.MaxUint256.div(2))
  const token2 = await tokenFactory.deploy(constants.MaxUint256.div(2))
  const tokens = [token0, token1, token2] as [TestERC20, TestERC20, TestERC20]

  const tickMath = await (await ethers.getContractFactory('TickMath')).deploy()
  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor', {
    libraries: {
      TickMath: tickMath.address,
    },
  })
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
  const nonfungiblePositionLibraryFactory = await ethers.getContractFactory('NonfungiblePositionLibrary', {
    libraries: {
      NFTDescriptor: nftDescriptorLibrary.address,
      TickMath: tickMath.address,
    },
  })
  const nonfungiblePositionLibrary = await nonfungiblePositionLibraryFactory.deploy()

  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager', {
    libraries: {
      NonfungiblePositionLibrary: nonfungiblePositionLibrary.address,
    },
  })
  const nft = (await positionManagerFactory.deploy(
    factory.address,
    weth9.address
  )) as MockTimeNonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    weth9,
    factory,
    router,
    tokens,
    nft,
  }
}

export default completeFixture
