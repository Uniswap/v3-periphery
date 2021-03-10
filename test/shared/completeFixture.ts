import { Fixture } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import { constants, Contract } from 'ethers'
import { IWETH10, IWETH9, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, TestERC20 } from '../../typechain'

const completeFixture: Fixture<{
  weth9: IWETH9
  weth10: IWETH10
  factory: Contract
  router: MockTimeSwapRouter
  nft: MockTimeNonfungiblePositionManager
  tokens: [TestERC20, TestERC20, TestERC20]
}> = async (wallets, provider) => {
  const { weth9, weth10, factory, router } = await v3RouterFixture(wallets, provider)

  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokens = (await Promise.all([
    tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
    tokenFactory.deploy(constants.MaxUint256.div(2)),
    tokenFactory.deploy(constants.MaxUint256.div(2)),
  ])) as [TestERC20, TestERC20, TestERC20]

  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor')
  const positionDescriptor = await positionDescriptorFactory.deploy()

  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')
  const nft = (await positionManagerFactory.deploy(
    factory.address,
    weth9.address,
    weth10.address,
    positionDescriptor.address
  )) as MockTimeNonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    weth9,
    weth10,
    factory,
    router,
    tokens,
    nft,
  }
}

export default completeFixture
