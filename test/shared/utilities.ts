import bn from 'bignumber.js'
import { BigNumber, BigNumberish, utils } from 'ethers'

export const MaxUint128 = BigNumber.from(2).pow(128).sub(1)

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing
export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  BigNumber.from(2)
    .pow(128)
    .sub(1)
    .div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1)

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  fee: number,
  bytecode: string
): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint24'],
    [token0, token1, fee]
  )
  const create2Inputs = [
    '0xff',
    factoryAddress,
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}

const ADDR_SIZE = 20
const FEE_SIZE = 3
const OFFSET = ADDR_SIZE + FEE_SIZE
const DATA_SIZE = OFFSET + ADDR_SIZE

export function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  let encoded = '0x'
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2)
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  return encoded.toLowerCase()
}

function decodeOne(tokenFeeToken: Buffer): [[string, string], number] {
  // reads the first 20 bytes for the token address
  const tokenABuf = tokenFeeToken.slice(0, ADDR_SIZE)
  const tokenA = utils.getAddress('0x' + tokenABuf.toString('hex'))

  // reads the next 2 bytes for the fee
  const feeBuf = tokenFeeToken.slice(ADDR_SIZE, OFFSET)
  const fee = feeBuf.readUIntBE(0, FEE_SIZE)

  // reads the next 20 bytes for the token address
  const tokenBBuf = tokenFeeToken.slice(OFFSET, DATA_SIZE)
  const tokenB = utils.getAddress('0x' + tokenBBuf.toString('hex'))

  return [[tokenA, tokenB], fee]
}

export function decodePath(path: string): [string[], number[]] {
  let data = Buffer.from(path.slice(2), 'hex')

  let tokens: string[] = []
  let fees: number[] = []
  let i = 0
  let finalToken: string = ''
  while (data.length >= DATA_SIZE) {
    const [[tokenA, tokenB], fee] = decodeOne(data)
    finalToken = tokenB
    tokens = [...tokens, tokenA]
    fees = [...fees, fee]
    data = data.slice((i + 1) * OFFSET)
    i += 1
  }
  tokens = [...tokens, finalToken]

  return [tokens, fees]
}
