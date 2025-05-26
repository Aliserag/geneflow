/**
 * Utility functions for network operations and MetaMask integration
 */
import contractConfig from '../contract-config';

/**
 * Adds the NERO network to MetaMask
 * @returns {Promise<boolean>} Whether the operation was successful
 */
export const addNeroNetwork = async () => {
  if (!window.ethereum) {
    console.error("MetaMask is not installed");
    return false;
  }

  try {
    const neroConfig = contractConfig.nero;
    
    // Request to add the NERO testnet to MetaMask
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: `0x${neroConfig.chainId.toString(16)}`, // Hex representation of 689
          chainName: neroConfig.networkName,
          nativeCurrency: {
            name: 'NERO',
            symbol: 'NERO',
            decimals: 18,
          },
          rpcUrls: [neroConfig.rpcUrl],
          blockExplorerUrls: [neroConfig.blockExplorer],
        },
      ],
    });
    
    console.log("NERO network added successfully");
    return true;
  } catch (error) {
    console.error("Failed to add NERO network to MetaMask:", error.message);
    return false;
  }
};

/**
 * Switches to the NERO network in MetaMask
 * @returns {Promise<boolean>} Whether the operation was successful
 */
export const switchToNeroNetwork = async () => {
  if (!window.ethereum) {
    console.error("MetaMask is not installed");
    return false;
  }

  const neroChainId = `0x${contractConfig.nero.chainId.toString(16)}`; // Hex representation of 689

  try {
    // Try to switch to the NERO network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: neroChainId }],
    });
    
    console.log("Switched to NERO network");
    return true;
  } catch (error) {
    // If the chain hasn't been added to MetaMask, add it
    if (error.code === 4902) {
      return await addNeroNetwork();
    }
    
    console.error("Failed to switch to NERO network:", error.message);
    return false;
  }
};

/**
 * Connects to MetaMask and returns the connected account
 * @returns {Promise<string|null>} The connected account address or null if connection failed
 */
export const connectMetaMask = async () => {
  if (!window.ethereum) {
    console.error("MetaMask is not installed");
    return null;
  }
  
  try {
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    console.log("Connected to MetaMask account:", accounts[0]);
    return accounts[0];
  } catch (error) {
    console.error("User rejected the connection request:", error.message);
    return null;
  }
};

/**
 * Checks if MetaMask is connected to the NERO network
 * @returns {Promise<boolean>} Whether connected to NERO network
 */
export const isConnectedToNero = async () => {
  if (!window.ethereum) return false;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === `0x${contractConfig.nero.chainId.toString(16)}`; // NERO testnet chainId
  } catch (error) {
    console.error("Error checking network:", error.message);
    return false;
  }
}; 