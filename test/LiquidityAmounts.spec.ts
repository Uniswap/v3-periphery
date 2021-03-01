import { ethers } from 'hardhat'
import { LiquidityAmountsTest } from '../typechain/LiquidityAmountsTest'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'

import snapshotGasCost from './shared/snapshotGasCost'

describe('LiquidityAmounts', async () => {
  let liquidityFromAmounts: LiquidityAmountsTest

  before('deploy test library', async () => {
    const liquidityFromAmountsTestFactory = await ethers.getContractFactory('LiquidityAmountsTest')
    liquidityFromAmounts = (await liquidityFromAmountsTestFactory.deploy()) as LiquidityAmountsTest
  })

  describe('#getLiquidityForAmount0', () => {
    it('gas', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, 100))
    })
  })

  describe('#getLiquidityForAmount1', () => {
    it('gas', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, 100))
    })
  })

  describe('#getLiquidityForAmounts', () => {
    it('amounts for price inside', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      )
      expect(liquidity).to.eq(2148)
    })

    it('amounts for price below', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 100)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      )
      expect(liquidity).to.eq(1938)
    })

    it('amounts for price above', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      )
      expect(liquidity).to.eq(2097)
    })

    it('gas for price below', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 110)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      )
    })
    it('gas for price above', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      )
    })
    it('gas for price inside', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      )
    })
  })
})
