import { BigNumber } from 'ethers'
import Decimal from 'decimal.js'

const TEN = BigNumber.from(10)
const FIVE_SIG_FIGS_POW = new Decimal(10).pow(5)

export default function formatSqrtRatioX96(
  sqrtRatioX96: BigNumber,
  decimalsToken0: number = 18,
  decimalsToken1: number = 18
): string {
  Decimal.set({ precision: 5, toExpPos: 9_999_999, toExpNeg: -9_999_999, rounding: Decimal.ROUND_HALF_CEIL })

  const decRatio = new Decimal(sqrtRatioX96.toString())

  let ratio = decRatio.div(new Decimal(2).pow(96)).pow(2)

  // adjust for decimals
  if (decimalsToken1 < decimalsToken0) {
    ratio = ratio.mul(TEN.pow(decimalsToken0 - decimalsToken1).toString())
  } else if (decimalsToken0 < decimalsToken1) {
    ratio = ratio.div(TEN.pow(decimalsToken1 - decimalsToken0).toString())
  }

  if (ratio.lessThan(FIVE_SIG_FIGS_POW)) {
    return ratio.toPrecision(5)
  }

  return ratio.toString()
}
