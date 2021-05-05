import { ethers,waffle } from 'hardhat'
import { BigNumber, constants, Contract, ContractTransaction } from 'ethers'
import { IWETH9, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, PairFlash, IUniswapV3Pool, TestERC20, TestERC20Metadata, IUniswapV3Factory } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'

import { expect } from './shared/expect'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'


describe('PairFlash test', () => {
    const provider = waffle.provider
    const wallets = waffle.provider.getWallets()
    const [wallet, trader] = wallets
    
    
    //let pools: [IUniswapV3Pool, IUniswapV3Pool, IUniswapV3Pool]
    let flash: PairFlash
    let nft: MockTimeNonfungiblePositionManager
    let token0: TestERC20
    let token1: TestERC20
    let factory: Contract
    let weth9: IWETH9
    

  async function createPool(tokenAddressA: string, tokenAddressB: string, fee: FeeAmount) {
    if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
      [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

    await nft.createAndInitializePoolIfNecessary(
      tokenAddressA,
      tokenAddressB,
      fee,
      encodePriceSqrt(1, 1)
    )

    const liquidityParams = {
      token0: tokenAddressA,
      token1: tokenAddressB,
      fee: fee,
      tickLower: getMinTick(TICK_SPACINGS[fee]),
      tickUpper: getMaxTick(TICK_SPACINGS[fee]),
      recipient: wallet.address,
      amount0Desired: 1000000,
      amount1Desired: 1000000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 1,
    }

    return nft.mint(liquidityParams)
  }

  const flashFixture = async() => {

    
    const {router, tokens, factory, weth9, nft} = await completeFixture(wallets, provider)
    const token0 = tokens[0]
    const token1 = tokens[1]
    
    const flashContractFactory = await ethers.getContractFactory('PairFlash')
    const flash = await flashContractFactory.deploy(router.address, factory.address, weth9.address ) as PairFlash


    return {
      token0,
      token1,
      flash: flash as PairFlash,
      factory,
      weth9,
      nft,
    }
  }

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ weth9, factory, token0, token1, flash, nft } = await loadFixture(flashFixture))
    console.log("hello world")
    console.log(token0.address<token1.address)
    await createPool(token0.address, token1.address, FeeAmount.LOW)
    await createPool(token0.address, token1.address, FeeAmount.MEDIUM)
    await createPool(token0.address, token1.address, FeeAmount.HIGH)
  })

//   beforeEach('load fixture', async () => {

//     const fixtures = await loadFixture(flashFixture)
//     token0 = fixtures['token0']
//     token1 = fixtures['token1']
//     flash = fixtures['flash']
//     factory = fixtures['factory']
//     weth9 = fixtures['weth9']
    
//    })

    describe.only('flash', () => {
      
        it('test correct transfer events', async () => {
            const flashParams = {
                token0: token0.address,
                token1: token1.address,
                fee: FeeAmount.LOW,
                amount0: 100,
                amount1: 100,
                fee1: FeeAmount.MEDIUM,
                fee2: FeeAmount.HIGH,
            }
            const pool1 = computePoolAddress(factory.address, [token0.address, token1.address], FeeAmount.LOW)
            const pool2  = computePoolAddress(factory.address, [token0.address, token1.address], FeeAmount.MEDIUM)
            const pool3  = computePoolAddress(factory.address, [token0.address, token1.address], FeeAmount.HIGH)
            
          await expect(
            flash.initFlash(flashParams)
          ).to.emit(token0, 'Transfer').withArgs(pool1, flash.address, 100).
          to.emit(token1, 'Transfer').withArgs(pool1, flash.address,100)
          }
        )

         })
    })
