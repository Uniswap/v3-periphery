import { ethers } from 'hardhat'
import { expect } from './shared/expect'
import { Base64Test } from '../typechain'

function stringToHex(str: string): string {
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`
}

function base64Encode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64')
}

describe('Base64', () => {
  let base64: Base64Test
  before('deploy test contract', async () => {
    base64 = (await (await ethers.getContractFactory('Base64Test')).deploy()) as Base64Test
  })

  describe('#encode', () => {
    it('is correct for empty bytes', async () => {
      expect(await base64.encode(stringToHex(''))).to.eq('')
    })

    for (const example of [
      'test string',
      'this is a test',
      'alphabet soup',
      'aLpHaBeT',
      'includes\nnewlines',
      '<some html>',
      '😀',
      'f',
      'fo',
      'foo',
      'foob',
      'fooba',
      'foobar',
    ]) {
      it(`works for "${example}"`, async () => {
        expect(await base64.encode(stringToHex(example))).to.eq(base64Encode(example))
      })
    }
  })
})
