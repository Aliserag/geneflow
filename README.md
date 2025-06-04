# Geneflow Backend - Type 0 Gasless Transactions

A backend service that integrates with the Paymaster API using UserOpSDK to enable type 0 gasless transactions on the Nero testnet.

## Features

- **Type 0 Gasless Transactions**: Explicitly defined gasless transactions using `type: 0`
- **Paymaster Integration**: Uses `pm_sponsor_userop` with proper context object
- **WebSocket Support**: Real-time communication for blockchain websites
- **Gas Estimation**: Automatic gas estimation for user operations
- **Transaction Monitoring**: Real-time transaction status updates

## Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env and add your PAYMASTER_API_KEY
```

3. **Start the server**:
```bash
npm run dev
```

## API Endpoints

### Execute Gasless Transaction (Type 0)
```
POST /api/transactions/execute-gasless
```

**Request Body**:
```json
{
  "sender": "0x...",
  "target": "0x...",
  "value": "0x0",
  "data": "0x",
  "privateKey": "0x..."
}
```

**Response**:
````json
{
  "success": true,
  "type": 0,
  "gasless": true,
  "transactionHash": "0x...",
  "userOpHash": "0x..
