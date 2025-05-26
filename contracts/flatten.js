// Script to flatten contract for verification
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Flattening GeneFlowEncryptedData contract...');

// Make sure the file path is correct
const contractPath = path.resolve(__dirname, 'contracts/GeneFlowEncryptedData.sol');

if (!fs.existsSync(contractPath)) {
  console.error(`Contract not found at ${contractPath}`);
  process.exit(1);
}

try {
  // Execute the hardhat flatten command
  const flattenedCode = execSync(
    `npx hardhat flatten ${contractPath}`,
    { encoding: 'utf8' }
  );
  
  // Process the flattened code to remove duplicate SPDX license identifiers
  // and other duplications that might cause verification issues
  let processedCode = flattenedCode;
  
  // Remove all but the first SPDX license identifier
  const spdxPattern = /\/\/ SPDX-License-Identifier: .+\n/g;
  const spdxMatches = processedCode.match(spdxPattern) || [];
  
  if (spdxMatches.length > 0) {
    const firstSpdx = spdxMatches[0];
    // Remove all SPDX license identifiers
    processedCode = processedCode.replace(spdxPattern, '');
    // Add back the first one
    processedCode = firstSpdx + processedCode;
    
    // Remove duplicate pragma statements
    const pragmaPattern = /pragma solidity .+?\n/g;
    const pragmaMatches = processedCode.match(pragmaPattern) || [];
    
    if (pragmaMatches.length > 0) {
      const firstPragma = pragmaMatches[0];
      // Remove all pragma statements
      processedCode = processedCode.replace(pragmaPattern, '');
      // Add back the first one after the SPDX identifier
      processedCode = firstSpdx + firstPragma + processedCode.replace(firstSpdx, '');
    }
  }
  
  // Save the flattened contract to a file
  fs.writeFileSync('flattened.sol', processedCode);
  
  console.log('Contract flattened successfully. Saved to flattened.sol');
  console.log('Use this file for contract verification on NERO testnet explorer.');
  
} catch (error) {
  console.error('Error flattening contract:', error.message);
  process.exit(1);
} 