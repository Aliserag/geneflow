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
  // Flow EVM Testnet (legacy)
  flow: {
    contractAddress: "0xb5060b6a8a2C59f2B161F7AD2591fCafDEbfB00c",
    chainId: 12341234,
    rpcUrl: "https://testnet.evm.nodes.onflow.org",
    blockExplorer: "https://testnet.flowdiver.io",
    networkName: "Flow EVM Testnet"
  }
};

export default contractConfig; 