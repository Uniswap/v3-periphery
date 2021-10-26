import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, ContractFactory } from 'ethers'
import { TestERC20, ChainedOracleTest, MockObservableWithTokens } from '../typechain'

describe.only('ChainedOracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let tokens: TestERC20[]
  let oracle: ChainedOracleTest
  const wallets = waffle.provider.getWallets()

  const chainedOracleTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens: [TestERC20, TestERC20, TestERC20, TestERC20] = [
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
    ]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    const OracleLibraryFactory = await ethers.getContractFactory('OracleLibrary')
    const OracleLibrary = await OracleLibraryFactory.deploy()
    const oracleFactory = await ethers.getContractFactory('ChainedOracleTest', {
      // libraries: {
      //   OracleLibrary: OracleLibrary.address,
      // },
    })
    const oracle = await oracleFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      oracle: oracle as ChainedOracleTest,
    }
  }

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(chainedOracleTestFixture)
    tokens = fixtures['tokens']
    oracle = fixtures['oracle']
  })

  describe.only('#getChainedPrice', () => {
    let mockObservableWithTokensFactory: ContractFactory

    before('create mockObservableFactory', async () => {
      mockObservableWithTokensFactory = await ethers.getContractFactory('MockObservableWithTokens')
    })

    it('correct output when tick is 0', async () => {
      const chainedPrice = await oracle.getChainedPrice(
        [tokens[0].address, tokens[1].address, tokens[2].address],
        [0, 0]
      )
      console.log('the chained tick is', chainedPrice)

      expect(chainedPrice).to.equal(BigNumber.from('0'))
    })

    it('correct output when all ticks are 1', async () => {
      const chainedPrice = await oracle.getChainedPrice(
        [tokens[0].address, tokens[1].address, tokens[2].address],
        [1, 1]
      )
      console.log('the chained tick is', chainedPrice)
      console.log('the addresses are', tokens[0].address, tokens[1].address, tokens[2].address)

      expect(chainedPrice).to.equal(BigNumber.from('1'))
    })
    it('correct output when all ticks are 2', async () => {
      const chainedPrice = await oracle.getChainedPrice(
        [tokens[0].address, tokens[1].address, tokens[2].address],
        [2, 2]
      )
      console.log('the chained tick is', chainedPrice)

      expect(chainedPrice).to.equal(BigNumber.from('4'))
    })
    it('correct output when ticks are 2 and 4', async () => {
      const chainedPrice = await oracle.getChainedPrice(
        [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address],
        [4, 2, 2]
      )
      console.log('the chained tick is', chainedPrice)

      expect(chainedPrice).to.equal(BigNumber.from('8'))
    })
  })
})
