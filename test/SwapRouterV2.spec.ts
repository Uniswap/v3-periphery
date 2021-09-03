import { Contract, Wallet } from 'ethers'
import { ethers, network, waffle } from 'hardhat'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { BigNumber, constants } from 'ethers'
import snapshotGasCost from './shared/snapshotGasCost'

const { MaxUint256, AddressZero } = constants

// import DeflatingERC20 from '../build/DeflatingERC20.json'
// import { ecsign } from 'ethereumjs-util'
import { v2Fixture } from './shared/v2Fixtures'

const MINIMUM_LIQUIDITY = BigNumber.from(1000)

describe.only('SwapRouterV2', () => {
  let wallet: Wallet
  let trader: Wallet
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  before('create fixture loader', async () => {
    ;[wallet, trader] = await (ethers as any).getSigners()
    loadFixture = waffle.createFixtureLoader([wallet, trader])
  })

  let token0: Contract
  let token1: Contract
  let swapRouterV2: Contract
  beforeEach(async function () {
    const fixture = await loadFixture(v2Fixture)
    token0 = fixture.token0
    token1 = fixture.token1
    swapRouterV2 = fixture.swapRouterV2
  })

  let WETH: Contract
  let WETHPartner: Contract
  let v2Factory: Contract
  let pair: Contract
  let WETHPair: Contract
  beforeEach(async function () {
    const fixture = await loadFixture(v2Fixture)
    token0 = fixture.token0
    token1 = fixture.token1
    WETH = fixture.WETH
    WETHPartner = fixture.WETHPartner
    v2Factory = fixture.uniswapV2Factory
    pair = fixture.pair
    WETHPair = fixture.WETHPair
  })

  async function increaseTimeBy(seconds: number) {
    await network.provider.send('evm_increaseTime', [seconds])
  }

  afterEach(async function () {
    expect(await wallet.provider.getBalance(swapRouterV2.address)).to.eq('0')
  })

  it('factory, WETH', async () => {
    expect(await swapRouterV2.v2Factory()).to.eq(v2Factory.address)
    expect(await swapRouterV2.WETH()).to.eq(WETH.address)
  })

  it.skip('addLiquidity', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)

    const expectedLiquidity = expandTo18Decimals(2)
    await token0.approve(swapRouterV2.address, MaxUint256)
    await token1.approve(swapRouterV2.address, MaxUint256)
    await expect(
      swapRouterV2.addLiquidity(
        token0.address,
        token1.address,
        token0Amount,
        token1Amount,
        0,
        0,
        wallet.address,
        MaxUint256
      )
    )
      .to.emit(token0, 'Transfer')
      .withArgs(wallet.address, pair.address, token0Amount)
      .to.emit(token1, 'Transfer')
      .withArgs(wallet.address, pair.address, token1Amount)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(swapRouterV2.address, token0Amount, token1Amount)

    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  })

  it.skip('addLiquidityETH', async () => {
    const WETHPartnerAmount = expandTo18Decimals(1)
    const ETHAmount = expandTo18Decimals(4)

    const expectedLiquidity = expandTo18Decimals(2)
    const WETHPairToken0 = await WETHPair.token0()
    await WETHPartner.approve(swapRouterV2.address, MaxUint256)
    await expect(
      swapRouterV2.addLiquidityETH(
        WETHPartner.address,
        WETHPartnerAmount,
        WETHPartnerAmount,
        ETHAmount,
        wallet.address,
        MaxUint256,
        { value: ETHAmount }
      )
    )
      .to.emit(WETHPair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(WETHPair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETHPair, 'Sync')
      .withArgs(
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
        WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount
      )
      .to.emit(WETHPair, 'Mint')
      .withArgs(
        swapRouterV2.address,
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
        WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount
      )

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  })

  async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(wallet.address)
  }
  it.skip('removeLiquidity', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    await pair.approve(swapRouterV2.address, MaxUint256)
    await expect(
      swapRouterV2.removeLiquidity(
        token0.address,
        token1.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        MaxUint256
      )
    )
      .to.emit(pair, 'Transfer')
      .withArgs(wallet.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, token0Amount.sub(500))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
      .to.emit(pair, 'Sync')
      .withArgs(500, 2000)
      .to.emit(pair, 'Burn')
      .withArgs(swapRouterV2.address, token0Amount.sub(500), token1Amount.sub(2000), wallet.address)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(500))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(2000))
  })

  it.skip('removeLiquidityETH', async () => {
    const WETHPartnerAmount = expandTo18Decimals(1)
    const ETHAmount = expandTo18Decimals(4)
    await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
    await WETH.deposit({ value: ETHAmount })
    await WETH.transfer(WETHPair.address, ETHAmount)
    await WETHPair.mint(wallet.address)

    const expectedLiquidity = expandTo18Decimals(2)
    const WETHPairToken0 = await WETHPair.token0()
    await WETHPair.approve(swapRouterV2.address, MaxUint256)
    await expect(
      swapRouterV2.removeLiquidityETH(
        WETHPartner.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        MaxUint256
      )
    )
      .to.emit(WETHPair, 'Transfer')
      .withArgs(wallet.address, WETHPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETHPair, 'Transfer')
      .withArgs(WETHPair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETH, 'Transfer')
      .withArgs(WETHPair.address, swapRouterV2.address, ETHAmount.sub(2000))
      .to.emit(WETHPartner, 'Transfer')
      .withArgs(WETHPair.address, swapRouterV2.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPartner, 'Transfer')
      .withArgs(swapRouterV2.address, wallet.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPair, 'Sync')
      .withArgs(
        WETHPairToken0 === WETHPartner.address ? 500 : 2000,
        WETHPairToken0 === WETHPartner.address ? 2000 : 500
      )
      .to.emit(WETHPair, 'Burn')
      .withArgs(
        swapRouterV2.address,
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount.sub(500) : ETHAmount.sub(2000),
        WETHPairToken0 === WETHPartner.address ? ETHAmount.sub(2000) : WETHPartnerAmount.sub(500),
        swapRouterV2.address
      )

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(0)
    const totalSupplyWETHPartner = await WETHPartner.totalSupply()
    const totalSupplyWETH = await WETH.totalSupply()
    expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(500))
    expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(2000))
  })

  // it('removeLiquidityWithPermit', async () => {
  //   const token0Amount = expandTo18Decimals(1)
  //   const token1Amount = expandTo18Decimals(4)
  //   await addLiquidity(token0Amount, token1Amount)
  //
  //   const expectedLiquidity = expandTo18Decimals(2)
  //
  //   const nonce = await pair.nonces(wallet.address)
  //   const digest = await getApprovalDigest(
  //     pair,
  //     { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
  //     nonce,
  //     MaxUint256
  //   )
  //
  //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
  //
  //   await router.removeLiquidityWithPermit(
  //     token0.address,
  //     token1.address,
  //     expectedLiquidity.sub(MINIMUM_LIQUIDITY),
  //     0,
  //     0,
  //     wallet.address,
  //     MaxUint256,
  //     false,
  //     v,
  //     r,
  //     s
  //   )
  // })

  // it('removeLiquidityETHWithPermit', async () => {
  //   const WETHPartnerAmount = expandTo18Decimals(1)
  //   const ETHAmount = expandTo18Decimals(4)
  //   await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
  //   await WETH.deposit({ value: ETHAmount })
  //   await WETH.transfer(WETHPair.address, ETHAmount)
  //   await WETHPair.mint(wallet.address)
  //
  //   const expectedLiquidity = expandTo18Decimals(2)
  //
  //   const nonce = await WETHPair.nonces(wallet.address)
  //   const digest = await getApprovalDigest(
  //     WETHPair,
  //     { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
  //     nonce,
  //     MaxUint256
  //   )
  //
  //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
  //
  //   await router.removeLiquidityETHWithPermit(
  //     WETHPartner.address,
  //     expectedLiquidity.sub(MINIMUM_LIQUIDITY),
  //     0,
  //     0,
  //     wallet.address,
  //     MaxUint256,
  //     false,
  //     v,
  //     r,
  //     s
  //   )
  // })

  describe('swapExactTokensForTokens', () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1662497915624478906')

    beforeEach(async () => {
      await addLiquidity(token0Amount, token1Amount)
      await token0.approve(swapRouterV2.address, MaxUint256)
    })

    it('happy path', async () => {
      await expect(
        swapRouterV2.swapExactTokensForTokens(
          swapAmount,
          0,
          [token0.address, token1.address],
          wallet.address,
          MaxUint256
        )
      )
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, pair.address, swapAmount)
        .to.emit(token1, 'Transfer')
        .withArgs(pair.address, wallet.address, expectedOutputAmount)
        .to.emit(pair, 'Sync')
        .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
        .to.emit(pair, 'Swap')
        .withArgs(swapRouterV2.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
    })

    // it('amounts', async () => {
    //   await token0.approve(routerEventEmitter.address, MaxUint256)
    //   await expect(
    //     routerEventEmitter.swapExactTokensForTokens(
    //       router.address,
    //       swapAmount,
    //       0,
    //       [token0.address, token1.address],
    //       wallet.address,
    //       MaxUint256
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([swapAmount, expectedOutputAmount])
    // })

    it('gas', async () => {
      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await increaseTimeBy(1)
      await pair.sync()

      await token0.approve(swapRouterV2.address, MaxUint256)
      await increaseTimeBy(1)
      await snapshotGasCost(
        swapRouterV2.swapExactTokensForTokens(
          swapAmount,
          0,
          [token0.address, token1.address],
          wallet.address,
          MaxUint256
        )
      )
    })
  })

  describe('swapTokensForExactTokens', () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const expectedSwapAmount = BigNumber.from('557227237267357629')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await addLiquidity(token0Amount, token1Amount)
    })

    it('happy path', async () => {
      await token0.approve(swapRouterV2.address, MaxUint256)
      await expect(
        swapRouterV2.swapTokensForExactTokens(
          outputAmount,
          MaxUint256,
          [token0.address, token1.address],
          wallet.address,
          MaxUint256
        )
      )
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, pair.address, expectedSwapAmount)
        .to.emit(token1, 'Transfer')
        .withArgs(pair.address, wallet.address, outputAmount)
        .to.emit(pair, 'Sync')
        .withArgs(token0Amount.add(expectedSwapAmount), token1Amount.sub(outputAmount))
        .to.emit(pair, 'Swap')
        .withArgs(swapRouterV2.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
    })

    // it('amounts', async () => {
    //   await token0.approve(routerEventEmitter.address, MaxUint256)
    //   await expect(
    //     routerEventEmitter.swapTokensForExactTokens(
    //       router.address,
    //       outputAmount,
    //       MaxUint256,
    //       [token0.address, token1.address],
    //       wallet.address,
    //       MaxUint256
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([expectedSwapAmount, outputAmount])
    // })
  })

  describe('swapExactETHForTokens', () => {
    const WETHPartnerAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1662497915624478906')

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)

      await token0.approve(swapRouterV2.address, MaxUint256)
    })

    it('happy path', async () => {
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        swapRouterV2.swapExactETHForTokens(0, [WETH.address, WETHPartner.address], wallet.address, MaxUint256, {
          value: swapAmount,
        })
      )
        .to.emit(WETH, 'Transfer')
        .withArgs(swapRouterV2.address, WETHPair.address, swapAmount)
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(WETHPair.address, wallet.address, expectedOutputAmount)
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.sub(expectedOutputAmount)
            : ETHAmount.add(swapAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.add(swapAmount)
            : WETHPartnerAmount.sub(expectedOutputAmount)
        )
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          swapRouterV2.address,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          wallet.address
        )
    })

    // it('amounts', async () => {
    //   await expect(
    //     routerEventEmitter.swapExactETHForTokens(
    //       router.address,
    //       0,
    //       [WETH.address, WETHPartner.address],
    //       wallet.address,
    //       MaxUint256,
    //       {
    //         value: swapAmount,
    //       }
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([swapAmount, expectedOutputAmount])
    // })

    it('gas', async () => {
      const WETHPartnerAmount = expandTo18Decimals(10)
      const ETHAmount = expandTo18Decimals(5)
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)

      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await increaseTimeBy(1)
      await pair.sync()

      const swapAmount = expandTo18Decimals(1)
      await increaseTimeBy(1)
      await snapshotGasCost(
        swapRouterV2.swapExactETHForTokens(0, [WETH.address, WETHPartner.address], wallet.address, MaxUint256, {
          value: swapAmount,
        })
      )
    })
  })

  describe('swapTokensForExactETH', () => {
    const WETHPartnerAmount = expandTo18Decimals(5)
    const ETHAmount = expandTo18Decimals(10)
    const expectedSwapAmount = BigNumber.from('557227237267357629')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      await WETHPartner.approve(swapRouterV2.address, MaxUint256)
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        swapRouterV2.swapTokensForExactETH(
          outputAmount,
          MaxUint256,
          [WETHPartner.address, WETH.address],
          wallet.address,
          MaxUint256
        )
      )
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(wallet.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETH, 'Transfer')
        .withArgs(WETHPair.address, swapRouterV2.address, outputAmount)
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.add(expectedSwapAmount)
            : ETHAmount.sub(outputAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.sub(outputAmount)
            : WETHPartnerAmount.add(expectedSwapAmount)
        )
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          swapRouterV2.address,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          swapRouterV2.address
        )
    })

    // it('amounts', async () => {
    //   await WETHPartner.approve(routerEventEmitter.address, MaxUint256)
    //   await expect(
    //     routerEventEmitter.swapTokensForExactETH(
    //       router.address,
    //       outputAmount,
    //       MaxUint256,
    //       [WETHPartner.address, WETH.address],
    //       wallet.address,
    //       MaxUint256
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([expectedSwapAmount, outputAmount])
    // })
  })

  describe('swapExactTokensForETH', () => {
    const WETHPartnerAmount = expandTo18Decimals(5)
    const ETHAmount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1662497915624478906')

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      await WETHPartner.approve(swapRouterV2.address, MaxUint256)
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        swapRouterV2.swapExactTokensForETH(
          swapAmount,
          0,
          [WETHPartner.address, WETH.address],
          wallet.address,
          MaxUint256
        )
      )
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(wallet.address, WETHPair.address, swapAmount)
        .to.emit(WETH, 'Transfer')
        .withArgs(WETHPair.address, swapRouterV2.address, expectedOutputAmount)
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.add(swapAmount)
            : ETHAmount.sub(expectedOutputAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.sub(expectedOutputAmount)
            : WETHPartnerAmount.add(swapAmount)
        )
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          swapRouterV2.address,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          swapRouterV2.address
        )
    })

    // it('amounts', async () => {
    //   await WETHPartner.approve(routerEventEmitter.address, MaxUint256)
    //   await expect(
    //     routerEventEmitter.swapExactTokensForETH(
    //       router.address,
    //       swapAmount,
    //       0,
    //       [WETHPartner.address, WETH.address],
    //       wallet.address,
    //       MaxUint256
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([swapAmount, expectedOutputAmount])
    // })
  })

  describe('swapETHForExactTokens', () => {
    const WETHPartnerAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const expectedSwapAmount = BigNumber.from('557227237267357629')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        swapRouterV2.swapETHForExactTokens(
          outputAmount,
          [WETH.address, WETHPartner.address],
          wallet.address,
          MaxUint256,
          {
            value: expectedSwapAmount,
          }
        )
      )
        .to.emit(WETH, 'Transfer')
        .withArgs(swapRouterV2.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(WETHPair.address, wallet.address, outputAmount)
        .to.emit(WETHPair, 'Sync')
        .withArgs(
          WETHPairToken0 === WETHPartner.address
            ? WETHPartnerAmount.sub(outputAmount)
            : ETHAmount.add(expectedSwapAmount),
          WETHPairToken0 === WETHPartner.address
            ? ETHAmount.add(expectedSwapAmount)
            : WETHPartnerAmount.sub(outputAmount)
        )
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          swapRouterV2.address,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          wallet.address
        )
    })

    // it('amounts', async () => {
    //   await expect(
    //     routerEventEmitter.swapETHForExactTokens(
    //       router.address,
    //       outputAmount,
    //       [WETH.address, WETHPartner.address],
    //       wallet.address,
    //       MaxUint256,
    //       {
    //         value: expectedSwapAmount,
    //       }
    //     )
    //   )
    //     .to.emit(routerEventEmitter, 'Amounts')
    //     .withArgs([expectedSwapAmount, outputAmount])
    // })
  })
})

// describe('fee-on-transfer tokens', () => {
//   const provider = new MockProvider({
//     hardfork: 'istanbul',
//     mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
//     gasLimit: 9999999,
//   })
//   const [wallet] = provider.getWallets()
//   const loadFixture = createFixtureLoader(provider, [wallet])
//
//   let DTT: Contract
//   let WETH: Contract
//   let router: Contract
//   let pair: Contract
//   beforeEach(async function () {
//     const fixture = await loadFixture(v2Fixture)
//
//     WETH = fixture.WETH
//     router = fixture.router02
//
//     DTT = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])
//
//     // make a DTT<>WETH pair
//     await fixture.factoryV2.createPair(DTT.address, WETH.address)
//     const pairAddress = await fixture.factoryV2.getPair(DTT.address, WETH.address)
//     pair = new Contract(pairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)
//   })
//
//   afterEach(async function () {
//     expect(await provider.getBalance(router.address)).to.eq(0)
//   })
//
//   async function addLiquidity(DTTAmount: BigNumber, WETHAmount: BigNumber) {
//     await DTT.approve(router.address, MaxUint256)
//     await router.addLiquidityETH(DTT.address, DTTAmount, DTTAmount, WETHAmount, wallet.address, MaxUint256, {
//       value: WETHAmount,
//     })
//   }
//
//   it('removeLiquidityETHSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals(1)
//     const ETHAmount = expandTo18Decimals(4)
//     await addLiquidity(DTTAmount, ETHAmount)
//
//     const DTTInPair = await DTT.balanceOf(pair.address)
//     const WETHInPair = await WETH.balanceOf(pair.address)
//     const liquidity = await pair.balanceOf(wallet.address)
//     const totalSupply = await pair.totalSupply()
//     const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
//     const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)
//
//     await pair.approve(router.address, MaxUint256)
//     await router.removeLiquidityETHSupportingFeeOnTransferTokens(
//       DTT.address,
//       liquidity,
//       NaiveDTTExpected,
//       WETHExpected,
//       wallet.address,
//       MaxUint256
//     )
//   })
//
//   // it('removeLiquidityETHWithPermitSupportingFeeOnTransferTokens', async () => {
//   //   const DTTAmount = expandTo18Decimals(1).mul(100).div(99)
//   //   const ETHAmount = expandTo18Decimals(4)
//   //   await addLiquidity(DTTAmount, ETHAmount)
//   //
//   //   const expectedLiquidity = expandTo18Decimals(2)
//   //
//   //   const nonce = await pair.nonces(wallet.address)
//   //   const digest = await getApprovalDigest(
//   //     pair,
//   //     { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
//   //     nonce,
//   //     MaxUint256
//   //   )
//   //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
//   //
//   //   const DTTInPair = await DTT.balanceOf(pair.address)
//   //   const WETHInPair = await WETH.balanceOf(pair.address)
//   //   const liquidity = await pair.balanceOf(wallet.address)
//   //   const totalSupply = await pair.totalSupply()
//   //   const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
//   //   const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)
//   //
//   //   await pair.approve(router.address, MaxUint256)
//   //   await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
//   //     DTT.address,
//   //     liquidity,
//   //     NaiveDTTExpected,
//   //     WETHExpected,
//   //     wallet.address,
//   //     MaxUint256,
//   //     false,
//   //     v,
//   //     r,
//   //     s
//   //   )
//   // })
//
//   describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
//     const DTTAmount = expandTo18Decimals(5).mul(100).div(99)
//     const ETHAmount = expandTo18Decimals(10)
//     const amountIn = expandTo18Decimals(1)
//
//     beforeEach(async () => {
//       await addLiquidity(DTTAmount, ETHAmount)
//     })
//
//     it('DTT -> WETH', async () => {
//       await DTT.approve(router.address, MaxUint256)
//
//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [DTT.address, WETH.address],
//         wallet.address,
//         MaxUint256
//       )
//     })
//
//     // WETH -> DTT
//     it('WETH -> DTT', async () => {
//       await WETH.deposit({ value: amountIn }) // mint WETH
//       await WETH.approve(router.address, MaxUint256)
//
//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [WETH.address, DTT.address],
//         wallet.address,
//         MaxUint256
//       )
//     })
//   })
//
//   // ETH -> DTT
//   it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals(10).mul(100).div(99)
//     const ETHAmount = expandTo18Decimals(5)
//     const swapAmount = expandTo18Decimals(1)
//     await addLiquidity(DTTAmount, ETHAmount)
//
//     await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
//       0,
//       [WETH.address, DTT.address],
//       wallet.address,
//       MaxUint256,
//       {
//         value: swapAmount,
//       }
//     )
//   })
//
//   // DTT -> ETH
//   it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals(5).mul(100).div(99)
//     const ETHAmount = expandTo18Decimals(10)
//     const swapAmount = expandTo18Decimals(1)
//
//     await addLiquidity(DTTAmount, ETHAmount)
//     await DTT.approve(router.address, MaxUint256)
//
//     await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
//       swapAmount,
//       0,
//       [DTT.address, WETH.address],
//       wallet.address,
//       MaxUint256
//     )
//   })
// })
//
// describe('fee-on-transfer tokens: reloaded', () => {
//   const provider = new MockProvider({
//     hardfork: 'istanbul',
//     mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
//     gasLimit: 9999999,
//   })
//   const [wallet] = provider.getWallets()
//   const loadFixture = createFixtureLoader(provider, [wallet])
//
//   let DTT: Contract
//   let DTT2: Contract
//   let router: Contract
//   beforeEach(async function () {
//     const fixture = await loadFixture(v2Fixture)
//
//     router = fixture.router02
//
//     DTT = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])
//     DTT2 = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])
//
//     // make a DTT<>WETH pair
//     await fixture.factoryV2.createPair(DTT.address, DTT2.address)
//     const pairAddress = await fixture.factoryV2.getPair(DTT.address, DTT2.address)
//   })
//
//   afterEach(async function () {
//     expect(await provider.getBalance(router.address)).to.eq(0)
//   })
//
//   async function addLiquidity(DTTAmount: BigNumber, DTT2Amount: BigNumber) {
//     await DTT.approve(router.address, MaxUint256)
//     await DTT2.approve(router.address, MaxUint256)
//     await router.addLiquidity(
//       DTT.address,
//       DTT2.address,
//       DTTAmount,
//       DTT2Amount,
//       DTTAmount,
//       DTT2Amount,
//       wallet.address,
//       MaxUint256
//     )
//   }
//
//   describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
//     const DTTAmount = expandTo18Decimals(5).mul(100).div(99)
//     const DTT2Amount = expandTo18Decimals(5)
//     const amountIn = expandTo18Decimals(1)
//
//     beforeEach(async () => {
//       await addLiquidity(DTTAmount, DTT2Amount)
//     })
//
//     it('DTT -> DTT2', async () => {
//       await DTT.approve(router.address, MaxUint256)
//
//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [DTT.address, DTT2.address],
//         wallet.address,
//         MaxUint256
//       )
//     })
//   })
// })
