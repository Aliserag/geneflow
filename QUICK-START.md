# GeneFlow Quick Start Guide

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/geneflow.git
   cd geneflow
   ```

2. Run the setup script:
   ```
   ./setup.sh
   ```
   This will install dependencies, create a `.env` file, and compile the contracts.

3. Start the development server:
   ```
   npm run dev
   ```

4. Visit `http://localhost:3000` in your browser.

## Using the App with NERO Testnet

GeneFlow is configured to work with the NERO testnet by default, with a contract already deployed at:
`0x344eb6338E62d207077E53C525bAA6B2A5Bb17ba`

### Prerequisites

1. Install [MetaMask](https://metamask.io/download/) browser extension
2. Get NERO testnet tokens from the [NERO Faucet](https://faucet.nerochain.io)

### Connecting to NERO Testnet

1. Open the app in your browser
2. Click "Connect Wallet"
3. MetaMask will prompt you to:
   - Connect to the app
   - Switch to the NERO network (the app will automatically add it to MetaMask)

### Storing Genetic Data

1. After connecting your wallet, upload your genetic data file
   - You can use the "Generate Sample Data" option for testing
2. Click "Encrypt and Store"
3. Approve the transaction in MetaMask

### Retrieving and Analyzing Data

1. If you already have data stored, the app will detect it when you connect
2. Click "Retrieve and Decrypt" to load your data
3. Use the analysis tools to explore your genetic information

## Troubleshooting

### MetaMask Network Issues

If you have trouble connecting to NERO testnet, try adding it manually in MetaMask:
- Network Name: NERO Testnet
- RPC URL: https://rpc-testnet.nerochain.io
- Chain ID: 689
- Currency Symbol: NERO
- Block Explorer: https://testnet.neroscan.io

### Contract Issues

If you need to deploy a new contract:
1. Add your private key to the `.env` file
2. Run: `node contracts/deploy-nero.js`
3. The new contract address will be saved in `src/contract-config.js`

## Resources

- [NERO Chain Documentation](https://docs.nerochain.io/)
- [MetaMask Documentation](https://docs.metamask.io/)
- [GeneFlow GitHub Repository](https://github.com/yourusername/geneflow) 