import { BigNumber, constants } from 'ethers'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { waffle, ethers } from 'hardhat'
import { expect } from './shared/expect'
import { TestERC20Metadata, NFTDescriptorTest } from '../typechain'
import { Fixture } from 'ethereum-waffle'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import snapshotGasCost from './shared/snapshotGasCost'
import { base64Encode } from './shared/base64encode'
import { formatSqrtRatioX96 } from './shared/formatSqrtRatioX96'
import { getMaxTick, getMinTick } from './shared/ticks'
import Decimal from 'decimal.js'
import { randomBytes } from 'crypto'
import fs from 'fs'

const TEN = BigNumber.from(10)
const LOWEST_SQRT_RATIO = 4310618292
const HIGHEST_SQRT_RATIO = BigNumber.from(33849).mul(TEN.pow(34))

describe('NFTDescriptor', () => {
  const wallets = waffle.provider.getWallets()

  const nftDescriptorFixture: Fixture<{
    tokens: [TestERC20Metadata, TestERC20Metadata, TestERC20Metadata, TestERC20Metadata]
    nftDescriptor: NFTDescriptorTest
  }> = async (wallets, provider) => {
    const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
    const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()

    const tokenFactory = await ethers.getContractFactory('TestERC20Metadata')
    const NFTDescriptorFactory = await ethers.getContractFactory('NFTDescriptorTest', {
      libraries: {
        NFTDescriptor: nftDescriptorLibrary.address,
      },
    })
    const nftDescriptor = (await NFTDescriptorFactory.deploy()) as NFTDescriptorTest
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST1'), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST2'),
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST3'),
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST4'),
    ])) as [TestERC20Metadata, TestERC20Metadata, TestERC20Metadata, TestERC20Metadata]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))
    return {
      nftDescriptor,
      tokens,
    }
  }

  let nftDescriptor: NFTDescriptorTest
  let tokens: [TestERC20Metadata, TestERC20Metadata, TestERC20Metadata, TestERC20Metadata]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ nftDescriptor, tokens } = await loadFixture(nftDescriptorFixture))
  })

  describe('#constructTokenURI', () => {
    let tokenId: number
    let baseTokenAddress: string
    let quoteTokenAddress: string
    let baseTokenSymbol: string
    let quoteTokenSymbol: string
    let baseTokenDecimals: number
    let quoteTokenDecimals: number
    let flipRatio: boolean
    let tickLower: number
    let tickUpper: number
    let tickCurrent: number
    let tickSpacing: number
    let fee: number
    let poolAddress: string

    beforeEach(async () => {
      tokenId = 123
      baseTokenAddress = tokens[0].address
      quoteTokenAddress = tokens[1].address
      baseTokenSymbol = await tokens[0].symbol()
      quoteTokenSymbol = await tokens[1].symbol()
      baseTokenDecimals = await tokens[0].decimals()
      quoteTokenDecimals = await tokens[1].decimals()
      flipRatio = false
      tickLower = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      tickCurrent = 0
      tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
      fee = 3000
      poolAddress = `0x${'b'.repeat(40)}`
    })

    it('returns the valid JSON string with min and max ticks', async () => {
      const uri = await nftDescriptor.constructTokenURI({
        tokenId,
        baseTokenAddress,
        quoteTokenAddress,
        baseTokenSymbol,
        quoteTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        await tokenURI(
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          poolAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          '0.3%',
          'MIN<>MAX'
        )
      )
    })

    it('returns the valid JSON string with mid ticks', async () => {
      tickLower = -10
      tickUpper = 10
      tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
      fee = 3000

      const uri = await nftDescriptor.constructTokenURI({
        tokenId,
        quoteTokenAddress,
        baseTokenAddress,
        quoteTokenSymbol,
        baseTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        await tokenURI(
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          poolAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          '0.3%',
          '0.99900<>1.0010'
        )
      )
    })

    it('returns valid JSON when token symbols contain quotes', async () => {
      quoteTokenSymbol = '"TES"T1"'
      const uri = await nftDescriptor.constructTokenURI({
        tokenId,
        quoteTokenAddress,
        baseTokenAddress,
        quoteTokenSymbol,
        baseTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        await tokenURI(
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          poolAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          '0.3%',
          'MIN<>MAX'
        )
      )
    })

    describe('when the token ratio is flipped', () => {
      it('returns the valid JSON for mid ticks', async () => {
        flipRatio = true
        tickLower = -10
        tickUpper = 10

        const uri = await nftDescriptor.constructTokenURI({
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          quoteTokenDecimals,
          baseTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          fee,
          poolAddress,
        })
        expect(uri).to.equal(
          await tokenURI(
            tokenId,
            quoteTokenAddress,
            baseTokenAddress,
            poolAddress,
            quoteTokenSymbol,
            baseTokenSymbol,
            flipRatio,
            tickLower,
            tickUpper,
            tickCurrent,
            '0.3%',
            '0.99900<>1.0010'
          )
        )
      })

      it('returns the valid JSON for min/max ticks', async () => {
        flipRatio = true

        const uri = await nftDescriptor.constructTokenURI({
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          quoteTokenDecimals,
          baseTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          fee,
          poolAddress,
        })
        expect(uri).to.equal(
          await tokenURI(
            tokenId,
            quoteTokenAddress,
            baseTokenAddress,
            poolAddress,
            quoteTokenSymbol,
            baseTokenSymbol,
            flipRatio,
            tickLower,
            tickUpper,
            tickCurrent,
            '0.3%',
            'MIN<>MAX'
          )
        )
      })
    })

    it('gas', async () => {
      await snapshotGasCost(
        nftDescriptor.getGasCostOfConstructTokenURI({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          fee,
          poolAddress,
        })
      )
    })
  })

  describe('#addressToString', () => {
    it('returns the correct string for a given address', async () => {
      let addressStr = await nftDescriptor.addressToString(`0x${'1234abcdef'.repeat(4)}`)
      expect(addressStr).to.eq('0x1234abcdef1234abcdef1234abcdef1234abcdef')
      addressStr = await nftDescriptor.addressToString(`0x${'1'.repeat(40)}`)
      expect(addressStr).to.eq(`0x${'1'.repeat(40)}`)
    })
  })

  describe('#tickToDecimalString', () => {
    let tickSpacing: number
    let minTick: number
    let maxTick: number

    describe('when tickspacing is 10', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.LOW]
        minTick = getMinTick(tickSpacing)
        maxTick = getMaxTick(tickSpacing)
      })

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(1, tickSpacing, 18, 18, false)).to.equal('1.0001')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.HIGH])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })

    describe('when tickspacing is 60', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
        minTick = getMinTick(tickSpacing)
        maxTick = getMaxTick(tickSpacing)
      })

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(-1, tickSpacing, 18, 18, false)).to.equal('0.99990')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.HIGH])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })

    describe('when tickspacing is 200', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.HIGH]
        minTick = getMinTick(tickSpacing)
        maxTick = getMaxTick(tickSpacing)
      })

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(0, tickSpacing, 18, 18, false)).to.equal('1.0000')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })

    describe('when token ratio is flipped', () => {
      it('returns the inverse of default ratio for medium sized numbers', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH]
        expect(await nftDescriptor.tickToDecimalString(10, tickSpacing, 18, 18, false)).to.eq('1.0010')
        expect(await nftDescriptor.tickToDecimalString(10, tickSpacing, 18, 18, true)).to.eq('0.99900')
      })

      it('returns the inverse of default ratio for large numbers', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH]
        expect(await nftDescriptor.tickToDecimalString(487272, tickSpacing, 18, 18, false)).to.eq(
          '1448400000000000000000'
        )
        expect(await nftDescriptor.tickToDecimalString(487272, tickSpacing, 18, 18, true)).to.eq(
          '0.00000000000000000000069041'
        )
      })

      it('returns the inverse of default ratio for small numbers', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH]
        expect(await nftDescriptor.tickToDecimalString(-387272, tickSpacing, 18, 18, false)).to.eq(
          '0.000000000000000015200'
        )
        expect(await nftDescriptor.tickToDecimalString(-387272, tickSpacing, 18, 18, true)).to.eq('65791000000000000')
      })

      it('returns the correct string with differing token decimals', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH]
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 18, 18, true)).to.eq('0.90484')
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 18, 10, true)).to.eq('90484000')
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 10, 18, true)).to.eq('0.0000000090484')
      })
    })
  })

  describe('#fixedPointToDecimalString', () => {
    describe('returns the correct string for', () => {
      it('the highest possible price', async () => {
        const ratio = encodePriceSqrt(33849, 1 / 10 ** 34)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '338490000000000000000000000000000000000'
        )
      })

      it('large numbers', async () => {
        let ratio = encodePriceSqrt(25811, 1 / 10 ** 11)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('2581100000000000')
        ratio = encodePriceSqrt(17662, 1 / 10 ** 5)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1766200000')
      })

      it('exactly 5 sigfig whole number', async () => {
        const ratio = encodePriceSqrt(42026, 1)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('42026')
      })

      it('when the decimal is at index 4', async () => {
        const ratio = encodePriceSqrt(12087, 10)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1208.7')
      })

      it('when the decimal is at index 3', async () => {
        const ratio = encodePriceSqrt(12087, 100)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('120.87')
      })

      it('when the decimal is at index 2', async () => {
        const ratio = encodePriceSqrt(12087, 1000)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('12.087')
      })

      it('when the decimal is at index 1', async () => {
        const ratio = encodePriceSqrt(12345, 10000)
        const bla = await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1.2345')
      })

      it('when sigfigs have trailing 0s after the decimal', async () => {
        const ratio = encodePriceSqrt(1, 1)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1.0000')
      })

      it('when there are exactly 5 numbers after the decimal', async () => {
        const ratio = encodePriceSqrt(12345, 100000)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('0.12345')
      })

      it('very small numbers', async () => {
        let ratio = encodePriceSqrt(38741, 10 ** 20)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('0.00000000000000038741')
        ratio = encodePriceSqrt(88498, 10 ** 35)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '0.00000000000000000000000000000088498'
        )
      })

      it('smallest number', async () => {
        const ratio = encodePriceSqrt(39000, 10 ** 43)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })

    describe('when tokens have different decimal precision', () => {
      describe('when baseToken has more precision decimals than quoteToken', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 18, 16)).to.eq('100.00')
        })

        it('returns the correct string when the decimal difference is odd', async () => {
          const tenRatio = encodePriceSqrt(10, 1)
          expect(await nftDescriptor.fixedPointToDecimalString(tenRatio, 18, 17)).to.eq('100.00')
        })

        it('does not account for higher token0 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 24, 5)).to.eq('1.0000')
        })
      })

      describe('when quoteToken has more precision decimals than baseToken', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 10, 18)).to.eq('0.000000010000')
        })

        it('returns the correct string when the decimal difference is odd', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 7, 18)).to.eq('0.000000000010000')
        })

        // TODO: provide compatibility token prices that breach minimum price due to token decimal differences
        it.skip('returns the correct string when the decimal difference brings ratio below the minimum', async () => {
          const lowRatio = encodePriceSqrt(88498, 10 ** 35)
          expect(await nftDescriptor.fixedPointToDecimalString(lowRatio, 10, 20)).to.eq(
            '0.000000000000000000000000000000000000000088498'
          )
        })

        it('does not account for higher token1 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 24, 5)).to.eq('1.0000')
        })
      })

      it('some fuzz', async () => {
        const random = (min: number, max: number): number => {
          return Math.floor(min + ((Math.random() * 100) % (max + 1 - min)))
        }

        const inputs: [BigNumber, number, number][] = []
        let i = 0
        while (i <= 20) {
          const ratio = BigNumber.from(`0x${randomBytes(random(7, 20)).toString('hex')}`)
          const decimals0 = random(3, 21)
          const decimals1 = random(3, 21)
          const decimalDiff = Math.abs(decimals0 - decimals1)

          // TODO: Address edgecase out of bounds prices due to decimal differences
          if (
            ratio.div(TEN.pow(decimalDiff)).gt(LOWEST_SQRT_RATIO) &&
            ratio.mul(TEN.pow(decimalDiff)).lt(HIGHEST_SQRT_RATIO)
          ) {
            inputs.push([ratio, decimals0, decimals1])
            i++
          }
        }

        for (let i in inputs) {
          let ratio: BigNumber | number
          let decimals0: number
          let decimals1: number
          ;[ratio, decimals0, decimals1] = inputs[i]
          let result = await nftDescriptor.fixedPointToDecimalString(ratio, decimals0, decimals1)
          expect(formatSqrtRatioX96(ratio, decimals0, decimals1)).to.eq(result)
        }
      }).timeout(300_000)
    })
  })

  describe('#feeToPercentString', () => {
    it('returns the correct fee for 0', async () => {
      expect(await nftDescriptor.feeToPercentString(0)).to.eq('0%')
    })

    it('returns the correct fee for 1', async () => {
      expect(await nftDescriptor.feeToPercentString(1)).to.eq('0.0001%')
    })

    it('returns the correct fee for 30', async () => {
      expect(await nftDescriptor.feeToPercentString(30)).to.eq('0.003%')
    })

    it('returns the correct fee for 33', async () => {
      expect(await nftDescriptor.feeToPercentString(33)).to.eq('0.0033%')
    })

    it('returns the correct fee for 500', async () => {
      expect(await nftDescriptor.feeToPercentString(500)).to.eq('0.05%')
    })

    it('returns the correct fee for 2500', async () => {
      expect(await nftDescriptor.feeToPercentString(2500)).to.eq('0.25%')
    })

    it('returns the correct fee for 3000', async () => {
      expect(await nftDescriptor.feeToPercentString(3000)).to.eq('0.3%')
    })

    it('returns the correct fee for 10000', async () => {
      expect(await nftDescriptor.feeToPercentString(10000)).to.eq('1%')
    })

    it('returns the correct fee for 17000', async () => {
      expect(await nftDescriptor.feeToPercentString(17000)).to.eq('1.7%')
    })

    it('returns the correct fee for 100000', async () => {
      expect(await nftDescriptor.feeToPercentString(100000)).to.eq('10%')
    })

    it('returns the correct fee for 150000', async () => {
      expect(await nftDescriptor.feeToPercentString(150000)).to.eq('15%')
    })

    it('returns the correct fee for 102000', async () => {
      expect(await nftDescriptor.feeToPercentString(102000)).to.eq('10.2%')
    })

    it('returns the correct fee for 10000000', async () => {
      expect(await nftDescriptor.feeToPercentString(1000000)).to.eq('100%')
    })

    it('returns the correct fee for 1005000', async () => {
      expect(await nftDescriptor.feeToPercentString(1005000)).to.eq('100.5%')
    })

    it('returns the correct fee for 10000000', async () => {
      expect(await nftDescriptor.feeToPercentString(10000000)).to.eq('1000%')
    })

    it('returns the correct fee for 12300000', async () => {
      expect(await nftDescriptor.feeToPercentString(12300000)).to.eq('1230%')
    })
  })

  describe('#tokenToColorHex', () => {
    it('returns the correct hash for the first 3 bytes of the token address', async () => {
      expect(await nftDescriptor.tokenToColorHex(tokens[0].address, 136)).to.eq(tokenToColorHex(tokens[0].address, 2))
      expect(await nftDescriptor.tokenToColorHex(tokens[1].address, 136)).to.eq(tokenToColorHex(tokens[1].address, 2))
    })

    it('returns the correct hash for the last 3 bytes of the address', async () => {
      expect(await nftDescriptor.tokenToColorHex(tokens[0].address, 0)).to.eq(tokenToColorHex(tokens[0].address, 36))
      expect(await nftDescriptor.tokenToColorHex(tokens[1].address, 0)).to.eq(tokenToColorHex(tokens[1].address, 36))
    })
  })

  describe('#svgImage', () => {
    it('returns the svgImage', async () => {
      const tokenId = 123
      const tickLower = -1000
      const tickUpper = 2000
      const tickCurrent = 40
      const tickSpacing = 9
      const feeTier = '0.05%'
      const overRange = 0

      const svg = await nftDescriptor.svgImage(
        tokenId,
        "0x1234567890123456789123456789012345678901",
        "0xabcdeabcdefabcdefabcdefabcdefabcdefabcdf",
        "UNI",
        'WETH',
        feeTier,
        tickLower,
        tickUpper,
        tickCurrent
      )

      expect(svg).toMatchSnapshot()
      fs.writeFileSync('./test/__snapshots__/NFTDescriptor.svg', svg)
    })
  })

  function tokenToColorHex(tokenAddress: string, startIndex: number): string {
    return `${tokenAddress.slice(startIndex, startIndex + 6).toLowerCase()}`
  }

  async function encodedSvgImage(
    tokenId: number,
    feeTier: string,
    baseTokenAddress: string,
    quoteTokenAddress: string,
    baseTokenSymbol: string,
    quoteTokenSymbol: string,
    overRange: number,
    tickLower: number,
    tickUpper: number
  ): Promise<string> {
    let result = await `data:image/svg+xml;base64,${base64Encode(
      await svgImage(
        tokenId,
        feeTier,
        baseTokenAddress.toLowerCase(),
        quoteTokenAddress.toLowerCase(),
        baseTokenSymbol,
        quoteTokenSymbol,
        overRange,
        tickLower,
        tickUpper
      )
    )}`
    return result
  }

  async function tokenURI(
    tokenId: number,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    poolAddress: string,
    quoteTokenSymbol: string,
    baseTokenSymbol: string,
    flipRatio: boolean,
    tickLower: number,
    tickUpper: number,
    tickCurrent: number,
    feeTier: string,
    prices: string
  ): Promise<string> {
    const overRange = tickCurrent < tickLower ? -1 : tickCurrent > tickUpper ? 1 : 0
    quoteTokenSymbol = quoteTokenSymbol.replace(/"/gi, '\\"')
    baseTokenSymbol = baseTokenSymbol.replace(/"/gi, '\\"')
    return `data:application/json;base64,${base64Encode(`{"name":"Uniswap - ${feeTier} - ${quoteTokenSymbol}/${baseTokenSymbol} - ${prices}", \
"description":"This NFT represents a liquidity position in a Uniswap V3 ${quoteTokenSymbol}-${baseTokenSymbol} pool. The owner of this NFT can modify or redeem the position.\\n\
\\nPool Address: ${poolAddress}\\n${quoteTokenSymbol} Address: ${quoteTokenAddress.toLowerCase()}\\n${baseTokenSymbol} Address: ${baseTokenAddress.toLowerCase()}\\n\
Fee Tier: ${feeTier}\\nToken ID: ${tokenId}\\n\\n⚠️ DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as \
token symbols may be imitated.", "image": "${await encodedSvgImage(
      tokenId,
      feeTier,
      quoteTokenAddress,
      baseTokenAddress,
      quoteTokenSymbol,
      baseTokenSymbol,
      overRange,
      tickLower,
      tickUpper
    )}"}`)}`
  }

  async function svgImage(
    tokenId: number,
    feeTier: string,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteTokenSymbol: string,
    baseTokenSymbol: string,
    overRange: number,
    tickLower: number,
    tickUpper: number
  ): Promise<string> {
    const tokenToNum = (tokenAddr: string, index: number): number => {
      return parseInt(tokenAddr.slice(index, index + 2), 16)
    }
    const scale = (n: number, inMn: number, inMx: number, outMn: number, outMx: number): number => {
      return Math.floor(((n - inMn) * (outMx - outMn)) / (inMx - inMn) + outMn)
    }
    baseTokenAddress = baseTokenAddress.toLowerCase()
    quoteTokenAddress = quoteTokenAddress.toLowerCase()
    const fade = overRange === -1 ? '#fade-up' : overRange === 1 ? '#fade-down' : '#none'
    const curve = await nftDescriptor.getCurve(tickLower, tickUpper)
    const curveCircle = await nftDescriptor.generateSVGCurveCircle(overRange)
    const color0 = tokenToColorHex(quoteTokenAddress, 2)
    const color1 = tokenToColorHex(baseTokenAddress, 2)
    const color2 = tokenToColorHex(quoteTokenAddress, 36)
    const color3 = tokenToColorHex(baseTokenAddress, 36)
    const x1 = scale(tokenToNum(quoteTokenAddress, 36), 0, 255, 16, 274)
    const y1 = scale(tokenToNum(baseTokenAddress, 36), 0, 255, 100, 484)
    const x2 = scale(tokenToNum(quoteTokenAddress, 32), 0, 255, 16, 274)
    const y2 = scale(tokenToNum(baseTokenAddress, 32), 0, 255, 100, 484)
    const x3 = scale(tokenToNum(quoteTokenAddress, 28), 0, 255, 16, 274)
    const y3 = scale(tokenToNum(baseTokenAddress, 28), 0, 255, 100, 484)
    const str1length = 7 * (tokenId.toString().length + 4 + 4)
    const str2length = 7 * (tickLower.toString().length + 5 + 4)
    const str3length = 7 * (tickUpper.toString().length + 5 + 4)
    return `<svg width="290" height="500" viewBox="0 0 290 500" xmlns="http://www.w3.org/2000/svg" xmlns:xlink='http://www.w3.org/1999/xlink'><style>@import \
url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@200;400');</style><defs><!-- Background gradient --><filter id="f1"><feImage result="p0" \
xlink:href="data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='290px' hei\
ght='500px' fill='%23${color0}'/%3E%3C/svg%3E" /><feImage result="p1" xlink:href="data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 5\
00' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='${x1}' cy='${y1}' r='120px' fill='%23${color1}'/%3E%3C/svg%3E" /><feImage result="p2" xlink:href="data:ima\
ge/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='${x2}' cy='${y2}' r='120px' fill='%23\
${color2}'/%3E%3C/svg%3E" /><feImage result="p3" xlink:href="data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.\
w3.org/2000/svg'%3E%3Ccircle cx='${x3}' cy='${y3}' r='100px' fill='%23${color3}'/%3E%3C/svg%3E" /><feBlend mode="overlay" in="p0" in2="p1" /><feBlend mode="exclu\
sion" in2="p2" /><feBlend mode="overlay" in2="p3" result="blendOut" /><feGaussianBlur in="blendOut" stdDeviation="42" /></filter><!-- Clip path for gradien\
ts --> <clipPath id="corners"><rect width="290" height="500" rx="42" ry="42" /></clipPath><!-- Outer text animation path. Must be a path for chrome support\
. Can be generated with elementToPath above. --><path id="text-path-a" d="M40 12 H250 A28 28 0 0 1 278 40 V460 A28 28 0 0 1 250 488 H40 A28 28 0 0 1 12 460 \
V40 A28 28 0 0 1 40 12 z" /><!-- Minimap --><path id="minimap" d="M234 444C234 457.949 242.21 463 253 463" /><!-- Top dark region blur filter --><filter id\
="top-region-blur"><feGaussianBlur in="SourceGraphic" stdDeviation="24" /></filter><linearGradient id="grad-up" x1="1" x2="0" y1="1" y2="0"><stop offset="0\
.0" stop-color="white" stop-opacity="1" /><stop offset=".9" stop-color="white" stop-opacity="0" /></linearGradient><!-- Positive out of range --><linearGra\
dient id="grad-down" x1="0" x2="1" y1="0" y2="1"><stop offset="0.0" stop-color="white" stop-opacity="1" /><stop offset="0.9" stop-color="white" stop-opacity\
="0" /></linearGradient><mask id="fade-up" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#grad-up)" /></mask><mask id="fade-down\
" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#grad-down)" /></mask><mask id="none" maskContentUnits="objectBoundingBox"><rect \
width="1" height="1" fill="white" /></mask><!-- Symbol text overflow --><linearGradient id="grad-symbol"><stop offset="0.7" stop-color="white" stop-opacity=\
"1" /><stop offset=".95" stop-color="white" stop-opacity="0" /></linearGradient><mask id="fade-symbol" maskContentUnits="userSpaceOnUse"><rect width="290px" \
height="200px" fill="url(#grad-symbol)" /></mask></defs><g clip-path="url(#corners)"><!-- Background and border --><rect fill="${color0}" x="0px" y="0px" width\
="290px" height="500px" /><rect style="filter: url(#f1)" x="0px" y="0px" width="290px" height="500px" /><!-- Top dark area --> <g style="filter:url(#top-reg\
ion-blur); transform:scale(1.5); transform-origin:center top;"><rect fill="none" x="0px" y="0px" width="290px" height="500px" /><ellipse cx="50%" cy="0px\
" rx="180px" ry="120px" fill="#000" opacity="0.85" /></g></g><!-- Outerdata string --><text text-rendering="optimizeSpeed"><textPath startOffset="-100%" \
fill="white" font-family="'IBM Plex Mono', monospace" font-size="10px" xlink:href="#text-path-a">${baseTokenAddress} • ${baseTokenSymbol} <anim\
ate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="30s" repeatCount="indefinite" /></textPath> <textPath startOffset="0%\
" fill="white" font-family="'IBM Plex Mono', monospace" font-size="10px" xlink:href="#text-path-a">${baseTokenAddress} • ${baseTokenSymbol} <an\
imate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="30s" repeatCount="indefinite" /> </textPath><textPath startOffset="5\
0%" fill="white" font-family="'IBM Plex Mono', monospace" font-size="10px" xlink:href="#text-path-a">${quoteTokenAddress} • ${quoteTokenSymbol} <\
animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="30s" repeatCount="indefinite" /></textPath><textPath startOffset="\
-50%" fill="white" font-family="'IBM Plex Mono', monospace" font-size="10px" xlink:href="#text-path-a">${quoteTokenAddress} • ${quoteTokenSymbol} \
<animate additive="sum" attributeName="startOffset" from="0%" to="100%" begin="0s" dur="30s" repeatCount="indefinite" /></textPath></text><!-- Card ma\
ntle --><g mask="url(#fade-symbol)"><rect fill="none" x="0px" y="0px" width="290px" height="200px" /> <text y="70px" x="32px" fill="white" font-family=\
"'IBM Plex Mono', monospace" font-weight="200" font-size="36px">${quoteTokenSymbol}/${baseTokenSymbol}</text><text y="115px" x="32px" fill="white" font-family="'IBM Plex Mono', mo\
nospace" font-weight="200" font-size="36px">${feeTier}</text></g><!-- Translucent inner border --><rect x="16" y="16" width="258" height="468" rx="26" ry="26\
" fill="rgba(0,0,0,0)" stroke="rgba(255,255,255,0.2)" /><rect x="0" y="0" width="290" height="500" rx="42" ry="42" fill="rgba(0,0,0,0)" stroke="rgba(255\
,255,255,0.2)" /> <!-- Curve --> <g mask="url(${fade})" style="transform:translate(73px,189px)"><rect x="-16px" y="-16px" width="180px" height="180\
px" fill="none" /><path d="${curve}" stroke="rgba(0,0,0,0.3)" stroke-width="32px" fill="none" stroke-linecap="round" /></g><g mask="u\
rl(${fade})" style="transform:translate(73px,189px)"><rect x="-16px" y="-16px" width="180px" height="180px" fill="none" />\
<path d="${curve}" stroke="rgba(255,255,255,1)" fill="none" stroke-linecap="round" /></g>${curveCircle} <g style="transform:translate(29px, 384px)"><rect width="${str1length}px" height="26\
px" rx="8px" ry="8px" fill="rgba(0,0,0,0.6)" /><text x="12px" y="17px" font-family="'IBM Plex Mono', monospace" font-size="12px" fill="white"><tspan f\
ill="rgba(255,255,255,0.6)">ID: </tspan>${tokenId}</text></g> <g style="transform:translate(29px, 414px)"><rect width="${str2length}px" height="26px" rx="8px" ry=\
"8px" fill="rgba(0,0,0,0.6)" /><text x="12px" y="17px" font-family="'IBM Plex Mono', monospace" font-size="12px" fill="white"><tspan fill="rgba(255,255,\
255,0.6)">Min: </tspan>${tickLower}</text></g> <g style="transform:translate(29px, 444px)"><rect width="${str3length}px" height="26px" rx="8px" ry="8px" fill="rgba(0,0\
,0,0.6)" /><text x="12px" y="17px" font-family="'IBM Plex Mono', monospace" font-size="12px" fill="white"><tspan fill="rgba(255,255,255,0.6)">\
Max: </tspan>${tickUpper}</text></g></svg>`
  }
})
