import { waffle, ethers } from 'hardhat'

import { expect } from './shared/expect'

import { PathTest } from '../typechain'

import { encodePath, decodePath, decodeOne, FeeAmount, encodeOne } from './shared/utilities'
import snapshotGasCost from './shared/snapshotGasCost'

describe('Path', () => {
  const wallets = waffle.provider.getWallets()

  let path: PathTest

  let tokenAddrs = [
    '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  ]
  let fees = [FeeAmount.MEDIUM, FeeAmount.MEDIUM]

  const pathTestFixture = async () => {
    const pathTestFactory = await ethers.getContractFactory('PathTest')
    return (await pathTestFactory.deploy()) as PathTest
  }

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('deploy PathTest', async () => {
    path = await loadFixture(pathTestFixture)
  })

  describe('#get', () => {
    const p1 =
      '0x5fc8d32690cc91d4c39d9d3abcbd16989f8757070bb8cf7ed3acca5a467e9e704c703e8d87f634fb0fc90bb8dc64a140aa3e981100a9beca4e685f962f0cf6c9'

    it('gets first', async () => {
      const got = await path.get(p1, 0)
      expect(got).to.be.eq(p1.slice(0, 2 + 4 + 40 + 40))
    })
  })

  describe('#skip / #hasPairs', () => {
    const encodedPath = encodePath(tokenAddrs, fees)

    const offset = 20 + 20 + 4

    it('skips 1 item', async () => {
      expect(await path.hasPairs(encodedPath)).to.be.true

      const skipped = await path.skip(encodedPath, 1)
      expect(skipped).to.be.eq('0x' + encodedPath.slice(offset + 2).toLowerCase())
      expect(await path.hasPairs(skipped)).to.be.false
    })

    it('skips >1 items', async () => {
      const encodedPath = encodePath(
        [...tokenAddrs, '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
        [...fees, FeeAmount.MEDIUM, FeeAmount.MEDIUM]
      )
      let skipped = await path.skip(encodedPath, 2)
      expect(skipped).to.be.eq('0x' + encodedPath.slice(2 * offset + 2).toLowerCase())
      expect(await path.hasPairs(skipped)).to.be.true

      skipped = await path.skip(encodedPath, 3)
      expect(await path.hasPairs(skipped)).to.be.false
    })
  })

  describe('#hasPairs', () => {
    it('checks if there is at least 1 pair in the buffer', async () => {
      let encodedPath = encodeOne(tokenAddrs[0], tokenAddrs[1], fees[0])
      expect(await path.hasPairs('0x' + encodedPath)).to.be.true

      encodedPath = encodePath(tokenAddrs, fees)
      expect(await path.hasPairs(encodedPath)).to.be.true
    })

    it('checks if there are no pairs in the buffer', async () => {
      const encodedPath = encodePath(tokenAddrs, fees)
      // skip to after the 2nd pair
      const skipped = await path.skip(encodedPath, 1)
      expect(await path.hasPairs(skipped)).to.be.false
    })
  })

  describe('#decode', () => {
    it('solidity decode one', async () => {
      const encodedPath = encodeOne(tokenAddrs[0], tokenAddrs[1], fees[0])
      const { token0, token1, fee } = await path.decode('0x' + encodedPath)
      const decodedPath = { token0, token1, fee }
      expect(decodedPath).to.be.deep.eq({ token0: tokenAddrs[0], token1: tokenAddrs[1], fee: fees[0] })
      expect(decodedPath).to.be.deep.eq(decodeOne(Buffer.from(encodedPath, 'hex'), 0))
    })

    it('js: encodes and decodes a path', async () => {
      const encodedPath = encodePath(tokenAddrs, fees)
      const decodedPath = decodePath(encodedPath)
      expect(decodedPath).to.be.deep.eq([
        { token0: tokenAddrs[0], token1: tokenAddrs[1], fee: FeeAmount.MEDIUM },
        { token0: tokenAddrs[1], token1: tokenAddrs[2], fee: FeeAmount.MEDIUM },
      ])
    })

    it('gas cost', async () => {
      const encodedPath = encodeOne(tokenAddrs[0], tokenAddrs[1], fees[0])
      await snapshotGasCost(path.getGasCostOfDecode('0x' + encodedPath))
    })
  })
})
