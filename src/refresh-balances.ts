import 'dotenv/config';
import { createRailgunWallet, stopRailgunEngine } from '@railgun-community/wallet';
import { TEST_ENCRYPTION_KEY, TEST_MNEMONIC, TEST_WALLET_SOURCE, TEST_POI_NODE_URL, TEST_RPC_URL } from './constants';
import { initializeEngine } from './lib/engine-init';
import { loadEngineProvider } from './lib/engine';
import { setupBalanceCallbacks, runBalancePoller, waitForBalancesLoaded, displaySpendableBalances } from './lib/balance';

async function main(): Promise<void> {
  // Start RAILGUN Engine with scanning enabled
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    dbPath: './engine.db',
    artifactsPath: './artifacts',
    ppoiNodes: [TEST_POI_NODE_URL],
    skipMerkletreeScans: false,
  });

  // Connect network provider (Sepolia by default from constants)
  await loadEngineProvider(TEST_RPC_URL);

  // Wire callbacks for scan progress and balance updates
  setupBalanceCallbacks();

  // Create/load Railgun wallet
  const railgunWallet = await createRailgunWallet(
    TEST_ENCRYPTION_KEY,
    TEST_MNEMONIC,
    null,
  );
  console.log('Railgun wallet ID:', railgunWallet.id);

  // Start poller for just this wallet. Wait for one cycle, then display spendable balances.
  await runBalancePoller([railgunWallet.id]);
  await waitForBalancesLoaded();
  displaySpendableBalances();
}

process.on('SIGINT', async () => {
  await stopRailgunEngine();
  process.exit(0);
});

main()
  .catch(async (e) => {
    console.error(e);
    await stopRailgunEngine();
    process.exit(1);
  })
  .finally(async () => {
    await stopRailgunEngine();
    process.exit(1);
  });