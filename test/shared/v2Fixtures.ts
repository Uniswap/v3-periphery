import { BigNumber, Contract, Wallet } from 'ethers'
import { Fixture } from 'ethereum-waffle'
import completeFixture, { CompleteFixture } from './completeFixture'
import { ethers } from 'hardhat'

import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'

import { SwapRouterV2 } from '../../typechain'
import { v2FactoryFixture } from './externalFixtures'

interface V2Fixture extends Pick<CompleteFixture, 'nft'> {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  uniswapV2Factory: Contract
  swapRouterV2: SwapRouterV2
  pair: Contract
  WETHPair: Contract
}

async function deployContract<T extends Contract>(
  wallet: Wallet,
  name: string,
  args?: (BigNumber | string | number)[]
): Promise<T> {
  const factory = await ethers.getContractFactory(name)
  return (await factory.deploy(...(args ?? []))) as T
}

export const v2Fixture: Fixture<V2Fixture> = async (wallets, provider): Promise<V2Fixture> => {
  const { nft, tokens, weth9, factory: v3Factory } = await completeFixture(wallets, provider)
  const [wallet] = wallets
  // deploy tokens
  const tokenA = tokens[0]
  const tokenB = tokens[1]
  const WETH = weth9
  const WETHPartner = tokens[2]

  const { factory: uniswapV2Factory } = await v2FactoryFixture([wallet], provider)

  const swapRouterV2 = await deployContract<SwapRouterV2>(wallet, 'SwapRouterV2', [
    v3Factory.address,
    uniswapV2Factory.address,
    WETH.address,
  ])

  // initialize V2
  await uniswapV2Factory.createPair(tokenA.address, tokenB.address)
  const pairAddress = await uniswapV2Factory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, IUniswapV2Pair.abi, provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await uniswapV2Factory.createPair(WETH.address, WETHPartner.address)
  const WETHPairAddress = await uniswapV2Factory.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, IUniswapV2Pair.abi, provider).connect(wallet)

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    uniswapV2Factory,
    swapRouterV2,
    pair,
    WETHPair,
    nft,
  }
}
