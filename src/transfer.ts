import 'dotenv/config';
import { Contract, parseUnits, type BigNumberish } from 'ethers';

import { stopRailgunEngine, createRailgunWallet, refreshBalances, gasEstimateForUnprovenTransfer, generateTransferProof, populateProvedTransfer } from '@railgun-community/wallet';

import { calculateGasPrice, type RailgunERC20AmountRecipient, TXIDVersion, ChainType } from '@railgun-community/shared-models';
import { TEST_RPC_URL, TEST_MNEMONIC, TEST_ERC20_TOKEN_ADDRESS, TEST_SHIELD_AMOUNT, TEST_ENCRYPTION_KEY, TEST_NETWORK, TEST_NETWORK_ID, TEST_WALLET_SOURCE, TEST_POI_NODE_URL } from './constants';
import { initializeEngine } from './lib/engine-init';
import { loadEngineProvider } from './lib/engine';
import { setupNodeGroth16 } from './lib/prover';
import { getProviderWallet } from './lib/provider';
import { getGasDetailsForTransaction } from './lib/gas';

async function main(): Promise<void> {
  const SEPOLIA_RPC_URL = TEST_RPC_URL;
  const SENDER_MNEMONIC = TEST_MNEMONIC;
  const TOKEN_ADDRESS = TEST_ERC20_TOKEN_ADDRESS;
  const AMOUNT = TEST_SHIELD_AMOUNT;

  // recipient can be direct 0zk, or derived from mnemonic
  let recipient0zk = process.env.RECIPIENT_RAILGUN_ADDRESS;

  const { provider, wallet: publicWallet } = getProviderWallet();

  // Start engine
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    dbPath: './engine.db',
    artifactsPath: './artifacts',
    ppoiNodes: [TEST_POI_NODE_URL],
    skipMerkletreeScans: false,
  });

  // Configure Groth16 prover for Node.js environment
  await setupNodeGroth16();

  // Connect Sepolia
  const network = TEST_NETWORK;
  await loadEngineProvider(SEPOLIA_RPC_URL);

  // Create/load sender 0zk
  const encryptionKey = TEST_ENCRYPTION_KEY;
  const senderRailgun = await createRailgunWallet(
    encryptionKey,
    SENDER_MNEMONIC,
    null,
  );
  console.log('Sender 0zk:', senderRailgun.railgunAddress);

  if (!recipient0zk) {
    throw new Error('Set RECIPIENT_RAILGUN_ADDRESS or RECIPIENT_MNEMONIC in .env');
  }
  console.log('Recipient 0zk:', recipient0zk);

  // Ensure balances are synced
  const chain = { type: ChainType.EVM, id: TEST_NETWORK_ID };
  await refreshBalances(chain, [senderRailgun.id]);

  // Read token decimals and amount
  const tokenMeta = new Contract(TOKEN_ADDRESS, ['function decimals() view returns (uint8)'], publicWallet);
  const tokenDecimals: number = await tokenMeta.decimals();
  const sendAmount: BigNumberish = parseUnits(AMOUNT, tokenDecimals);

  const recipients: RailgunERC20AmountRecipient[] = [
    { tokenAddress: TOKEN_ADDRESS, amount: sendAmount, recipientAddress: recipient0zk },
  ];

  // Gas details and estimate (unproven)
  const txGas = await getGasDetailsForTransaction(provider);
  console.log('Gas details:', txGas);
  const gasEst = await gasEstimateForUnprovenTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    senderRailgun.id,
    encryptionKey,
    process.env.MEMO ?? undefined,
    recipients,
    [],
    txGas,
    undefined,
    true,
  );
  txGas.gasEstimate = gasEst.gasEstimate;
  const overallMinGas = calculateGasPrice(txGas);
  console.log('Overall min gas:', overallMinGas);

  // Generate zk proof off-chain
  await generateTransferProof(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    senderRailgun.id,
    encryptionKey,
    false,
    process.env.MEMO ?? undefined,
    recipients,
    [],
    undefined,
    true,
    overallMinGas,
    () => {},
  );

  // Populate and broadcast
  const { transaction } = await populateProvedTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    network,
    senderRailgun.id,
    false,
    process.env.MEMO ?? undefined,
    recipients,
    [],
    undefined,
    true,
    overallMinGas,
    txGas,
  );

  console.log('Broadcasting private transfer…');
  const sent = await publicWallet.sendTransaction(transaction);
  console.log('Private transfer tx hash:', sent.hash);
  await sent.wait();
  console.log('✅ Private transfer complete.');
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
