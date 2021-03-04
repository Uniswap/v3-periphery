import { BigNumber, BigNumberish, constants, Signature, Wallet } from 'ethers'
import { splitSignature } from 'ethers/lib/utils'
import { TestERC20 } from '../../typechain'

export async function getPermitSignature(
  wallet: Wallet,
  token: TestERC20,
  spender: string,
  value: BigNumberish = constants.MaxUint256,
  nonce?: BigNumberish,
  deadline = constants.MaxUint256
): Promise<Signature> {
  nonce = nonce ?? (await token.nonces(wallet.address))

  return splitSignature(
    await wallet._signTypedData(
      {
        name: 'Test ERC20',
        version: '1',
        chainId: 1,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}
