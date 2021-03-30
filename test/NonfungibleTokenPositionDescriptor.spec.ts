import { BigNumber, constants, Contract } from 'ethers'
import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { Decimal } from 'decimal.js'
import { waffle, ethers } from 'hardhat'
import { expect } from './shared/expect'
import { TestERC20, NFTDescriptorTest } from '../typechain'
import { Fixture } from 'ethereum-waffle'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'

Decimal.set({ precision: 5, rounding: Decimal.ROUND_FLOOR })

describe('NonfungiblePositionManager', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const nftDescriptorFixture: Fixture<{
    tokens: [TestERC20, TestERC20]
    nftDescriptor: NFTDescriptorTest
  }> = async (wallets, provider) => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const NFTDescriptorFactory = await ethers.getContractFactory('NFTDescriptorTest')
    const nftDescriptor = (await NFTDescriptorFactory.deploy()) as NFTDescriptorTest
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))
    return {
      nftDescriptor,
      tokens,
    }
  }

  let nftDescriptor: NFTDescriptorTest
  let tokens: [TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ nftDescriptor, tokens } = await loadFixture(nftDescriptorFixture))
  })

  describe('constructTokenURI', () => {
    it('returns the valid JSON string with min and max ticks', async () => {
      let token0 = tokens[0].address
      let token1 = tokens[1].address
      let token0Symbol = await tokens[0].symbol()
      let token1Symbol = await tokens[1].symbol()
      let token0Decimals = await tokens[0].decimals()
      let token1Decimals = await tokens[1].decimals()
      let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      let tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
      let fee = 3000
      let liquidity = 123456
      let poolAddress = `0x${'b'.repeat(40)}`

      let uri = await nftDescriptor.constructTokenURI({
        token0,
        token1,
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals,
        tickLower,
        tickUpper,
        tickSpacing,
        fee,
        liquidity,
        poolAddress,
      })
      expect(uri).to.equal(
        `data:application/json,{\
"name":"Uniswap V3 - 0.3% - ${token0Symbol}/${token1Symbol} - MIN<>MAX", \
"description":"Represents a liquidity position in a Uniswap V3 pool. Redeemable for owed reserve tokens.\
\\nliquidity: ${liquidity}\\npoolAddress: ${poolAddress}\\ntoken0Address: ${token0.toLowerCase()}\\ntoken1Address: ${token1.toLowerCase()}"}`
      )
    })

    it('returns the valid JSON string with mid ticks', async () => {
      let token0 = tokens[0].address
      let token1 = tokens[1].address
      let token0Symbol = await tokens[0].symbol()
      let token1Symbol = await tokens[1].symbol()
      let token0Decimals = await tokens[0].decimals()
      let token1Decimals = await tokens[1].decimals()
      let tickLower = -10
      let tickUpper = 10
      let tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
      let fee = 3000
      let liquidity = 123456789
      let poolAddress = `0x${'b'.repeat(40)}`

      let uri = await nftDescriptor.constructTokenURI({
        token0,
        token1,
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals,
        tickLower,
        tickUpper,
        tickSpacing,
        fee,
        liquidity,
        poolAddress,
      })
      expect(uri).to.equal(
        `data:application/json,{\
"name":"Uniswap V3 - 0.3% - ${token0Symbol}/${token1Symbol} - 0.99900<>1.0010", \
"description":"Represents a liquidity position in a Uniswap V3 pool. Redeemable for owed reserve tokens.\
\\nliquidity: ${liquidity}\\npoolAddress: ${poolAddress}\\ntoken0Address: ${token0.toLowerCase()}\\ntoken1Address: ${token1.toLowerCase()}"}`
      )
    })
  })

  describe('addressToString', () => {
    it('returns the correct string for a given address', async () => {
      let addressStr = await nftDescriptor.addressToString(`0x${'1234abcdef'.repeat(4)}`)
      expect(addressStr).to.eq('0x1234abcdef1234abcdef1234abcdef1234abcdef')
      addressStr = await nftDescriptor.addressToString(`0x${'1'.repeat(40)}`)
      expect(addressStr).to.eq(`0x${'1'.repeat(40)}`)
    })
  })

  describe('tickToDecimalString', () => {
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
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(1, tickSpacing, 18, 18)).to.equal('1.0001')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        let otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.HIGH])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18)).to.equal(
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
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(-1, tickSpacing, 18, 18)).to.equal('0.99990')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        let otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.HIGH])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18)).to.equal(
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
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18)).to.equal('MIN')
      })

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18)).to.equal('MAX')
      })

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(0, tickSpacing, 18, 18)).to.equal('1.0000')
      })

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        let otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })
  })

  describe('fixedPointToDecimalString', () => {
    describe('returns the correct string for', () => {
      it('the highest possible price', async () => {
        let ratio = encodePriceSqrt(33849, 1 / 10 ** 34)
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
        let ratio = encodePriceSqrt(42026, 1)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('42026')
      })

      it('when the decimal is at index 4', async () => {
        let ratio = encodePriceSqrt(12087, 10)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1208.7')
      })

      it('when the decimal is at index 3', async () => {
        let ratio = encodePriceSqrt(12087, 100)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('120.87')
      })

      it('when the decimal is at index 2', async () => {
        let ratio = encodePriceSqrt(12087, 1000)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('12.087')
      })

      it('when the decimal is at index 1', async () => {
        let ratio = encodePriceSqrt(12345, 10000)
        let bla = await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1.2345')
      })

      it('when sigfigs have trailing 0s after the decimal', async () => {
        let ratio = encodePriceSqrt(1, 1)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1.0000')
      })

      it('when there are exactly 5 numbers after the decimal', async () => {
        let ratio = encodePriceSqrt(12345, 100000)
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
        let ratio = encodePriceSqrt(39000, 10 ** 43)
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '0.0000000000000000000000000000000000000029387'
        )
      })
    })

    describe('when tokens have different decimal precision', () => {
      let ratio: BigNumber
      before(() => {
        ratio = encodePriceSqrt(1, 1)
      })

      describe('when token0 has more precision decimals than token1', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 16)).to.eq('100.00')
        })

        it('returns the correct string when the decimal difference is odd', async () => {
          let tenRatio = encodePriceSqrt(10, 1)
          expect(await nftDescriptor.fixedPointToDecimalString(tenRatio, 18, 17)).to.eq('100.00')
        })

        it('does not account for higher token0 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(ratio, 24, 5)).to.eq('1.0000')
        })
      })

      describe('when token1 has more precision decimals than token0', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(ratio, 10, 18)).to.eq('0.000000010000')
        })

        it('returns the correct string when the decimal difference is odd', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(ratio, 7, 18)).to.eq('0.0000000010000')
        })

        // TODO: provide compatibility token prices that breach minimum price due to token decimal differences
        it.skip('returns the correct string when the decimal difference brings ratio below the minimum', async () => {
          let lowRatio = encodePriceSqrt(88498, 10 ** 35)
          expect(await nftDescriptor.fixedPointToDecimalString(lowRatio, 10, 20)).to.eq(
            '0.000000000000000000000000000000000000000088498'
          )
        })

        it('does not account for higher token1 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(ratio, 24, 5)).to.eq('1.0000')
        })
      })
    })
  })

  describe('feeToPercentString', () => {
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
})
