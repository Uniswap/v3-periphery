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

const TEN = BigNumber.from(10)
const LOWEST_SQRT_RATIO = 4310618292
const HIGHEST_SQRT_RATIO = BigNumber.from(33849).mul(TEN.pow(34))

describe('NFTDescriptor', () => {
  const wallets = waffle.provider.getWallets()

  const nftDescriptorFixture: Fixture<{
    tokens: [TestERC20Metadata, TestERC20Metadata]
    nftDescriptor: NFTDescriptorTest
  }> = async (wallets, provider) => {
    const tokenFactory = await ethers.getContractFactory('TestERC20Metadata')
    const NFTDescriptorFactory = await ethers.getContractFactory('NFTDescriptorTest')
    const nftDescriptor = (await NFTDescriptorFactory.deploy()) as NFTDescriptorTest
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST1'), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2), 'Test ERC20', 'TEST2'),
    ])) as [TestERC20Metadata, TestERC20Metadata]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))
    return {
      nftDescriptor,
      tokens,
    }
  }

  let nftDescriptor: NFTDescriptorTest
  let tokens: [TestERC20Metadata, TestERC20Metadata]

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
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        tokenURI(
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          poolAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          flipRatio,
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
        baseTokenAddress,
        quoteTokenAddress,
        baseTokenSymbol,
        quoteTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        tokenURI(
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          poolAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          flipRatio,
          '0.3%',
          '0.99900<>1.0010'
        )
      )
    })

    it('returns valid JSON when token symbols contain quotes', async () => {
      quoteTokenSymbol = '"TES"T1"'
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
        tickSpacing,
        fee,
        poolAddress,
      })
      expect(uri).to.equal(
        tokenURI(
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          poolAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          flipRatio,
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
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickSpacing,
          fee,
          poolAddress,
        })
        expect(uri).to.equal(
          tokenURI(
            tokenId,
            baseTokenAddress,
            quoteTokenAddress,
            poolAddress,
            baseTokenSymbol,
            quoteTokenSymbol,
            flipRatio,
            '0.3%',
            '0.99900<>1.0010'
          )
        )
      })

      it('returns the valid JSON for min/max ticks', async () => {
        flipRatio = true

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
          tickSpacing,
          fee,
          poolAddress,
        })
        expect(uri).to.equal(
          tokenURI(
            tokenId,
            baseTokenAddress,
            quoteTokenAddress,
            poolAddress,
            baseTokenSymbol,
            quoteTokenSymbol,
            flipRatio,
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
    it('returns a string with a hash symbol and the first 3 bytes of the token', async () => {
      expect(await nftDescriptor.tokenToColorHex(tokens[0].address)).to.eq(tokenToColorHex(tokens[0].address))
      expect(await nftDescriptor.tokenToColorHex(tokens[1].address)).to.eq(tokenToColorHex(tokens[1].address))
    })
  })

  describe('#svgImage', () => {
    it('returns the svgImage', async () => {
      expect(await nftDescriptor.svgImage(tokens[0].address, tokens[1].address)).to.eq(
        svgImage(tokens[0].address, tokens[1].address)
      )
    })
  })

  function tokenToColorHex(tokenAddress: string): string {
    return `#${tokenAddress.slice(2, 8).toLowerCase()}`
  }

  function svgImage(quoteTokenAddress: string, baseTokenAddress: string): string {
    const quoteTokenColor = tokenToColorHex(quoteTokenAddress)
    const baseTokenColor = tokenToColorHex(baseTokenAddress)
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\
<circle cx="12" cy="12" r="12" fill=${quoteTokenColor} stroke="white"/><g clip-path=url(#beta-${quoteTokenColor})>\
<circle cx="12" cy="12" r="12" fill=${baseTokenColor} stroke="white"/></g><circle cx="12" cy="12" r="4" style=mix-blend-mode:\
overlay fill="white" /><circle cx="12" cy="12" r="8" style=mix-blend-mode:overlay fill="white" />\<defs><clipPath id=\
beta-${quoteTokenColor}><rect width=12 height="24" fill="white"/></clipPath></defs></svg>`
  }

  function encodedSvgImage(baseTokenAddress: string, quoteTokenAddress: string): string {
    return `data:image/svg+xml;base64,${base64Encode(svgImage(baseTokenAddress, quoteTokenAddress))}`
  }

  function tokenURI(
    tokenId: number,
    baseTokenAddress: string,
    quoteTokenAddress: string,
    poolAddress: string,
    baseTokenSymbol: string,
    quoteTokenSymbol: string,
    flipRatio: boolean,
    fee: string,
    prices: string
  ): string {
    baseTokenSymbol = baseTokenSymbol.replace(/"/gi, '\\"')
    quoteTokenSymbol = quoteTokenSymbol.replace(/"/gi, '\\"')
    return `data:application/json,{\
"name":"Uniswap - ${fee} - ${quoteTokenSymbol}/${baseTokenSymbol} - ${prices}", \
"description":"This NFT represents a liquidity position in a Uniswap V3 ${quoteTokenSymbol}-${baseTokenSymbol} pool. The owner of this NFT can modify or redeem the position.\\n\
\\nPool Address: ${poolAddress}\\n${quoteTokenSymbol} Address: ${quoteTokenAddress.toLowerCase()}\\n${baseTokenSymbol} Address: ${baseTokenAddress.toLowerCase()}\\n\
Fee Tier: ${fee}\\nToken ID: ${tokenId}\\n\\n⚠️ DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as \
token symbols may be imitated.", "image": "${encodedSvgImage(quoteTokenAddress, baseTokenAddress)}"}`
  }
})
