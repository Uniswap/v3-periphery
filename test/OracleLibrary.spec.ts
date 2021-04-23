import { expect } from 'chai'
import { OracleTest } from '../typechain/OracleTest'
import { TickMathTest } from '../typechain/TickMathTest'
import { ethers, waffle } from 'hardhat'
import { BigNumber } from 'ethers'
import { expandTo18Decimals } from './shared/expandTo18Decimals'

describe('OracleLibrary', () => {
  const [wallet, other] = waffle.provider.getWallets()

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let oracle: OracleTest
  let tickMath: TickMathTest

  const TOKEN0_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const TOKEN1_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
  const TOKEN_AMOUNT = expandTo18Decimals(5)
  const UINT32_MAX = BigNumber.from(2).pow(32).sub(1)
  const ORACLE_MAX_RANGE = BigNumber.from(65536).mul(13).div(2)
  const BASE_TIME = UINT32_MAX.sub(ORACLE_MAX_RANGE.div(2))

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader([wallet, other])
  })

  beforeEach('deploy test oracle and tick math', async () => {
    const fixtures = await loadFixture(oracleFixture)
    oracle = fixtures['oracle']
    tickMath = fixtures['tickMath']
  })

  const sqrtRatioToRatioX128 = (x: BigNumber) => {
    return x.pow(2).div(BigNumber.from(2).pow(64))
  }

  const getNearestTick = async (startBlockTimestamp: BigNumber, endBlockTimestamp: BigNumber) => {
    const blockTimestampCurrent = BigNumber.from(await oracle.time())

    const secondAgos0 = blockTimestampCurrent.gte(startBlockTimestamp)
      ? blockTimestampCurrent.sub(startBlockTimestamp)
      : blockTimestampCurrent.add(UINT32_MAX.sub(startBlockTimestamp))

    const secondAgos1 = blockTimestampCurrent.gte(endBlockTimestamp)
      ? blockTimestampCurrent.sub(endBlockTimestamp)
      : blockTimestampCurrent.add(UINT32_MAX.sub(endBlockTimestamp))

    const tickCumulatives = (await oracle.observe([secondAgos0, secondAgos1]))['tickCumulatives']

    const tickCumulativesDelta = tickCumulatives[1].sub(tickCumulatives[0])
    const observationTimeDelta =
      startBlockTimestamp < endBlockTimestamp
        ? endBlockTimestamp.sub(startBlockTimestamp)
        : endBlockTimestamp.add(UINT32_MAX.sub(startBlockTimestamp))

    let tick = tickCumulativesDelta.div(observationTimeDelta)

    // Always round tick to negative infinity
    return tick.lt(0) && !tickCumulativesDelta.mod(observationTimeDelta).eq(0) ? tick.sub(1) : tick
  }

  const oracleFixture = async () => {
    const oracleTestFactory = await ethers.getContractFactory('OracleTest')
    const oracle = await oracleTestFactory.deploy()

    await oracle.initialize({
      time: BASE_TIME.add(10),
      tick: 0,
      liquidity: 0,
      token0: TOKEN0_ADDRESS,
      token1: TOKEN1_ADDRESS,
    })

    await oracle.grow(5)
    await oracle.update({ advanceTimeBy: 1, tick: 3, liquidity: 2 })
    await oracle.update({ advanceTimeBy: 4, tick: -7, liquidity: 6 })
    await oracle.update({ advanceTimeBy: 5, tick: -2, liquidity: 4 })
    // Overflow to go over the uint32 boundary
    await oracle.update({ advanceTimeBy: ORACLE_MAX_RANGE.div(2), tick: -10, liquidity: 10 })

    const tickMathTestFactory = await ethers.getContractFactory('TickMathTest')
    const tickMath = await tickMathTestFactory.deploy()

    return { oracle: oracle as OracleTest, tickMath: tickMath as TickMathTest }
  }

  describe('#consult', () => {
    it('reverts when startTimestamp is not in observations', async () => {
      const startTimestamp = BASE_TIME.add(BigNumber.from(5)) // Before the first oracle checkpoint
      const endTimestamp = BASE_TIME.add(BigNumber.from(16)) // After the first oracle checkpoint

      await expect(
        oracle.consult(oracle.address, TOKEN0_ADDRESS, TOKEN_AMOUNT, startTimestamp, endTimestamp)
      ).to.be.revertedWith('OLD')
    })

    it('reverts when endTimestamp is not in observations', async () => {
      const startTimestamp = BASE_TIME.add(BigNumber.from(16)) // After the first oracle checkpoint
      const endTimestamp = BigNumber.from(20) // After the last oracle checkpoint (uint32 overflow)

      await expect(
        oracle.consult(oracle.address, TOKEN0_ADDRESS, TOKEN_AMOUNT, startTimestamp, endTimestamp)
      ).to.be.revertedWith('OLD')
    })

    it('reverts when endTimestamp is equal startTimestamp', async () => {
      const startTimestamp = BASE_TIME.add(BigNumber.from(16))
      const endTimestamp = BASE_TIME.add(BigNumber.from(16))

      await expect(
        oracle.consult(oracle.address, TOKEN0_ADDRESS, TOKEN_AMOUNT, startTimestamp, endTimestamp)
      ).to.be.revertedWith('Bad range')
    })

    const tokenOutputTests = async (
      tokenAddress: string,
      getAmountOut: (ratioX128: BigNumber, amountIn: BigNumber) => void
    ) => {
      it('returns correct output amount when tick cumulatives delta is positive', async () => {
        const startTimestamp = BASE_TIME.add(BigNumber.from(11))
        const endTimestamp = BASE_TIME.add(BigNumber.from(16))

        const tick = await getNearestTick(startTimestamp, endTimestamp)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

        const ratioX128 = await sqrtRatioToRatioX128(sqrtRatioX96)
        const calculatedAmountOut = getAmountOut(ratioX128, TOKEN_AMOUNT)
        const oracleAmountOut = await oracle.consult(
          oracle.address,
          tokenAddress,
          TOKEN_AMOUNT,
          startTimestamp,
          endTimestamp
        )

        expect(oracleAmountOut).to.equal(calculatedAmountOut)
      })

      it('returns correct output amount when tick cumulatives delta is negative', async () => {
        const startTimestamp = BigNumber.from(13)
        const endTimestamp = BigNumber.from(17)

        const tick = await getNearestTick(startTimestamp, endTimestamp)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

        const ratioX128 = await sqrtRatioToRatioX128(sqrtRatioX96)
        const calculatedAmountOut = getAmountOut(ratioX128, TOKEN_AMOUNT)
        const oracleAmountOut = await oracle.consult(
          oracle.address,
          tokenAddress,
          TOKEN_AMOUNT,
          startTimestamp,
          endTimestamp
        )

        expect(oracleAmountOut).to.equal(calculatedAmountOut)
      })

      it('returns correct output amount when tick cumulatives delta is zero', async () => {
        const startTimestamp = BigNumber.from(10)
        const endTimestamp = BigNumber.from(11)

        const tick = await getNearestTick(startTimestamp, endTimestamp)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

        const ratioX128 = await sqrtRatioToRatioX128(sqrtRatioX96)
        const calculatedAmountOut = getAmountOut(ratioX128, TOKEN_AMOUNT)
        const oracleAmountOut = await oracle.consult(
          oracle.address,
          tokenAddress,
          TOKEN_AMOUNT,
          startTimestamp,
          endTimestamp
        )

        expect(oracleAmountOut).to.equal(calculatedAmountOut)
      })

      it('returns correct output amount across overflow boundary', async () => {
        const startTimestamp = BASE_TIME.add(BigNumber.from(10))
        const endTimestamp = BigNumber.from(19)

        const tick = await getNearestTick(startTimestamp, endTimestamp)
        const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

        const ratioX128 = await sqrtRatioToRatioX128(sqrtRatioX96)
        const calculatedAmountOut = getAmountOut(ratioX128, TOKEN_AMOUNT)
        const oracleAmountOut = await oracle.consult(
          oracle.address,
          tokenAddress,
          TOKEN_AMOUNT,
          startTimestamp,
          endTimestamp
        )

        expect(oracleAmountOut).to.equal(calculatedAmountOut)
      })
    }

    describe('when token0 is input token', async () => {
      const getAmountOut = (ratioX128: BigNumber, amountIn: BigNumber) => {
        return ratioX128.mul(amountIn).div(BigNumber.from(2).pow(128))
      }

      await tokenOutputTests(TOKEN0_ADDRESS, getAmountOut)
    })

    describe('when token1 is input token', async () => {
      const getAmountOut = (ratioX128: BigNumber, amountIn: BigNumber) => {
        return BigNumber.from(2).pow(128).mul(amountIn).div(ratioX128)
      }

      await tokenOutputTests(TOKEN1_ADDRESS, getAmountOut)
    })
  })
})
