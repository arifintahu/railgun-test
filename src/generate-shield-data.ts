import 'dotenv/config';
import { Contract, parseUnits, keccak256, type BigNumberish, type Signer } from 'ethers';

import { stopRailgunEngine, createRailgunWallet, gasEstimateForShield, populateShield } from '@railgun-community/wallet';

import { calculateGasPrice, TXIDVersion } from '@railgun-community/shared-models';

import { TEST_MNEMONIC, TEST_NETWORK, TEST_RPC_URL, TEST_ERC20_TOKEN_ADDRESS, TEST_ENCRYPTION_KEY, TEST_SHIELD_AMOUNT, TEST_WALLET_SOURCE, TEST_POI_NODE_URL } from './constants';
import { loadEngineProvider } from './lib/engine';
import { initializeEngine } from './lib/engine-init';
import { getProviderWallet } from './lib/provider';
import { getGasDetailsForTransaction } from './lib/gas';

async function getShieldPrivateKey(address: string): Promise<string> {
  return keccak256(address);
}

async function main(): Promise<void> {
  const { provider, wallet: relayerWallet } = getProviderWallet();

  console.log('Starting engine...');
  await initializeEngine({
    walletSource: TEST_WALLET_SOURCE,
    dbPath: './engine.db',
    artifactsPath: './artifacts',
    ppoiNodes: [TEST_POI_NODE_URL],
    skipMerkletreeScans: false,
  });
  console.log('Engine started.');

  // Connect Sepolia
  console.log('Connecting to Sepolia...');
  await loadEngineProvider(TEST_RPC_URL);
  console.log('Connected to Sepolia.');

  // Create/load sender 0zk
  const recipientRailgunAddress = process.env.RECIPIENT_RAILGUN_ADDRESS;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  console.log('Account Address:', accountAddress);
  console.log('Recipient 0zk:', recipientRailgunAddress);

  const amount: BigNumberish = parseUnits(TEST_SHIELD_AMOUNT, 18);

  // Build shield recipients (self-shield)
  const recipients = [
    {
      tokenAddress: TEST_ERC20_TOKEN_ADDRESS,
      amount,
      recipientAddress: recipientRailgunAddress,
    },
  ];

  // Estimate + populate shield tx
  console.log('Estimating gas for shield transaction...');
  const shieldPrivateKey = await getShieldPrivateKey(accountAddress);
  const gasEstimate = await gasEstimateForShield(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    shieldPrivateKey,
    recipients,
    [],
    relayerWallet.address,
  );
  console.log('Gas estimate:', gasEstimate.gasEstimate);

  const txGas = await getGasDetailsForTransaction(provider);
  txGas.gasEstimate = gasEstimate.gasEstimate;
  const overallMinGas = await calculateGasPrice(txGas);
  console.log('Overall min gas:', overallMinGas);

  const { transaction } = await populateShield(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    shieldPrivateKey,
    recipients,
    [],
    txGas,
  );

  console.log('Populate shield:', {
    txIdVersion: TXIDVersion.V2_PoseidonMerkle,
    networkName: TEST_NETWORK,
    shieldPrivateKey: shieldPrivateKey,
    erc20AmountRecipients: recipients,
    nftAmountRecipients: [],
    gasDetails: txGas,
  });
  console.log('Populated shield tx:', transaction);
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
