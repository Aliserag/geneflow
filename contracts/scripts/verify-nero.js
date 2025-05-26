const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting contract verification on NERO testnet...");
  
  // Get deployment information
  const deploymentPath = path.join(__dirname, "../deployments/nero-deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Deployment information not found. Please deploy the contract first.");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deploymentData.nero.contractAddress;
  
  console.log(`Verifying contract at address: ${contractAddress}`);
  
  try {
    // Verify the contract
    await hre.run("verify:verify", {
      address: contractAddress,
      contract: "contracts/GeneFlowEncryptedData.sol:GeneFlowEncryptedData",
      constructorArguments: [],
      network: "nero"
    });
    
    console.log("Contract verification successful!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 