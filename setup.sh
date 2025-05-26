#!/bin/bash
# Setup script for GeneFlow project

echo "=== GeneFlow Project Setup ==="
echo "This script will help you set up the GeneFlow project and connect to NERO testnet."

# Install dependencies
echo -e "\n1. Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo -e "\n2. Creating .env file..."
  cat > .env << EOF
# GeneFlow Environment Configuration
FLOW_RPC_URL=https://testnet.evm.nodes.onflow.org
NERO_RPC_URL=https://rpc-testnet.nerochain.io
# Add your private key here (without the 0x prefix)
PRIVATE_KEY=
EOF
  echo "Created .env file. Please edit it to add your private key."
else
  echo -e "\n2. .env file already exists. Skipping creation."
fi

# Compile contracts
echo -e "\n3. Compiling smart contracts..."
npx hardhat compile

# Generate flattened contract for verification
echo -e "\n4. Generating flattened contract for verification..."
node contracts/flatten.js

echo -e "\n=== Setup Complete ==="
echo "To deploy the contract to NERO testnet:"
echo "1. Make sure you have NERO testnet tokens from https://faucet.nerochain.io"
echo "2. Add your private key to the .env file"
echo "3. Run: node contracts/deploy-nero.js"
echo ""
echo "To start the development server:"
echo "npm run dev"
echo ""
echo "GeneFlow is configured to use the following contract on NERO testnet:"
echo "0x344eb6338E62d207077E53C525bAA6B2A5Bb17ba" 