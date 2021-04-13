import  { BigNumber } from 'ethers'
import Decimal from 'decimal.js'

const TWO = BigNumber.from(2)
const TEN = BigNumber.from(10)
const FIVE_SIG_FIGS_POW = new Decimal(10).pow(5)

export function formatSqrtRatioX96(
  sqrtRatioX96: BigNumber,
  decimalsToken0: number = 18,
  decimalsToken1: number = 18
): string {
  Decimal.set({ precision: 5, toExpPos: 9_999_999, toExpNeg: -9_999_999, rounding: Decimal.ROUND_HALF_EVEN })

  let ratio
  let ratioNum
  let ratioBN = sqrtRatioX96.mul(sqrtRatioX96).div(TWO.pow(64))
  if (sqrtRatioX96.lt(TWO.pow(96))) {
    // accurate calculation in BigNumber
    ratioBN = ratioBN.mul(TEN.pow(44)).div(TWO.pow(128))
    // accurate precision api with vanilla js numbers
    ratioNum = parseInt(ratioBN.toString()).toPrecision(5)
    // then turn into decimal
    ratio = new Decimal(ratioNum.toString()).div(new Decimal(10).pow(44))
  } else {
    ratioBN = ratioBN.mul(TEN.pow(5)).div(TWO.pow(128))
    ratioNum = parseInt(ratioBN.toString()).toPrecision(5)
    ratio = new Decimal(ratioNum.toString()).div(new Decimal(10).pow(5))
  }

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
