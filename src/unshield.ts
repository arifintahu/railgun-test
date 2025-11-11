import 'dotenv/config';
import { Contract, parseUnits, type BigNumberish } from 'ethers';

import {
  stopRailgunEngine,
  createRailgunWallet,
  gasEstimateForUnprovenUnshield,
  generateUnshieldProof,
  populateProvedUnshield,
} from '@railgun-community/wallet';

import { calculateGasPrice, TXIDVersion, type RailgunERC20AmountRecipient } from '@railgun-community/shared-models';

import { TEST_MNEMONIC, TEST_NETWORK, TEST_RPC_URL, TEST_ENCRYPTION_KEY, TEST_WALLET_SOURCE, TEST_POI_NODE_URL, TEST_TOKEN } from './constants';
import { loadEngineProvider } from './lib/engine';
import { initializeEngine } from './lib/engine-init';
import { getProviderWallet } from './lib/provider';
import { getGasDetailsForTransaction } from './lib/gas';
import { setupNodeGroth16 } from './lib/prover';

async function main(): Promise<void> {
  const { provider, wallet } = getProviderWallet();
  console.log('Provider:', provider);

  console.log('Starting engine...');
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    dbPath: './engine.db',
    artifactsPath: './artifacts',
    ppoiNodes: [TEST_POI_NODE_URL],
    skipMerkletreeScans: false,
  });
  console.log('Engine started.');

  console.log('Connecting to Sepolia...');
  await loadEngineProvider(TEST_RPC_URL);
  console.log('Connected to Sepolia.');

  // Setup Groth16 prover for Node.js
  await setupNodeGroth16();

  // Create/load Railgun wallet
  const encryptionKey = TEST_ENCRYPTION_KEY;
  const railgunWallet = await createRailgunWallet(encryptionKey, TEST_MNEMONIC, null);
  console.log('Railgun wallet:', railgunWallet.railgunAddress);

  // Read token decimals and desired unshield amount (1 token by default)
  const erc20 = new Contract(
    TEST_TOKEN,
    [
      'function decimals() view returns (uint8)',
    ],
    provider,
  );
  const decimals: number = await erc20.decimals();
  const amount: BigNumberish = parseUnits('1', decimals);

  // Unshield to public wallet
  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    {
      tokenAddress: TEST_TOKEN,
      amount,
      recipientAddress: wallet.address,
    },
  ];

  // Prepare original gas details for estimation
  const originalGasDetails = await getGasDetailsForTransaction(provider);
  const sendWithPublicWallet = true;
  const feeTokenDetails = undefined; // not using relayer/broadcaster fee token

  console.log('Estimating gas for unshield...');
  const { gasEstimate } = await gasEstimateForUnprovenUnshield(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    railgunWallet.id,
    encryptionKey,
    erc20AmountRecipients,
    [],
    originalGasDetails,
    feeTokenDetails,
    sendWithPublicWallet,
  );
  console.log('Unshield gasEstimate:', gasEstimate);

  // Generate proof
  console.log('Generating unshield proof...');
  const progressCallback = (progress: number) => {
    console.log('Unshield ERC20 Proof progress:', progress);
  };
  // Calculate transaction gas details using estimated gas
  const txGasDetails = await getGasDetailsForTransaction(provider);
  txGasDetails.gasEstimate = gasEstimate;
  const overallBatchMinGasPrice = await calculateGasPrice(txGasDetails);

  await generateUnshieldProof(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    railgunWallet.id,
    encryptionKey,
    erc20AmountRecipients,
    [],
    feeTokenDetails,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    progressCallback,
  );
  console.log('Unshield proof generated.');

  // Populate transaction
  console.log('Populating unshield transaction...');
  const { transaction } = await populateProvedUnshield(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    railgunWallet.id,
    erc20AmountRecipients,
    [],
    feeTokenDetails,
    sendWithPublicWallet,
    overallBatchMinGasPrice,
    txGasDetails,
  );

  console.log('Broadcasting unshield tx…');
  const unshieldTx = await wallet.sendTransaction(transaction);
  console.log('Unshield tx hash:', unshieldTx.hash);
  await unshieldTx.wait();
  console.log('✅ Unshielded ERC20 successfully.');
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