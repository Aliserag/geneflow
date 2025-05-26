const hre = require("hardhat");

async function main() {
  console.log("Deploying GeneFlowEncryptedData contract to Nero testnet...");

  const GeneFlowEncryptedData = await hre.ethers.getContractFactory("GeneFlowEncryptedData");
  const geneFlowEncryptedData = await GeneFlowEncryptedData.deploy();

  await geneFlowEncryptedData.waitForDeployment();
  const address = await geneFlowEncryptedData.getAddress();

  console.log(`GeneFlowEncryptedData deployed to Nero testnet at: ${address}`);
  console.log(`NEXT_PUBLIC_NERO_CONTRACT_ADDRESS=${address}`);
  
  // Save the contract address to a file
  const fs = require("fs");
  const path = require("path");
  
  const deploymentInfo = {
    nero: {
      contractAddress: address,
      deploymentTime: new Date().toISOString(),
      network: "nero",
      chainId: 689
    }
  };
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Write deployment info to a JSON file
  fs.writeFileSync(
    path.join(deploymentsDir, "nero-deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment information saved to deployments/nero-deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 