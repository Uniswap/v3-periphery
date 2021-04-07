import 'hardhat-typechain'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 9_999_999,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
    },
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/NonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/MockTimeNonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
    },
  },
}
