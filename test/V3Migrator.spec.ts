import { Fixture } from 'ethereum-waffle'
import { constants, Contract } from 'ethers'
import { ethers, waffle } from 'hardhat'
import {
  IUniswapV2Pair,
  IUniswapV3Factory,
  MockTimeNonfungiblePositionManager,
  TestERC20,
  V3Migrator,
} from '../typechain'
import completeFixture from './shared/completeFixture'
import { v2FactoryFixture } from './shared/externalFixtures'

import { abi as PAIR_V2_ABI } from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { expect } from 'chai'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import snapshotGasCost from './shared/snapshotGasCost'

describe('V3Migrator', () => {
  const wallets = waffle.provider.getWallets()
  const wallet = wallets[0]

  const migratorFixture: Fixture<{
    factoryV2: Contract
    factoryV3: IUniswapV3Factory
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
    migrator: V3Migrator
  }> = async (wallets, provider) => {
    const { factory, tokens, nft } = await completeFixture(wallets, provider)

    const { factory: factoryV2 } = await v2FactoryFixture(wallets, provider)

    for (const token of tokens) {
      await token.approve(factoryV2.address, constants.MaxUint256)
    }

    // deploy the migrator
    const migrator = (await (await ethers.getContractFactory('V3Migrator')).deploy(
      factory.address,
      nft.address
    )) as V3Migrator

    return {
      factoryV2,
      factoryV3: factory,
      tokens,
      nft,
      migrator,
    }
  }

  let factoryV2: Contract
  let factoryV3: IUniswapV3Factory
  let tokens: [TestERC20, TestERC20, TestERC20]
  let migrator: V3Migrator
  let nft: MockTimeNonfungiblePositionManager
  let pair: IUniswapV2Pair

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ factoryV2, factoryV3, tokens, nft, migrator } = await loadFixture(migratorFixture))
  })

  describe('#migrate', () => {
    const expectedLiquidity = 10000 - 1000

    beforeEach('add V2 liquidity', async () => {
      await factoryV2.createPair(tokens[0].address, tokens[1].address)

      const pairAddress = await factoryV2.getPair(tokens[0].address, tokens[1].address)

      pair = new ethers.Contract(pairAddress, PAIR_V2_ABI, wallet) as IUniswapV2Pair

      await tokens[0].transfer(pair.address, 10000)
      await tokens[1].transfer(pair.address, 10000)

      await pair.mint(wallet.address)

      expect(await pair.balanceOf(wallet.address)).to.be.eq(expectedLiquidity)
    })

    it('fails if v3 pool is not initialized', async () => {
      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityV2: expectedLiquidity,
          fee: FeeAmount.MEDIUM,
          tickLower: -1,
          tickUpper: 1,
          amount0Max: expectedLiquidity,
          amount1Max: expectedLiquidity,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.reverted
    })

    it('works once v3 pool is initialized', async () => {
      await migrator.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityV2: expectedLiquidity,
        fee: FeeAmount.MEDIUM,
        tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
        tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
        amount0Max: expectedLiquidity,
        amount1Max: expectedLiquidity,
        recipient: wallet.address,
        deadline: 1,
      })

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(3004652)

      const poolAddress = await factoryV3.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
      expect(await tokens[0].balanceOf(poolAddress)).to.be.eq(9000)
      expect(await tokens[1].balanceOf(poolAddress)).to.be.eq(9000)
    })

    it('gas', async () => {
      await migrator.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await snapshotGasCost(
        migrator.migrate({
          pair: pair.address,
          liquidityV2: expectedLiquidity,
          fee: FeeAmount.MEDIUM,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          amount0Max: expectedLiquidity,
          amount1Max: expectedLiquidity,
          recipient: wallet.address,
          deadline: 1,
        })
      )
    })
  })
})
