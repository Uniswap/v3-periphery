import { ethers } from 'hardhat'
import { LiquidityFromAmountsTest } from '../typechain/LiquidityFromAmountsTest'

import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt } from './shared/utilities'

describe('LiquidityFromAmounts', async () => {
  let liquidityFromAmounts: LiquidityFromAmountsTest

  before('deploy test library', async () => {
    const liquidityFromAmountsTestFactory = await ethers.getContractFactory('LiquidityFromAmountsTest')
    liquidityFromAmounts = (await liquidityFromAmountsTestFactory.deploy()) as LiquidityFromAmountsTest
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
      const sqrtPriceAX96 = encodePriceSqrt(100, 110)
      const sqrtPriceBX96 = encodePriceSqrt(110, 100)
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      )
    })
  })
})
