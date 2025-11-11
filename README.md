Railgun Test Project

Summary
- Demonstrates RAILGUN Engine + Wallet usage on Sepolia.
- Includes scripts for shielding, transfers, unshielding, balance refresh, POI generation, and 0zk address/viewing key derivation.

Requirements
- Node.js 18+ and npm.
- A public RPC endpoint for Sepolia.

Setup
- Copy env and edit values:
  - PowerShell: `Copy-Item .env.example .env`
  - Set at minimum `RAILGUN_TEST_RPC` in `.env`.

Install
- `npm install`

Quick Actions
- Build TypeScript: `npm run build`
- Generate 0zk address + viewing key: `npm run gen-0zk`
  - Optional per-run RPC override: `$env:RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"`
- Refresh balances and scan: `npm run refresh`
- Shield base token: `npm run shield`
- Private transfer: `npm run transfer`
- Unshield to 0x: `npm run unshield`
- Generate POIs (receive/spent): `npm run pois`

Configuration
- `RAILGUN_TEST_RPC`: RPC used by core scripts (refresh, shield, transfer, unshield, pois).
- `RAILGUN_NETWORK_ID`: Optional network ID (defaults to Sepolia `11155111`).
- `RAILGUN_TEST_MNEMONIC`: Optional wallet mnemonic for core scripts (defaults to a test phrase).
- `RAILGUN_WALLET_SOURCE`: Wallet source label for engine init.
- `RAILGUN_DB_PATH`, `RAILGUN_ARTIFACTS_DIR`: Local engine storage paths.
- `RAILGUN_POI_NODE_URL`: PPOI aggregator (defaults provided).
- `RPC_URL`: RPC used by `gen-0zk` (defaults to `https://ethereum-sepolia-rpc.publicnode.com`).

Outputs
- `npm run gen-0zk` prints JSON:
  - `zerozkAddress`: private recipient address for shielding/receiving.
  - `viewingKey`: shareable viewing key for read-only monitoring.

Notes
- `gen-0zk` currently derives a fresh mnemonic; update `src/gen-0zk.ts` if you prefer reading a mnemonic from environment or file.