import { constants } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { expect } from './shared/expect'
import { Fixture } from 'ethereum-waffle'
import { TestNonfungiblePositionLibrary, MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { sortedTokens } from './shared/tokenSort'
import { extractJSONFromURI } from './shared/extractJSONFromURI'

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const TBTC = '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const WETH = '0x4200000000000000000000000000000000000006'

describe('NonfungibleTokenPositionLibrary', () => {
  const [...wallets] = waffle.provider.getWallets()

  const nftPositionLibraryCompleteFixture: Fixture<{
    tokens: [TestERC20, TestERC20, TestERC20]
    testNftPositionLibrary: TestNonfungiblePositionLibrary
    nft: MockTimeNonfungiblePositionManager
  }> = async (wallets, provider) => {
    const { factory, nft, router } = await completeFixture(wallets, provider)
    const tokenFactory = await ethers.getContractFactory('TestERC20')
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
    const nftPositionLibrary = await nonfungiblePositionLibraryFactory.deploy()

    const testNonfungiblePositionLibraryFactory = await ethers.getContractFactory('TestNonfungiblePositionLibrary', {
      libraries: {
        NonfungiblePositionLibrary: nftPositionLibrary.address,
      },
    })
    const testNftPositionLibrary = (await testNonfungiblePositionLibraryFactory.deploy()) as TestNonfungiblePositionLibrary

    // OVM update: await each token deployment individually instead of awaiting Promise.all() to ensure nonce is
    // properly incremented on each deploy transaction when testing against l2geth
    const token0 = await tokenFactory.deploy(constants.MaxUint256.div(2)) // do not use maxu25e6 to avoid overflowing
    const token1 = await tokenFactory.deploy(constants.MaxUint256.div(2))
    const token2 = await tokenFactory.deploy(constants.MaxUint256.div(2))
    const tokens = [token0, token1, token2] as [TestERC20, TestERC20, TestERC20]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      testNftPositionLibrary,
      tokens,
      nft,
    }
  }

  let testNftPositionLibrary: TestNonfungiblePositionLibrary
  let tokens: [TestERC20, TestERC20, TestERC20]
  let nft: MockTimeNonfungiblePositionManager
  let weth9: TestERC20

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ tokens, nft, testNftPositionLibrary } = await loadFixture(nftPositionLibraryCompleteFixture))
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    weth9 = tokenFactory.attach(await testNftPositionLibrary.WETH9()) as TestERC20
  })

  describe('#tokenRatioPriority', () => {
    it('returns -100 for WETH9', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(WETH, 1)).to.eq(-100)
    })

    it('returns 200 for USDC', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(USDC, 1)).to.eq(300)
    })

    it('returns 100 for DAI', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(DAI, 1)).to.eq(100)
    })

    it('returns  150 for USDT', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(USDT, 1)).to.eq(200)
    })

    it('returns -200 for TBTC', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(TBTC, 1)).to.eq(-200)
    })

    it('returns -250 for WBTC', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(WBTC, 1)).to.eq(-300)
    })

    it('returns 0 for any non-ratioPriority token', async () => {
      expect(await testNftPositionLibrary.tokenRatioPriority(tokens[0].address, 1)).to.eq(0)
    })
  })

  describe('#flipRatio', () => {
    it('returns false if neither token has priority ordering', async () => {
      expect(await testNftPositionLibrary.flipRatio(tokens[0].address, tokens[2].address, 1)).to.eq(false)
    })

    it('returns true if both tokens are numerators but token0 has a higher priority ordering', async () => {
      expect(await testNftPositionLibrary.flipRatio(USDC, DAI, 1)).to.eq(true)
    })

    it('returns true if both tokens are denominators but token1 has lower priority ordering', async () => {
      expect(await testNftPositionLibrary.flipRatio(weth9.address, WBTC, 1)).to.eq(true)
    })

    it('returns true if token0 is a numerator and token1 is a denominator', async () => {
      expect(await testNftPositionLibrary.flipRatio(DAI, WBTC, 1)).to.eq(true)
    })

    it('returns false if token1 is a numerator and token0 is a denominator', async () => {
      expect(await testNftPositionLibrary.flipRatio(WBTC, DAI, 1)).to.eq(false)
    })
  })

  describe('#tokenURI', () => {
    it('displays ETH as token symbol for WETH token', async () => {
      const [token0, token1] = sortedTokens(weth9, tokens[1])
      await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await weth9.approve(nft.address, 100)
      await tokens[1].approve(nft.address, 100)
      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })

      const metadata = extractJSONFromURI(await nft.tokenURI(1))
      expect(metadata.name).to.match(/(\sETH\/TEST|TEST\/ETH)/)
      expect(metadata.description).to.match(/(TEST-ETH|\sETH-TEST)/)
      expect(metadata.description).to.match(/(\nETH\sAddress)/)
    })

    it('displays returned token symbols when neither token is WETH ', async () => {
      const [token0, token1] = sortedTokens(tokens[2], tokens[1])
      await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tokens[1].approve(nft.address, 100)
      await tokens[2].approve(nft.address, 100)
      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })

      const metadata = extractJSONFromURI(await nft.tokenURI(1))
      expect(metadata.name).to.match(/TEST\/TEST/)
      expect(metadata.description).to.match(/TEST-TEST/)
    })
  })
})
