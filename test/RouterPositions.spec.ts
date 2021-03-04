import { constants, Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { MockTimeRouterPositions, WETH9, WETH10, TestERC20 } from '../typechain'
import { computePoolAddress } from './shared/computePoolAddress'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { v3CoreFactoryFixture } from './shared/fixtures'
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

describe('RouterPositions', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const positionsFixture: Fixture<{
    positions: MockTimeRouterPositions
    v3CoreFactory: Contract
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { factory: v3CoreFactory } = await v3CoreFactoryFixture(wallets, provider)

    const weth9Factory = await ethers.getContractFactory('WETH9')
    const weth9 = (await weth9Factory.deploy()) as WETH9

    const weth10Factory = await ethers.getContractFactory('WETH10')
    const weth10 = (await weth10Factory.deploy()) as WETH10

    const positionsFactory = await ethers.getContractFactory('MockTimeRouterPositions')
    const positions = (await positionsFactory.deploy(
      v3CoreFactory.address,
      weth9.address,
      weth10.address
    )) as MockTimeRouterPositions

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20, TestERC20]

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(positions.address, constants.MaxUint256)
      await token.connect(other).approve(positions.address, constants.MaxUint256)
      await token.transfer(other.address, expandTo18Decimals(1_000_000))
    }

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      positions,
      v3CoreFactory,
      tokens,
    }
  }

  let v3CoreFactory: Contract
  let positions: MockTimeRouterPositions
  let tokens: [TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ positions, v3CoreFactory, tokens } = await loadFixture(positionsFixture))
  })

  it('bytecode size', async () => {
    expect(((await positions.provider.getCode(positions.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#createPoolAndAddLiquidity', () => {
    it('creates a pool at expected address', async () => {
      const expectedAddress = computePoolAddress(
        v3CoreFactory.address,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.eq('0x')
      await positions.createPoolAndAddLiquidity({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      const codeAfter = await wallet.provider.getCode(expectedAddress)
      expect(codeAfter).to.not.eq('0x')
    })

    it('fails if pool already exists', async () => {
      const params = {
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      }
      await positions.createPoolAndAddLiquidity(params)

      await expect(positions.createPoolAndAddLiquidity(params)).to.be.reverted
    })

    it('cannot take tokens in opposite order', async () => {
      await expect(
        positions.createPoolAndAddLiquidity({
          token1: tokens[0].address,
          token0: tokens[1].address,
          sqrtPriceX96: encodePriceSqrt(1, 1),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.revertedWith('Token order')
    })

    it('deploys pool with expected parameters', async () => {
      await positions.createPoolAndAddLiquidity({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      const poolAddress = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
      expect(poolAddress).to.not.eq(constants.AddressZero)
      const pool = poolAtAddress(poolAddress, wallet)
      const { sqrtPriceX96, tick } = await pool.slot0()
      expect(sqrtPriceX96).to.eq(encodePriceSqrt(1, 1))
      expect(tick).to.eq(0)
    })

    it('fails if deadline is in past')

    it('gas', async () => {
      await snapshotGasCost(
        positions.createPoolAndAddLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          sqrtPriceX96: encodePriceSqrt(1, 1),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      )
    })
  })

  describe('#addLiquidity', () => {
    it('reverts if pool does not exist', async () => {
      await expect(
        positions.addLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
        })
      ).to.be.reverted
    })

    describe('pool exists', () => {
      const startingPrice = encodePriceSqrt(1, 1)
      beforeEach('create the pool directly', async () => {
        await v3CoreFactory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        const poolAddress = await v3CoreFactory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
        await poolAtAddress(poolAddress, wallet).initialize(startingPrice)
      })

      it('allows adding liquidity', async () => {
        await positions.addLiquidity({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
        })
      })

      it('fails if deadline is in past')

      it('gas', async () => {
        await snapshotGasCost(
          positions.addLiquidity({
            token0: tokens[0].address,
            token1: tokens[1].address,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            recipient: wallet.address,
            amount: 10,
            deadline: 1,
            fee: FeeAmount.MEDIUM,
            amount0Max: constants.MaxUint256,
            amount1Max: constants.MaxUint256,
          })
        )
      })
    })
  })
})
