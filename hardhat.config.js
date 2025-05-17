/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Use process.env or default values for private key and RPC URL
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const FLOW_EVM_RPC_URL = process.env.FLOW_RPC_URL || "https://testnet.evm.nodes.onflow.org";

module.exports = {
  solidity: "0.8.19",
  networks: {
    // Flow EVM testnet
    flowEvm: {
      url: FLOW_EVM_RPC_URL,
      accounts: [PRIVATE_KEY],
      gasPrice: 0, // Flow EVM typically doesn't use gas pricing the same way
      chainId: 12341234,
    },
    // Local development network
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./src/contracts",
    tests: "./src/test",
    cache: "./cache",
    artifacts: "./src/artifacts"
  }
}; 