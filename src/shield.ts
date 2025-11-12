import 'dotenv/config';
import { Contract, parseUnits, keccak256, type BigNumberish, type Signer } from 'ethers';

import { stopRailgunEngine, createRailgunWallet, gasEstimateForShield, populateShield } from '@railgun-community/wallet';

import { calculateGasPrice, TXIDVersion } from '@railgun-community/shared-models';

import { TEST_MNEMONIC, TEST_NETWORK, TEST_RPC_URL, TEST_ERC20_TOKEN_ADDRESS, TEST_ENCRYPTION_KEY, TEST_SHIELD_AMOUNT, TEST_WALLET_SOURCE, TEST_POI_NODE_URL } from './constants';
import { loadEngineProvider } from './lib/engine';
import { initializeEngine } from './lib/engine-init';
import { getProviderWallet } from './lib/provider';
import { getGasDetailsForTransaction } from './lib/gas';

async function getShieldSignature(signer: Signer): Promise<string> {
  // The cookbook/docs refer to this helper. Many projects implement it as:
  // sign a fixed message and hash it to get a 32-byte key.
  // Keep the message constant so relayers/wallets can reproduce behavior.
  const MESSAGE = 'RAILGUN_SHIELD';
  const sig = await signer.signMessage(MESSAGE);
  return keccak256(sig as `0x${string}`);
}

async function main(): Promise<void> {
  const { provider, wallet: publicWallet } = getProviderWallet();
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

  // Connect Sepolia
  console.log('Connecting to Sepolia...');
  await loadEngineProvider(TEST_RPC_URL);
  console.log('Connected to Sepolia.');

  // Create/load sender 0zk
  const encryptionKey = TEST_ENCRYPTION_KEY;
  const senderRailgun = await createRailgunWallet(encryptionKey, TEST_MNEMONIC, null);
  console.log('Sender 0zk:', senderRailgun.railgunAddress);

  // Read token decimals and amount
  const erc20 = new Contract(
    TEST_ERC20_TOKEN_ADDRESS,
    [
      'function decimals() view returns (uint8)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ],
    publicWallet,
  );
  const decimals: number = await erc20.decimals();
  console.log('Token decimals:', decimals);
  const amount: BigNumberish = parseUnits(TEST_SHIELD_AMOUNT, decimals);

  // Build shield recipients (self-shield)
  const recipients = [
    {
      tokenAddress: TEST_ERC20_TOKEN_ADDRESS,
      amount,
      recipientAddress: senderRailgun.railgunAddress,
    },
  ];

  // Estimate + populate shield tx
  console.log('Estimating gas for shield transaction...');
  const shieldPrivateKey = await getShieldSignature(publicWallet);
  const gasEstimate = await gasEstimateForShield(
    TXIDVersion.V2_PoseidonMerkle,
    TEST_NETWORK,
    shieldPrivateKey,
    recipients,
    [],
    publicWallet.address,
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

  const spender = transaction.to as string;
  const allowance: bigint = await erc20.allowance(publicWallet.address, spender);
  console.log('Current allowance:', allowance);
  if (allowance < amount) {
    const approveTx = await erc20.approve(spender, amount);
    await approveTx.wait();
    console.log('Approved allowance:', approveTx.hash);
  }

  console.log('Broadcasting shield tx…');
  const shieldTx = await publicWallet.sendTransaction(transaction);
  console.log('Shield tx hash:', shieldTx.hash);
  await shieldTx.wait();
  console.log('✅ Shielded successfully.');
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
