import { ethers } from 'hardhat'
import { LiquidityAmountsTest } from '../typechain/LiquidityAmountsTest'

import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt } from './shared/utilities'

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
    it('gas', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1)
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      )
    })
  })
})
