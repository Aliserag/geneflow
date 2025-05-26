/**
 * Contract configuration for different networks
 */

const contractConfig = {
  // NERO Testnet
  nero: {
    contractAddress: "0x344eb6338E62d207077E53C525bAA6B2A5Bb17ba",
    chainId: 689,
    rpcUrl: "https://rpc-testnet.nerochain.io",
    blockExplorer: "https://testnet.neroscan.io",
    networkName: "NERO Testnet"
  },
  // Flow EVM Testnet
  flow: {
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    chainId: 545,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://testnet.evm.nodes.onflow.org",
    blockExplorer: "https://testnet.flowdiver.io",
    networkName: "Flow EVM Testnet"
  }
};

export default contractConfig; 