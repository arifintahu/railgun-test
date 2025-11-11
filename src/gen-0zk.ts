import 'dotenv/config';
import { ethers } from 'ethers';
import {
  createRailgunWallet,
  walletForID,
  getWalletShareableViewingKey,
  stopRailgunEngine,
} from '@railgun-community/wallet';
import { NETWORK_CONFIG } from '@railgun-community/shared-models';
import { initializeEngine } from './lib/engine-init';
import { loadEngineProvider } from './lib/engine';
import { 
    TEST_ENCRYPTION_KEY,
    TEST_NETWORK,
    TEST_RPC_URL,
    TEST_MNEMONIC,
    TEST_WALLET_SOURCE,
} from './constants';


// ---------- BOOTSTRAP ----------
async function main() {
  // Optional external provider instance (not required by our engine loader)
  const provider = new ethers.JsonRpcProvider(TEST_RPC_URL);
  void provider; // provider shown for parity with example; engine uses URL string

  const ACCOUNT_INDEX = Number(process.env.ACCOUNT_INDEX ?? '0');

  // Initialize RAILGUN engine with wallet source and scanning enabled
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    skipMerkletreeScans: false,
  });

  // Connect network provider
  await loadEngineProvider(TEST_RPC_URL);

  // Create/load a Railgun wallet
  const { id: railgunWalletID } = await createRailgunWallet(
    TEST_ENCRYPTION_KEY,
    TEST_MNEMONIC,
    null,
    ACCOUNT_INDEX,
  );

  // Derive the 0zk address for the target network
  const chain = NETWORK_CONFIG[TEST_NETWORK].chain;
  const wallet = walletForID(railgunWalletID);
  const zerozkAddress = wallet.getAddress(chain);

  // Derive a shareable viewing key (safe to share; read-only)
  const viewingKey = await getWalletShareableViewingKey(railgunWalletID);

  // Print what you need to wire into smart account workflows
  console.log(
    JSON.stringify(
      {
        zerozkAddress, // use as private recipient when shielding
        viewingKey, // safe to share for read-only monitoring
        accountIndex: ACCOUNT_INDEX,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(async (err) => {
    console.error(err);
    await stopRailgunEngine();
    process.exit(1);
  })
  .finally(async () => {
    await stopRailgunEngine();
    process.exit(0);
  });