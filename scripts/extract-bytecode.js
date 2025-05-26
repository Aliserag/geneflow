const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // Contract address from the deployment
    const contractAddress = "0x344eb6338E62d207077E53C525bAA6B2A5Bb17ba";
    
    // Connect to the NERO testnet
    const provider = new ethers.JsonRpcProvider("https://rpc-testnet.nerochain.io");
    
    // Get the deployed bytecode
    console.log(`Fetching bytecode for contract at ${contractAddress}...`);
    const bytecode = await provider.getCode(contractAddress);
    
    if (bytecode === "0x") {
      console.error("Error: No bytecode found at the specified address.");
      process.exit(1);
    }
    
    console.log(`Bytecode length: ${bytecode.length} bytes`);
    
    // Save bytecode to a file
    const bytecodeFile = path.join(__dirname, "../deployed-bytecode.txt");
    fs.writeFileSync(bytecodeFile, bytecode);
    console.log(`Bytecode saved to ${bytecodeFile}`);
    
    // Extract compiler settings directly from hardhat config
    try {
      const hardhatConfigPath = path.join(__dirname, "../hardhat.config.js");
      
      // We can't directly require the config as it might have side effects
      // Instead, we'll extract key information manually
      const configContent = fs.readFileSync(hardhatConfigPath, 'utf8');
      
      // Extract compiler version using regex
      const versionMatch = configContent.match(/solidity:\s*{[\s\S]*?version:\s*"([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : "0.8.26";
      
      // Extract optimizer settings
      const optimizerEnabledMatch = configContent.match(/optimizer:\s*{[\s\S]*?enabled:\s*(true|false)/);
      const optimizerEnabled = optimizerEnabledMatch ? optimizerEnabledMatch[1] === "true" : true;
      
      const optimizerRunsMatch = configContent.match(/runs:\s*(\d+)/);
      const optimizerRuns = optimizerRunsMatch ? parseInt(optimizerRunsMatch[1]) : 200;
      
      // Extract EVM version
      const evmVersionMatch = configContent.match(/evmVersion:\s*"([^"]+)"/);
      const evmVersion = evmVersionMatch ? evmVersionMatch[1] : "paris";
      
      // Extract viaIR setting
      const viaIRMatch = configContent.match(/viaIR:\s*(true|false)/);
      const viaIR = viaIRMatch ? viaIRMatch[1] === "true" : false;
      
      // Create compiler info object
      const compilerInfo = {
        version,
        settings: {
          evmVersion,
          optimizer: {
            enabled: optimizerEnabled,
            runs: optimizerRuns
          },
          viaIR
        }
      };
      
      const compilerInfoFile = path.join(__dirname, "../compiler-settings.json");
      fs.writeFileSync(compilerInfoFile, JSON.stringify(compilerInfo, null, 2));
      console.log(`Compiler settings saved to ${compilerInfoFile}`);
      
      // Get the full solidity version with commit hash
      const solcVersionMap = {
        "0.8.26": "v0.8.26+commit.6cad0df6"
      };
      
      const fullSolcVersion = solcVersionMap[version] || `v${version}`;
      
      // Create a verification guide
      const verificationGuide = `
NERO TESTNET CONTRACT VERIFICATION GUIDE

Contract Address: ${contractAddress}
Contract Name: GeneFlowEncryptedData
Compiler Version: ${fullSolcVersion}
EVM Version: ${evmVersion}
Optimization: ${optimizerEnabled ? 'Enabled' : 'Disabled'}
Optimization Runs: ${optimizerRuns}
viaIR: ${viaIR ? 'true' : 'false'}

VERIFICATION STEPS:
1. Go to https://testnet.neroscan.io/address/${contractAddress}
2. Click on the "Contract" tab
3. Click "Verify & Publish"
4. Fill in the exact settings above
5. Use the exact contract code from flattened.sol

IMPORTANT VERIFICATION NOTES:
- The contract was compiled with Solidity ${fullSolcVersion}
- Optimization: ${optimizerEnabled ? 'Enabled' : 'Disabled'} with ${optimizerRuns} runs
- EVM Version: ${evmVersion}
- viaIR: ${viaIR ? 'Enabled' : 'Disabled'} (IR-based code generation)

If verification fails with bytecode mismatch:
1. Try verifying with optimization turned ${optimizerEnabled ? 'off' : 'on'}
2. Try different EVM versions (paris, london, etc.)
3. Try different optimization runs (e.g., 1, 200, 1000)
4. Try toggling viaIR setting
5. Contact NERO team for manual verification if needed

EXACT COMMAND USED FOR DEPLOYMENT:
npx hardhat run contracts/scripts/deploy-nero.js --network nero
`;
      
      const verificationGuideFile = path.join(__dirname, "../verification-guide.txt");
      fs.writeFileSync(verificationGuideFile, verificationGuide);
      console.log(`Verification guide created at ${verificationGuideFile}`);
      
    } catch (err) {
      console.error("Error extracting compiler information:", err.message);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main(); 