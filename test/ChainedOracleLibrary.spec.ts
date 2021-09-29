import { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, ContractFactory } from 'ethers'
import { TestERC20, ChainedOracleTest, MockObservableWithTokens } from '../typechain'
import poolAtAddress from './shared/poolAtAddress'
import { getAddress } from '@ethersproject/address'
import { formatSqrtRatioX96 } from './shared/formatSqrtRatioX96'
import { format } from 'prettier'
import { encodePriceSqrt } from './shared/encodePriceSqrt'

describe.only('ChainedOracleLibrary', () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let tokens: TestERC20[]
  let oracle: ChainedOracleTest
  const wallets = waffle.provider.getWallets()

  const chainedOracleTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens: [TestERC20, TestERC20, TestERC20] = [
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
    ]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))
    tokens.sort((b, c) => (b.address.toLowerCase() < c.address.toLowerCase() ? -1 : 1))

    const chainedOracleLibraryFactory = await ethers.getContractFactory('ChainedOracleLibrary')
    const chainedOracleLibrary = await chainedOracleLibraryFactory.deploy()
    const oracleFactory = await ethers.getContractFactory('ChainedOracleTest', {
      libraries: {
        ChainedOracleLibrary: chainedOracleLibrary.address,
      },
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

  describe('#getPriceChained', () => {
    let mockObservableWithTokensFactory: ContractFactory

    before('create mockObservableFactory', async () => {
      mockObservableWithTokensFactory = await ethers.getContractFactory('MockObservableWithTokens')
    })

    it('reverts when secondsAgo is 0', async () => {
      const secondsAgo = 0
      const tickCumulatives = [BigNumber.from(-7), BigNumber.from(-12)]
      const mockObservableWithTokens0 = await mockObservableWithTokensFactory.deploy(
        tokens[0].address,
        tokens[1].address,
        [secondsAgo, 0],
        tickCumulatives,
        [0, 0]
      )
      const mockObservableWithTokens1 = await mockObservableWithTokensFactory.deploy(
        tokens[1].address,
        tokens[2].address,
        [secondsAgo, 0],
        tickCumulatives,
        [0, 0]
      )
      expect(
        oracle.getPriceChained(secondsAgo, mockObservableWithTokens0.address, mockObservableWithTokens1.address)
      ).to.be.revertedWith('BP')
    })

    it('correct output when tick is 0', async () => {
      const secondsAgo = 15
      const tickCumulatives0 = [BigNumber.from(0), BigNumber.from(0)]
      const tickCumulatives1 = [BigNumber.from(0), BigNumber.from(0)]
      const mockObservableWithTokens0 = await mockObservableWithTokensFactory.deploy(
        tokens[0].address,
        tokens[1].address,
        [secondsAgo, 0],
        tickCumulatives0,
        [0, 0]
      )
      const mockObservableWithTokens1 = await mockObservableWithTokensFactory.deploy(
        tokens[1].address,
        tokens[2].address,
        [secondsAgo, 0],
        tickCumulatives1,
        [0, 0]
      )
      const chainedPrice = await oracle.getPriceChained(
        secondsAgo,
        mockObservableWithTokens0.address,
        mockObservableWithTokens1.address
      )
      console.log('formatted sqrt ratio price of this call is', formatSqrtRatioX96(chainedPrice))

      expect(formatSqrtRatioX96(chainedPrice)).to.equal(BigNumber.from('1'))
    })

    it('correct output when tick poolA is 1 and tick pool B price is 4', async () => {
      // i think i need to alter mockObservable to be a pool, or take a token0 & token1
      const secondsAgo = 10
      const tickCumulatives0 = [BigNumber.from(100), BigNumber.from(100)]
      const tickCumulatives1 = [BigNumber.from(0), BigNumber.from(138636)]
      const mockObservableWithTokens0 = await mockObservableWithTokensFactory.deploy(
        tokens[0].address,
        tokens[1].address,
        [secondsAgo, 0],
        tickCumulatives0,
        [0, 0]
      )
      const mockObservableWithTokens1 = await mockObservableWithTokensFactory.deploy(
        tokens[1].address,
        tokens[2].address,
        [secondsAgo, 0],
        tickCumulatives1,
        [0, 0]
      )
      const chainedPrice = await oracle.getPriceChained(
        secondsAgo,
        mockObservableWithTokens0.address,
        mockObservableWithTokens1.address
      )

      console.log('formatted sqrt ratio price of this call is', formatSqrtRatioX96(chainedPrice))

      expect(formatSqrtRatioX96(chainedPrice)).to.equal(BigNumber.from(2))
    })
  })
})
