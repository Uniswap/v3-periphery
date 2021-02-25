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

export const MIN_SQRT_RATIO = BigNumber.from('4295128739')
export const MAX_SQRT_RATIO = BigNumber.from('1461446703485210103287273052203988822378723970342')

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

const FEE_SIZE = 2
const ADDR_SIZE = 20
const LENGTH_SIZE = 1

export function encodeOne(token0: string, token1: string, fee: FeeAmount): string {
  // 20 byte encoding of token0
  let encoded = token0.slice(2)
  // 4 byte encoding of the fee
  encoded += Buffer.from(fee.toString(16).padStart(2 * FEE_SIZE, '0'), 'hex').toString('hex')
  // 20 byte encoding of token1
  encoded += token1.slice(2)
  // encode the final token
  encoded += token1.slice(2)

  return encoded
}

// 2 fees 3 tokens
export function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  if (path.length > 255) {
    throw new Error('path too long')
  }

  let encoded = ''
  for (let i = 0; i < fees.length; i++) {
    // this should never be hit
    if (fees[i] > 16 ** (2 * FEE_SIZE)) {
      throw new Error(`fee doesnt fit in ${2 * FEE_SIZE} bytes, consider growing your buffer`)
    }

    // 20 byte encoding of thet address
    encoded += path[i].slice(2)
    // 4 byte encoding of the fee
    encoded += Buffer.from(fees[i].toString(16).padStart(2 * FEE_SIZE, '0'), 'hex').toString('hex')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  // 1 byte encoding of the number of pairs we expect to see (equal to the number of fees)
  const length = Buffer.from([fees.length]).toString('hex')

  // num els + els flattened
  return '0x' + length + encoded
}

interface PoolAddress {
  token0: string
  token1: string
  fee: FeeAmount
}

export function decodePath(path: string): PoolAddress[] {
  const pathBytes = Buffer.from(path.slice(2), 'hex')
  const length = pathBytes[0]
  const data = pathBytes.slice(1)

  let decoded = []
  for (let i = 0; i < length; i++) {
    const res = decodeOne(data, (ADDR_SIZE + FEE_SIZE) * i)
    decoded.push(res)
  }

  return decoded
}

// 2 <token> <fee> <token> <fee> <token>
export function decodeOne(tokenFeeAndToken: Buffer, offset: number): PoolAddress {
  // reads the next 20 bytes for the token address
  let start = offset
  let end = offset + ADDR_SIZE
  const token0Buf = tokenFeeAndToken.slice(start, end)
  const token0 = utils.getAddress('0x' + token0Buf.toString('hex'))

  // reads the next 2 bytes for the fee
  start = end
  end = start + FEE_SIZE
  const feeBuf = tokenFeeAndToken.slice(start, end)
  const fee = feeBuf.readUIntBE(0, FEE_SIZE)

  // reads the next 20 bytes for the token address
  start = end
  end = start + ADDR_SIZE
  const token1Buf = tokenFeeAndToken.slice(start, end)
  const token1 = utils.getAddress('0x' + token1Buf.toString('hex'))

  return {
    token0,
    token1,
    fee,
  }
}

const NEXT_OFFSET = LENGTH_SIZE + ADDR_SIZE + FEE_SIZE
const POP_OFFSET = LENGTH_SIZE + ADDR_SIZE + FEE_SIZE + ADDR_SIZE

export function popFromPath(path: string): { popped: string; rest: string } {
  let pathBytes = Buffer.from(path.slice(2), 'hex')
  const length = pathBytes[0]

  // skip first byte because that's where the length is
  const popped = pathBytes.slice(1, POP_OFFSET)

  // decrement length
  const newLength = Buffer.from([length - 1])
  // todo: figure out how to do this inplace in solidity w/o recopying?
  const rest = Buffer.concat([newLength, pathBytes.slice(NEXT_OFFSET)])

  return {
    popped: '0x' + popped.toString('hex'),
    rest: '0x' + rest.toString('hex'),
  }
}
