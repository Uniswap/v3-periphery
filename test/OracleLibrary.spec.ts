import { expect } from 'chai'
import { OracleTest } from '../typechain/OracleTest'
import { TickMathTest } from '../typechain/TickMathTest'
import { ethers, waffle } from 'hardhat'
import formatSqrtRatioX96 from './shared/formatSqrtRatioX96'
import { BigNumber } from 'ethers'

describe('OracleLibrary', () => {
  const [wallet, other] = waffle.provider.getWallets()

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  let oracle: OracleTest
  let tickMath: TickMathTest

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader([wallet, other])
  })

  beforeEach('deploy test oracle and tick math', async () => {
    const fixtures = await loadFixture(oracleFixture)
    oracle = fixtures['oracle']
    tickMath = fixtures['tickMath']
  })

  const oracleFixture = async () => {
    const oracleLibraryFactory = await ethers.getContractFactory('OracleLibrary')
    const oracleLibrary = await oracleLibraryFactory.deploy()
    const oracleTestFactory = await ethers.getContractFactory('OracleTest', {
      libraries: {
        OracleLibrary: oracleLibrary.address,
      },
    })
    const oracle = await oracleTestFactory.deploy()

    await oracle.initialize({
      time: 0,
      tick: 0,
      liquidity: 0,
    })

    await oracle.grow(4)
    await oracle.update({ advanceTimeBy: 1, tick: 3, liquidity: 2 })
    await oracle.update({ advanceTimeBy: 4, tick: -7, liquidity: 6 })
    await oracle.update({ advanceTimeBy: 5, tick: -2, liquidity: 4 })

    const tickMathTestFactory = await ethers.getContractFactory('TickMathTest')
    const tickMath = await tickMathTestFactory.deploy()

    return { oracle: oracle as OracleTest, tickMath: tickMath as TickMathTest }
  }

  describe('#consult', () => {
    const sqrtRatioToRatioX128 = (x: BigNumber) => {
      return x.pow(2).div(BigNumber.from(2).pow(64))
    }

    const getNearestTick = async (startTimestamp: BigNumber, endTimestamp: BigNumber) => {
      const oracleTime = BigNumber.from(await oracle.time())
      const tickCumulatives = (await oracle.observe([oracleTime.sub(startTimestamp), oracleTime.sub(endTimestamp)]))[
        'tickCumulatives'
      ]
      const tick = tickCumulatives[1].sub(tickCumulatives[0]).div(endTimestamp.sub(startTimestamp))

      return tick
    }

    it('returns correct price when tick cumulatives is increasing', async () => {
      const startTimestamp = BigNumber.from(1)
      const endTimestamp = BigNumber.from(6)

      const tick = await getNearestTick(startTimestamp, endTimestamp)
      const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

      const calculatedPrice = await sqrtRatioToRatioX128(sqrtRatioX96).toString()
      const oracleLibPrice = await oracle.consult(oracle.address, startTimestamp, endTimestamp)

      expect(calculatedPrice).to.equal(oracleLibPrice)
    })

    it('returns correct price when tick cumulatives is decreasing', async () => {
      const startTimestamp = BigNumber.from(3)
      const endTimestamp = BigNumber.from(6)

      const tick = await getNearestTick(startTimestamp, endTimestamp)
      const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

      const calculatedPrice = await sqrtRatioToRatioX128(sqrtRatioX96).toString()
      const oracleLibPrice = await oracle.consult(oracle.address, startTimestamp, endTimestamp)

      expect(calculatedPrice).to.equal(oracleLibPrice)
    })

    it('returns correct price when tick cumulatives is zeros', async () => {
      const startTimestamp = BigNumber.from(0)
      const endTimestamp = BigNumber.from(1)

      const tick = await getNearestTick(startTimestamp, endTimestamp)
      const sqrtRatioX96 = await tickMath.getSqrtRatioAtTick(tick)

      const calculatedPrice = await sqrtRatioToRatioX128(sqrtRatioX96).toString()
      const oracleLibPrice = await oracle.consult(oracle.address, startTimestamp, endTimestamp)

      expect(calculatedPrice).to.equal(oracleLibPrice)
    })

    it('reverts when endTimestamp is not in observations', async () => {
      const startTimestamp = BigNumber.from(6)
      const endTimestamp = BigNumber.from(100000)

      await expect(oracle.consult(oracle.address, startTimestamp, endTimestamp)).to.be.revertedWith('OLD')
    })

    it('reverts when endTimestamp is before startTimestamp', async () => {
      const startTimestamp = BigNumber.from(6)
      const endTimestamp = BigNumber.from(1)

      await expect(oracle.consult(oracle.address, startTimestamp, endTimestamp)).to.be.revertedWith('Bad range')
    })

    it('reverts when endTimestamp is equal startTimestamp', async () => {
      const startTimestamp = BigNumber.from(6)
      const endTimestamp = BigNumber.from(6)

      await expect(oracle.consult(oracle.address, startTimestamp, endTimestamp)).to.be.revertedWith('Bad range')
    })
  })
})
