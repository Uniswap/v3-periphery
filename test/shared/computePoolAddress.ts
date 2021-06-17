import { getPoolBytecode } from './setup'
import { utils } from 'ethers'

export async function POOL_BYTECODE_HASH() {
  const bytecode = await getPoolBytecode()
  return utils.keccak256(bytecode)
}

export async function computePoolAddress(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  fee: number
): Promise<string> {
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
    // init code hash
    await POOL_BYTECODE_HASH(),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}
