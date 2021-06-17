import { artifacts } from 'hardhat'
import { Contract, Wallet } from 'ethers'
import { IUniswapV3Pool } from '../../typechain'

const POOL_ABI = artifacts.readArtifactSync('UniswapV3Pool').abi

export default function poolAtAddress(address: string, wallet: Wallet): IUniswapV3Pool {
  return new Contract(address, POOL_ABI, wallet) as IUniswapV3Pool
}
