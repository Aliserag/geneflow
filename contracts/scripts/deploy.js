const hre = require("hardhat");

async function main() {
  console.log("Deploying GeneFlowEncryptedData contract...");

  const GeneFlowEncryptedData = await hre.ethers.getContractFactory("GeneFlowEncryptedData");
  const geneFlowEncryptedData = await GeneFlowEncryptedData.deploy();

  await geneFlowEncryptedData.waitForDeployment();
  const address = await geneFlowEncryptedData.getAddress();

  console.log(`GeneFlowEncryptedData deployed to: ${address}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
