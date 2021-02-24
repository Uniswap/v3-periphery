import { waffle, ethers } from 'hardhat'

import { expect } from './shared/expect'

import { PathTest } from '../typechain'

import { encodePath, decodePath, decodeOne, popFromPath, FeeAmount, encodeOne } from './shared/utilities'

describe.only('Path', () => {
  const wallets = waffle.provider.getWallets()

  let path: PathTest
  
  const tokenAddrs = [
    '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
    '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
  ]
  const fees = [
    FeeAmount.MEDIUM,
    FeeAmount.MEDIUM
  ]

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

  describe('#paths', () => {
    it.only("solidity decode one", async () => {
      const encodedPath = encodeOne(tokenAddrs[0], tokenAddrs[1], fees[0])
      const decodedPath = decodeOne(Buffer.from(encodedPath, 'hex'), 0)
      // const decodedPath = await path.decode('0x' + encodedPath)
      console.log(decodedPath)
      expect(decodedPath).to.be.deep.eq({ token0: tokenAddrs[0], token1: tokenAddrs[1], fee: fees[0] })
    })

    it("encodes and decodes a path", async () => {
      const encodedPath = encodePath(tokenAddrs, fees)
      const decodedPath = decodePath(encodedPath)
      expect(decodedPath).to.be.deep.eq([
        { token0: tokenAddrs[0], token1: tokenAddrs[1], fee: FeeAmount.MEDIUM },
        { token0: tokenAddrs[1], token1: tokenAddrs[2], fee: FeeAmount.MEDIUM },
      ])
    })

    it("pops the front item from the path", async () => {
      const encodedPath = encodePath(tokenAddrs, fees)
      const { popped, rest } = popFromPath(encodedPath)

      // the popped element is the first one
      const decodedOne = decodeOne(Buffer.from(popped.slice(2), 'hex'), 0)
      expect(decodedOne).to.be.deep.eq({ token0: tokenAddrs[0], token1: tokenAddrs[1], fee: FeeAmount.MEDIUM })

      // the rest also matches
      const decodedPath = decodePath(rest)
      expect(decodedPath).to.be.deep.eq([{ token0: tokenAddrs[1], token1: tokenAddrs[2], fee: FeeAmount.MEDIUM }])
    })
  })

})
