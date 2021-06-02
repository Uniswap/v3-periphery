import { waffle, ethers, artifacts } from 'hardhat'

import { expect } from './shared/expect'

import { PoolTicksHelperTest } from '../typechain'
import { deployMockContract, Fixture, MockContract } from 'ethereum-waffle'
import { Artifact } from 'hardhat/types'


describe('PoolTicksHelperLibrary', () => {
  const wallets = waffle.provider.getWallets()

  let poolTicksHelper: PoolTicksHelperTest;
  let pool: MockContract;
  let PoolAbi: Artifact;

  const TICK_SPACING = 60;

  // Bit index to tick
  const bitIdxToTick = (idx: number, page = 0) => {
    return (idx * TICK_SPACING) + (page * 256 * TICK_SPACING);
  }
  
  before(async () => {
    PoolAbi = await artifacts.readArtifact('IUniswapV3Pool')
    const poolTicksHelperFactory = await ethers.getContractFactory('PoolTicksHelperTest')
    poolTicksHelper = (await poolTicksHelperFactory.deploy()) as PoolTicksHelperTest
    pool = await deployMockContract(wallets[0], PoolAbi.abi)
    await pool.mock.tickSpacing.returns(TICK_SPACING);
    await poolTicksHelper.setPool(pool.address);
  })

  describe('tick after is bigger', async () => {
    it('same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xc); // 1100
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(255));
      expect(result).to.be.eq(2);
    })

    it('multiple pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xc); // 1100
      await pool.mock.tickBitmap.withArgs(1).returns(0xd); // 1101
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(255, 1));
      expect(result).to.be.eq(5);
    })

    it('counts last tick in same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(ethers.constants.MaxUint256); // 1100
      await pool.mock.tickBitmap.withArgs(1).returns(0x0); 
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(255, 1));
      expect(result).to.be.eq(256);
    })

    it('counts ticks to left of start and right of end on same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xf10f); // 1111000100001111
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(8), bitIdxToTick(255));
      expect(result).to.be.eq(5);
    })

    it('counts ticks to left of start and right of end across on multiple pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xf10f); // 1111000100001111
      await pool.mock.tickBitmap.withArgs(1).returns(0xf10f); // 1111000100001111
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(8), bitIdxToTick(8, 1));
      expect(result).to.be.eq(10);
    })

    it('counts ticks when before and after are initialized on same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 11111100
      const countStartingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(2), bitIdxToTick(255));
      expect(countStartingTick).to.be.eq(6);
      const countEndingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(3));
      expect(countEndingTick).to.be.eq(2);
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(2), bitIdxToTick(5));
      expect(countBoth).to.be.eq(4);
    })

    it('counts ticks when before and after are initialized on multiple page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 11111100
      await pool.mock.tickBitmap.withArgs(1).returns(0xfc); // 11111100
      const countStartingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(2), bitIdxToTick(255));
      expect(countStartingTick).to.be.eq(6);
      const countEndingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(3, 1));
      expect(countEndingTick).to.be.eq(8);
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(2), bitIdxToTick(5, 1));
      expect(countBoth).to.be.eq(10);
    })

    it('counts ticks with lots of pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 1111]1100
      await pool.mock.tickBitmap.withArgs(1).returns(0xff); // 11111111
      await pool.mock.tickBitmap.withArgs(2).returns(0x0); // 00000000
      await pool.mock.tickBitmap.withArgs(3).returns(0x0); // 00000000
      await pool.mock.tickBitmap.withArgs(4).returns(0xfc); // 11[111100
      
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(4), bitIdxToTick(5, 4));
      expect(countBoth).to.be.eq(16);
    })
  })

  describe('tick after is smaller', async () => {
    it('same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xc); // 1100
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(255), bitIdxToTick(0));
      expect(result).to.be.eq(2);
    })

    it('multiple pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xc); // 1100
      await pool.mock.tickBitmap.withArgs(-1).returns(0xd); // 1101
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(255), bitIdxToTick(0, -1));
      expect(result).to.be.eq(5);
    })

    it('counts last tick in same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(ethers.constants.MaxUint256); 
      await pool.mock.tickBitmap.withArgs(1).returns(0x0); 
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(255), bitIdxToTick(0));
      expect(result).to.be.eq(256);
    })

    it('counts ticks to right of start and left of end on same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xf10f); // 1111000100001111
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(255), bitIdxToTick(8));
      expect(result).to.be.eq(5);
    })

    it('counts ticks to right of start and left of end on multiple pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xf10f); // 1111000100001111
      await pool.mock.tickBitmap.withArgs(-1).returns(0xf10f); // 1111000100001111
      const result = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(8), bitIdxToTick(8, -1));
      expect(result).to.be.eq(10);
    })

    it('counts ticks when before and after are initialized on same page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 11111100
      const countStartingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(3), bitIdxToTick(0));
      expect(countStartingTick).to.be.eq(2);
      const countEndingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(255), bitIdxToTick(2));
      expect(countEndingTick).to.be.eq(6);
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(5), bitIdxToTick(2));
      expect(countBoth).to.be.eq(4);
    })

    it('counts ticks when before and after are initialized on multiple page', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 11111100
      await pool.mock.tickBitmap.withArgs(-1).returns(0xfc); // 11111100
      const countStartingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(0), bitIdxToTick(3, -1));
      expect(countStartingTick).to.be.eq(5);
      const countEndingTick = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(5), bitIdxToTick(255, -1));
      expect(countEndingTick).to.be.eq(4);
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(2), bitIdxToTick(5, -1));
      expect(countBoth).to.be.eq(4);
    })

    it('counts ticks with lots of pages', async () => {
      await pool.mock.tickBitmap.withArgs(0).returns(0xfc); // 1111[1100
      await pool.mock.tickBitmap.withArgs(-1).returns(0xff); // 11111111
      await pool.mock.tickBitmap.withArgs(-2).returns(0x0); // 00000000
      await pool.mock.tickBitmap.withArgs(-3).returns(0x0); // 00000000
      await pool.mock.tickBitmap.withArgs(-4).returns(0xfc); // 11]111100
      const countBoth = await poolTicksHelper.countInitializedBitsCrossed(bitIdxToTick(3), bitIdxToTick(6, -4));
      expect(countBoth).to.be.eq(12);
    })
  })
})
