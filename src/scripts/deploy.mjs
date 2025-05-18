// We can use the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment to Flow EVM...");
  
  try {
    console.log("Checking network configuration...");
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    console.log("Deploying GeneFlowEncryptedData contract...");
    
    // Deploy the contract
    const GeneFlowEncryptedData = await ethers.getContractFactory("GeneFlowEncryptedData");
    console.log("Contract factory created, deploying...");
    
    const geneFlowEncryptedData = await GeneFlowEncryptedData.deploy();
    console.log("Deployment transaction sent, waiting for confirmation...");
    
    await geneFlowEncryptedData.waitForDeployment();
    
    const address = await geneFlowEncryptedData.getAddress();
    console.log(`GeneFlowEncryptedData deployed to: ${address}`);
    
    // For verification (once Flow EVM supports it)
    console.log(`Contract deployment completed. Verify with: npx hardhat verify --network flowEvm ${address}`);
    
    // Save to .env.local for frontend
    console.log("You can add this contract address to your frontend configuration:");
    console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
    
    return { contractAddress: address };
  } catch (error) {
    console.error("Deployment failed with error:", error);
    throw error;
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error("Unhandled error in deployment script:", error);
  process.exitCode = 1;
});