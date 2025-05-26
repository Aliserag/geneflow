/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Use process.env or default values for RPC URLs
const FLOW_EVM_RPC_URL = process.env.FLOW_RPC_URL || "https://testnet.evm.nodes.onflow.org";
const NERO_RPC_URL = process.env.NERO_RPC_URL || "https://rpc-testnet.nerochain.io";

// Get private key from environment only
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("ERROR: Private key not found in environment variables");
}

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: false
    }
  },
  networks: {
    // Flow EVM testnet
    flowEvm: {
      url: FLOW_EVM_RPC_URL,
      accounts: [PRIVATE_KEY],
      gasPrice: 0, // Flow EVM typically doesn't use gas pricing the same way
      chainId: 12341234,
    },
    // Nero testnet
    nero: {
      url: NERO_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 689, // Nero testnet chain ID
    },
    // Local development network
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      // No API key needed for NERO testnet
      nero: "NO_API_KEY_REQUIRED"
    },
    customChains: [
      {
        network: "nero",
        chainId: 689,
        urls: {
          apiURL: "https://testnet.neroscan.io/api",
          browserURL: "https://testnet.neroscan.io"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts/contracts",
    tests: "./contracts/test",
    cache: "./contracts/cache",
    artifacts: "./contracts/artifacts"
  }
}; 