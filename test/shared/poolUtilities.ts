import { BigNumber, BigNumberish, constants, Contract, ContractTransaction, utils, Wallet } from 'ethers'
import { TestUniswapV3Callee } from '../../typechain/TestUniswapV3Callee'
import { TestERC20 } from '../../typechain/TestERC20'
import { IUniswapV3Pool } from '../../typechain'
import { MockProvider } from 'ethereum-waffle'

interface SwapExact0For1TestCase {
  zeroForOne: true
  exactOut: false
  amount0: BigNumberish
  sqrtPriceLimit?: BigNumber
  increaseTime: number
}

interface SwapExact1For0TestCase {
  zeroForOne: false
  exactOut: false
  amount1: BigNumberish
  sqrtPriceLimit?: BigNumber
  increaseTime: number
}

interface Position {
  tickLower: number
  tickUpper: number
  liquidity: BigNumberish
}

export interface PoolTestCase {
  description: string
  feeAmount: number
  tickSpacing: number
  startingPrice: BigNumber
  positions: Position[]
  swapTests: SwapTestCase[]
}

export type SwapTestCase = SwapExact0For1TestCase | SwapExact1For0TestCase

export const MIN_SQRT_RATIO = BigNumber.from('4295128739')
export const MAX_SQRT_RATIO = BigNumber.from('1461446703485210103287273052203988822378723970342')

export type SwapFunction = (
  amount: BigNumberish,
  to: Wallet | string,
  sqrtPriceLimitX96?: BigNumberish
) => Promise<ContractTransaction>

export type MintFunction = (
  recipient: string,
  tickLower: BigNumberish,
  tickUpper: BigNumberish,
  liquidity: BigNumberish
) => Promise<ContractTransaction>

export interface PoolFunctions {
  swapExact0For1: SwapFunction
  swapExact1For0: SwapFunction
  mint: MintFunction
}

export function createPoolFunctions({
  swapTarget,
  token0,
  token1,
  pool,
}: {
  swapTarget: TestUniswapV3Callee
  token0: TestERC20
  token1: TestERC20
  pool: IUniswapV3Pool
}): PoolFunctions {
  async function swap(
    inputToken: Contract,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: Wallet | string,
    sqrtPriceLimitX96?: BigNumberish
  ): Promise<ContractTransaction> {
    const exactInput = amountOut === 0

    const method =
      inputToken === token0
        ? exactInput
          ? swapTarget.swapExact0For1
          : swapTarget.swap0ForExact1
        : exactInput
        ? swapTarget.swapExact1For0
        : swapTarget.swap1ForExact0

    if (typeof sqrtPriceLimitX96 === 'undefined') {
      if (inputToken === token0) {
        sqrtPriceLimitX96 = MIN_SQRT_RATIO.add(1)
      } else {
        sqrtPriceLimitX96 = MAX_SQRT_RATIO.sub(1)
      }
    }
    await inputToken.approve(swapTarget.address, constants.MaxUint256)

    const toAddress = typeof to === 'string' ? to : to.address

    return method(pool.address, exactInput ? amountIn : amountOut, toAddress, sqrtPriceLimitX96)
  }

  const swapExact0For1: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(token0, [amount, 0], to, sqrtPriceLimitX96)
  }

  const swapExact1For0: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(token1, [amount, 0], to, sqrtPriceLimitX96)
  }

  const mint: MintFunction = async (recipient, tickLower, tickUpper, liquidity) => {
    await token0.approve(swapTarget.address, constants.MaxUint256)
    await token1.approve(swapTarget.address, constants.MaxUint256)
    return swapTarget.mint(pool.address, recipient, tickLower, tickUpper, liquidity)
  }

  return {
    swapExact0For1,
    swapExact1For0,
    mint,
  }
}

export const getNearestTick = async (period: BigNumberish, pool: IUniswapV3Pool) => {
  const tickCumulatives = (await pool.observe([period, 0]))['tickCumulatives']
  const tickCumulativesDelta = tickCumulatives[1].sub(tickCumulatives[0])
  const tick = tickCumulativesDelta.div(period)

  // Always round tick to negative infinity
  return tick.lt(0) && !tickCumulativesDelta.mod(period).eq(0) ? tick.sub(1) : tick
}

export const createSwaps = async (
  swapTests: SwapTestCase[],
  provider: MockProvider,
  swapExact0For1: SwapFunction,
  swapExact1For0: SwapFunction
) => {
  for (const testCase of swapTests) {
    await provider.send('evm_increaseTime', [testCase.increaseTime])

    if (testCase.zeroForOne) {
      await swapExact0For1(testCase.amount0, constants.AddressZero.slice(0, -1) + '1', testCase.sqrtPriceLimit)
    } else {
      await swapExact1For0(testCase.amount1, constants.AddressZero.slice(0, -1) + '1', testCase.sqrtPriceLimit)
    }
  }
}

export const createPositions = async (positions: Position[], walletAddress: string, mint: MintFunction) => {
  for (const position of positions) {
    await mint(walletAddress, position.tickLower, position.tickUpper, position.liquidity)
  }
}
