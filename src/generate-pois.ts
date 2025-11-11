import 'dotenv/config';
import {
  createRailgunWallet,
  refreshBalances,
  awaitWalletScan,
  generatePOIsForWallet,
  getChainTxidsStillPendingSpentPOIs,
  getSpendableReceivedChainTxids,
  setOnWalletPOIProofProgressCallback,
  setOnTXIDMerkletreeScanCallback,
  setOnUTXOMerkletreeScanCallback,
  stopRailgunEngine,
} from '@railgun-community/wallet';
import { TXIDVersion, NETWORK_CONFIG, MerkletreeScanUpdateEvent } from '@railgun-community/shared-models';
import { initializeEngine } from './lib/engine-init';
import { loadEngineProvider } from './lib/engine';
import {
  TEST_ENCRYPTION_KEY,
  TEST_MNEMONIC,
  TEST_WALLET_SOURCE,
  TEST_RPC_URL,
  TEST_POI_NODE_URL,
  TEST_NETWORK,
} from './constants';

const logScanUpdate = (label: string) => (update: MerkletreeScanUpdateEvent) => {
  const { chain, progress, scanStatus } = update;
  console.log(`[${label}] chain=${chain.type}:${chain.id} progress=${progress} status=${scanStatus}`);
};

const logPOIProgress = ({
  status,
  txidVersion,
  chain,
  progress,
  listKey,
  txid,
  railgunTxid,
  index,
  totalCount,
  errMessage,
}: any) => {
  const ver = txidVersion === TXIDVersion.V3_PoseidonMerkle ? 'V3' : 'V2';
  const chainStr = `${chain.type}:${chain.id}`;
  const base = `[POI] status=${status} ver=${ver} chain=${chainStr} progress=${progress} count=${index}/${totalCount} list=${listKey}`;
  if (errMessage) {
    console.warn(`${base} error=${errMessage}`);
  } else if (txid || railgunTxid) {
    console.log(`${base} txid=${txid ?? railgunTxid}`);
  } else {
    console.log(base);
  }
};

async function main() {
  console.log('Initializing RAILGUN engine...');
  // Configure engine with POI node and enable merkletree scans.
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    skipMerkletreeScans: false,
    ppoiNodes: TEST_POI_NODE_URL ? [TEST_POI_NODE_URL] : undefined,
  });

  console.log('Loading engine provider...');
  const chain = NETWORK_CONFIG[TEST_NETWORK].chain;
  await loadEngineProvider(TEST_RPC_URL);

  // Wire scan callbacks for observability.
  setOnTXIDMerkletreeScanCallback(logScanUpdate('TXID-Scan'));
  setOnUTXOMerkletreeScanCallback(logScanUpdate('UTXO-Scan'));

  // Wire POI proof progress callback.
  setOnWalletPOIProofProgressCallback(logPOIProgress);

  console.log('Creating wallet...');
  const wallet = await createRailgunWallet(TEST_ENCRYPTION_KEY, TEST_MNEMONIC, null);
  console.log(`Wallet created: id=${wallet.id} address=${wallet.railgunAddress}`);

  console.log('Starting balance refresh and wallet scan...');
  await refreshBalances(chain, [wallet.id]);
  await awaitWalletScan(wallet.id, chain);
  console.log('Wallet scan complete. Generating POIs for all transactions...');

  // Generate POIs across all available TXID versions for the wallet.
  await generatePOIsForWallet(TEST_NETWORK, wallet.id);

  // Summarize statuses for V2 and V3 (if supported by chain).
  const versions: TXIDVersion[] = [TXIDVersion.V2_PoseidonMerkle, TXIDVersion.V3_PoseidonMerkle];
  for (const version of versions) {
    try {
      const pendingSpent = await getChainTxidsStillPendingSpentPOIs(version, TEST_NETWORK, wallet.id);
      const spendableReceived = await getSpendableReceivedChainTxids(version, TEST_NETWORK, wallet.id);
      console.log(`\n=== POI Summary (${version === TXIDVersion.V3_PoseidonMerkle ? 'V3' : 'V2'}) ===`);
      console.log(`Pending Spent POIs (${pendingSpent.length}):`);
      for (const txid of pendingSpent) console.log(` - ${txid}`);
      console.log(`Spendable Received TXIDs (${spendableReceived.length}):`);
      for (const txid of spendableReceived) console.log(` - ${txid}`);
    } catch (err) {
      console.warn(`POI summary unavailable for version ${version}:`, (err as Error)?.message ?? err);
    }
  }

  console.log('\nPOI generation complete.');
}

main()
  .catch((err) => {
    console.error('POI generation failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    // Ensure engine shuts down cleanly.
    try {
      await stopRailgunEngine();
    } catch {}
    process.exit(0);
  });

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Stopping engine...');
  try {
    await stopRailgunEngine();
  } finally {
    process.exit(0);
  }
});