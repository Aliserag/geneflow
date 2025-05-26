const { ethers } = require("ethers");
require("dotenv").config();

// Use only the private key from environment
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error("ERROR: Private key not found in environment variables");
  process.exit(1);
}

try {
  // Add 0x prefix if not present
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  
  // Create a wallet from the private key
  const wallet = new ethers.Wallet(formattedKey);

  console.log("Wallet address:", wallet.address);
  console.log("This address will be used to deploy on Nero testnet.");
} catch (error) {
  console.error("Error creating wallet:", error.message);
  console.log("Please check that your private key is valid and properly formatted.");
} 