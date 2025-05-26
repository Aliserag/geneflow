export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  contractAddress: string;
  isTestnet: boolean;
}

// Helper function to get environment variables with fallbacks
const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env[key] || fallback;
  } else {
    // Client-side - use NEXT_PUBLIC_ prefixed variables
    return (window as any).__ENV__?.[key] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           fallback;
  }
};

// Network configurations
const networks: Record<string, NetworkConfig> = {
  // Flow EVM Testnet
  flowEvm: {
    chainId: 12341234,
    name: 'Flow EVM Testnet',
    rpcUrl: 'https://testnet.evm.nodes.onflow.org',
    blockExplorer: 'https://testnet.flowdiver.io',
    contractAddress: getEnvVar('CONTRACT_ADDRESS', ''), // Will be filled after deployment
    isTestnet: true,
  },
  
  // Nero Testnet
  nero: {
    chainId: 689,
    name: 'NERO Testnet',
    rpcUrl: 'https://rpc-testnet.nerochain.io',
    blockExplorer: 'https://testnet.neroscan.io',
    contractAddress: getEnvVar('NERO_CONTRACT_ADDRESS', ''), // Will be filled after deployment
    isTestnet: true,
  }
};

export default networks;

// Helper functions to work with networks
export const getNetworkByChainId = (chainId: number): NetworkConfig | undefined => {
  return Object.values(networks).find(network => network.chainId === chainId);
};

export const getSupportedNetworkIds = (): number[] => {
  return Object.values(networks).map(network => network.chainId);
};

export const addNetwork = async (chainId: number): Promise<boolean> => {
  const network = getNetworkByChainId(chainId);
  if (!network || !window.ethereum) return false;
  
  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${chainId.toString(16)}`,
          chainName: network.name,
          nativeCurrency: {
            name: chainId === 689 ? 'NERO' : 'Ether',
            symbol: chainId === 689 ? 'NERO' : 'ETH',
            decimals: 18,
          },
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.blockExplorer],
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Error adding network to MetaMask', error);
    return false;
  }
};

export const switchNetwork = async (chainId: number): Promise<boolean> => {
  if (!window.ethereum) return false;
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    // Error code 4902 means the chain hasn't been added yet
    if (error.code === 4902) {
      return addNetwork(chainId);
    }
    console.error('Error switching network in MetaMask', error);
    return false;
  }
}; 