const fs = require('fs');
const path = require('path');

// Contract addresses
const NERO_CONTRACT_ADDRESS = '0x344eb6338E62d207077E53C525bAA6B2A5Bb17ba';

// Path to .env.local file
const envPath = path.join(process.cwd(), '.env.local');

// Check if .env.local exists
const envExists = fs.existsSync(envPath);

// Prepare environment variables
const envContent = envExists 
  ? fs.readFileSync(envPath, 'utf8') 
  : '';

// Function to update an environment variable
function updateEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*`, 'm');
  const newLine = `${key}=${value}`;
  
  if (regex.test(content)) {
    return content.replace(regex, newLine);
  } else {
    return content + (content.endsWith('\n') ? '' : '\n') + newLine + '\n';
  }
}

// Update NERO contract address
let updatedContent = updateEnvVar(envContent, 'NEXT_PUBLIC_NERO_CONTRACT_ADDRESS', NERO_CONTRACT_ADDRESS);

// Write updated content back to .env.local
fs.writeFileSync(envPath, updatedContent);

console.log(`
Environment variables updated in .env.local:

NEXT_PUBLIC_NERO_CONTRACT_ADDRESS=${NERO_CONTRACT_ADDRESS}

To use this contract in your application, import the address from the networks.ts configuration.
`); 