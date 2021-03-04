import { BigNumberish, constants, Contract } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import { MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain'
import { computePoolAddress } from './shared/computePoolAddress'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { v3RouterFixture } from './shared/fixtures'
import getPermitNFTSignature from './shared/getPermitNFTSignature'
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

describe('NonfungiblePositionManager', () => {
  const wallets = waffle.provider.getWallets()
  const [wallet, other] = wallets

  const nonfungiblePositionManagerFixture: Fixture<{
    positionManager: MockTimeNonfungiblePositionManager
    factory: Contract
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async (wallets, provider) => {
    const { weth9, weth10, factory } = await v3RouterFixture(wallets, provider)

    const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor')
    const positionDescriptor = await positionDescriptorFactory.deploy()

    const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager', {
      libraries: {
        NonfungibleTokenPositionDescriptor: positionDescriptor.address,
      },
    })
    const positionManager = (await positionManagerFactory.deploy(
      factory.address,
      weth9.address,
      weth10.address
    )) as MockTimeNonfungiblePositionManager

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20, TestERC20]

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(positionManager.address, constants.MaxUint256)
      await token.connect(other).approve(positionManager.address, constants.MaxUint256)
      await token.transfer(other.address, expandTo18Decimals(1_000_000))
    }

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      positionManager,
      factory,
      tokens,
    }
  }

  let factory: Contract
  let positionManager: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ positionManager, factory, tokens } = await loadFixture(nonfungiblePositionManagerFixture))
  })

  it('bytecode size', async () => {
    expect(((await positionManager.provider.getCode(positionManager.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#firstMint', () => {
    it('creates the pair at the expected address', async () => {
      const expectedAddress = computePoolAddress(
        factory.address,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.eq('0x')
      await positionManager.firstMint({
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

    it('creates a token', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
      expect(await positionManager.balanceOf(other.address)).to.eq(1)
      expect(await positionManager.tokenOfOwnerByIndex(other.address, 0)).to.eq(1)
      const {
        fee,
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await positionManager.positions(1)
      expect(token0).to.eq(tokens[0].address)
      expect(token1).to.eq(tokens[1].address)
      expect(fee).to.eq(FeeAmount.MEDIUM)
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(liquidity).to.eq(10)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
      expect(feeGrowthInside0LastX128).to.eq(0)
      expect(feeGrowthInside1LastX128).to.eq(0)
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
      await positionManager.firstMint(params)

      await expect(positionManager.firstMint(params)).to.be.reverted
    })

    it('gas', async () => {
      await snapshotGasCost(
        positionManager.firstMint({
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

  describe('#mint', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        positionManager.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
          recipient: wallet.address,
          amount: 10,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.reverted
    })

    it('creates a token', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await positionManager.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Max: constants.MaxUint256,
        amount1Max: constants.MaxUint256,
        amount: 15,
        deadline: 10,
        fee: FeeAmount.MEDIUM,
      })
      expect(await positionManager.balanceOf(other.address)).to.eq(2)
      expect(await positionManager.tokenOfOwnerByIndex(other.address, 1)).to.eq(2)
      const {
        fee,
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await positionManager.positions(2)
      expect(token0).to.eq(tokens[0].address)
      expect(token1).to.eq(tokens[1].address)
      expect(fee).to.eq(FeeAmount.MEDIUM)
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(liquidity).to.eq(15)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
      expect(feeGrowthInside0LastX128).to.eq(0)
      expect(feeGrowthInside1LastX128).to.eq(0)
    })

    it('gas ticks already used', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await snapshotGasCost(
        positionManager.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
          amount: 15,
          deadline: 10,
          fee: FeeAmount.MEDIUM,
        })
      )
    })

    it('gas first mint for ticks', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 10,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })

      await snapshotGasCost(
        positionManager.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - TICK_SPACINGS[FeeAmount.MEDIUM],
          recipient: other.address,
          amount0Max: constants.MaxUint256,
          amount1Max: constants.MaxUint256,
          amount: 15,
          deadline: 10,
          fee: FeeAmount.MEDIUM,
        })
      )
    })
  })

  describe('#increaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('increases position liquidity', async () => {
      await positionManager.increaseLiquidity(tokenId, 150, constants.MaxUint256, constants.MaxUint256, 1)
      const { liquidity } = await positionManager.positions(tokenId)
      expect(liquidity).to.eq(250)
    })

    it('gas', async () => {
      await snapshotGasCost(
        positionManager.increaseLiquidity(tokenId, 150, constants.MaxUint256, constants.MaxUint256, 1)
      )
    })
  })

  describe('#decreaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('fails if past deadline')

    it('cannot be called by other addresses', async () => {
      await expect(positionManager.decreaseLiquidity(tokenId, 50, 0, 0, 1)).to.be.revertedWith('Not approved')
    })

    it('decreases position liquidity', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 25, 0, 0, 1)
      const { liquidity } = await positionManager.positions(tokenId)
      expect(liquidity).to.eq(75)
    })

    it('accounts for tokens owed', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 25, 0, 0, 1)
      const { tokensOwed0, tokensOwed1 } = await positionManager.positions(tokenId)
      expect(tokensOwed0).to.eq(24)
      expect(tokensOwed1).to.eq(24)
    })

    it('gas partial decrease', async () => {
      await snapshotGasCost(positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1))
    })

    it('gas complete decrease', async () => {
      await snapshotGasCost(positionManager.connect(other).decreaseLiquidity(tokenId, 100, 0, 0, 1))
    })
  })

  describe('#collect', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('cannot be called by other addresses', async () => {
      await expect(positionManager.collect(tokenId, wallet.address, MaxUint128, MaxUint128)).to.be.revertedWith(
        'Not approved'
      )
    })

    it('cannot be called with 0 amounts', async () => {
      await expect(positionManager.connect(other).collect(tokenId, wallet.address, 0, 0)).to.be.reverted
    })

    it('no op if no tokens are owed', async () => {
      await expect(positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, MaxUint128))
        .to.not.emit(tokens[0], 'Transfer')
        .to.not.emit(tokens[1], 'Transfer')
    })

    it('transfers tokens owed from burn', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1)
      const poolAddress = computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM)
      await expect(positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, MaxUint128))
        .to.emit(tokens[0], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49)
        .to.emit(tokens[1], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49)
    })

    it('gas transfers both', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1)
      await snapshotGasCost(positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, MaxUint128))
    })

    it('gas transfers token0 only', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1)
      await snapshotGasCost(positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, 0))
    })

    it('gas transfers token1 only', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1)
      await snapshotGasCost(positionManager.connect(other).collect(tokenId, wallet.address, 0, MaxUint128))
    })
  })

  describe('#burn', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('cannot be called by other addresses', async () => {
      await expect(positionManager.burn(tokenId)).to.be.revertedWith('Not approved')
    })

    it('cannot be called while there is still liquidity', async () => {
      await expect(positionManager.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('cannot be called while there is still partial liquidity', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 50, 0, 0, 1)
      await expect(positionManager.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('cannot be called while there is still tokens owed', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 100, 0, 0, 1)
      await expect(positionManager.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('deletes the token', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 100, 0, 0, 1)
      await positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, MaxUint128)
      await positionManager.connect(other).burn(tokenId)
      const { liquidity, token0, token1, fee, tokensOwed0, tokensOwed1 } = await positionManager.positions(tokenId)
      expect(token0).to.eq(constants.AddressZero)
      expect(token1).to.eq(constants.AddressZero)
      expect(fee).to.eq(fee)
      expect(liquidity).to.eq(0)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
    })

    it('gas', async () => {
      await positionManager.connect(other).decreaseLiquidity(tokenId, 100, 0, 0, 1)
      await positionManager.connect(other).collect(tokenId, wallet.address, MaxUint128, MaxUint128)
      await snapshotGasCost(positionManager.connect(other).burn(tokenId))
    })
  })

  describe('#transferFrom', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('can only be called by authorized or owner', async () => {
      await expect(positionManager.transferFrom(other.address, wallet.address, tokenId)).to.be.revertedWith(
        'ERC721: transfer caller is not owner nor approved'
      )
    })

    it('changes the owner', async () => {
      await positionManager.connect(other).transferFrom(other.address, wallet.address, tokenId)
      expect(await positionManager.ownerOf(tokenId)).to.eq(wallet.address)
    })

    it('removes existing approval', async () => {
      await positionManager.connect(other).approve(wallet.address, tokenId)
      expect(await positionManager.getApproved(tokenId)).to.eq(wallet.address)
      await positionManager.transferFrom(other.address, wallet.address, tokenId)
      expect(await positionManager.getApproved(tokenId)).to.eq(constants.AddressZero)
    })

    it('gas', async () => {
      await snapshotGasCost(positionManager.connect(other).transferFrom(other.address, wallet.address, tokenId))
    })

    it('gas comes from approved', async () => {
      await positionManager.connect(other).approve(wallet.address, tokenId)
      await snapshotGasCost(positionManager.transferFrom(other.address, wallet.address, tokenId))
    })
  })

  describe('#permit', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('changes the operator of the position and increments the nonce', async () => {
      const { v, r, s } = await getPermitNFTSignature(other, positionManager, wallet.address, tokenId, 1)
      await positionManager.permit(wallet.address, tokenId, 1, v, r, s)
      expect((await positionManager.positions(tokenId)).nonce).to.eq(1)
      expect((await positionManager.positions(tokenId)).operator).to.eq(wallet.address)
    })

    it('fails with signature not from owner', async () => {
      const { v, r, s } = await getPermitNFTSignature(wallet, positionManager, wallet.address, tokenId, 1)
      await expect(positionManager.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Invalid signature')
    })

    it('fails with expired signature', async () => {
      await positionManager.setTime(2)
      const { v, r, s } = await getPermitNFTSignature(other, positionManager, wallet.address, tokenId, 1)
      await expect(positionManager.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith(
        'Transaction too old'
      )
    })

    it('gas', async () => {
      const { v, r, s } = await getPermitNFTSignature(other, positionManager, wallet.address, tokenId, 1)
      await snapshotGasCost(positionManager.permit(wallet.address, tokenId, 1, v, r, s))
    })
  })

  describe('multicall exit', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    async function exit({
      positionManager,
      liquidity,
      tokenId,
      amount0Min,
      amount1Min,
      recipient,
    }: {
      positionManager: MockTimeNonfungiblePositionManager
      tokenId: BigNumberish
      liquidity: BigNumberish
      amount0Min: BigNumberish
      amount1Min: BigNumberish
      recipient: string
    }) {
      const decreaseLiquidityData = positionManager.interface.encodeFunctionData('decreaseLiquidity', [
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        /*deadline=*/ 1,
      ])
      const collectData = positionManager.interface.encodeFunctionData('collect', [
        tokenId,
        recipient,
        MaxUint128,
        MaxUint128,
      ])
      const burnData = positionManager.interface.encodeFunctionData('burn', [tokenId])

      return positionManager.multicall([decreaseLiquidityData, collectData, burnData])
    }

    it('executes all the actions', async () => {
      const pool = poolAtAddress(
        computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM),
        wallet
      )
      await expect(
        exit({
          positionManager: positionManager.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      )
        .to.emit(pool, 'Burn')
        .to.emit(pool, 'Collect')
    })

    it('gas', async () => {
      await snapshotGasCost(
        exit({
          positionManager: positionManager.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      )
    })
  })

  describe('#tokenURI', async () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await positionManager.firstMint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        sqrtPriceX96: encodePriceSqrt(1, 1),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount: 100,
        deadline: 1,
        fee: FeeAmount.MEDIUM,
      })
    })

    it('reverts for invalid token id', async () => {
      await expect(positionManager.tokenURI(tokenId + 1)).to.be.revertedWith('Invalid token ID')
    })

    it('returns a data URI with correct mime type', async () => {
      expect(await positionManager.tokenURI(tokenId)).to.match(/data:application\/json,.+/)
    })
    it('content is valid JSON and structure', async () => {
      const content = JSON.parse((await positionManager.tokenURI(tokenId)).substr('data:application/json,'.length))
      expect(content).to.haveOwnProperty('name').is.a('string')
      expect(content).to.haveOwnProperty('description').is.a('string')
    })
  })
})
