import { waffle, ethers } from 'hardhat'
import { FeeAmount } from './shared/constants'

import { expect } from './shared/expect'

import { PathTest } from '../typechain'
import { decodePath, encodePath } from './shared/path'

import snapshotGasCost from './shared/snapshotGasCost'
import { constants } from 'ethers'

const factory = constants.AddressZero

describe('Path', () => {
  const wallets = waffle.provider.getWallets()

  let path: PathTest

  let tokenAddresses = [
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

  it('js encoding works as expected', async () => {
    let expectedPath =
      '0x' +
      tokenAddresses
        .slice(0, 2)
        .map((tokenAddress) => tokenAddress.slice(2).toLowerCase())
        .join('000bb8')
    expect(encodePath(tokenAddresses.slice(0, 2), fees.slice(0, 1))).to.eq(expectedPath)

    expectedPath = '0x' + tokenAddresses.map((tokenAddress) => tokenAddress.slice(2).toLowerCase()).join('000bb8')
    expect(encodePath(tokenAddresses, fees)).to.eq(expectedPath)
  })

  it('js decoding works as expected', async () => {
    const encodedPath = encodePath(tokenAddresses, fees)
    const [decodedTokens, decodedFees] = decodePath(encodedPath)
    expect(decodedTokens).to.deep.eq(tokenAddresses)
    expect(decodedFees).to.deep.eq(fees)
  })

  describe('#hasPairs / #decode #skipToken', () => {
    const encodedPath = encodePath(tokenAddresses, fees)

    it('works on first pair', async () => {
      expect(await path.hasPairs(encodedPath)).to.be.true

      const { tokenA, tokenB, fee } = await path.decodeFirstPair(encodedPath)
      expect(tokenA).to.be.eq(tokenAddresses[0])
      expect(tokenB).to.be.eq(tokenAddresses[1])
      expect(fee).to.be.eq(FeeAmount.MEDIUM)
    })

    const offset = 20 + 3

    it('skips 1 item', async () => {
      const skipped = await path.skipToken(encodedPath)
      expect(skipped).to.be.eq('0x' + encodedPath.slice(2 + offset * 2))
      expect(await path.hasPairs(skipped)).to.be.false

      const { tokenA, tokenB, fee } = await path.decodeFirstPair(skipped)
      expect(tokenA).to.be.eq(tokenAddresses[1])
      expect(tokenB).to.be.eq(tokenAddresses[2])
      expect(fee).to.be.eq(FeeAmount.MEDIUM)
    })
  })

  it('gas cost', async () => {
    await snapshotGasCost(
      path.getGasCostOfDecodeFirsPair(encodePath([tokenAddresses[0], tokenAddresses[1]], [FeeAmount.MEDIUM]), factory)
    )
  })
})
