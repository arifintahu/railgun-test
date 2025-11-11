import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, parseUnits, keccak256, type BigNumberish, type Signer } from 'ethers';

import {
  startRailgunEngine,
  stopRailgunEngine,
  createRailgunWallet,
  loadProvider,
  gasEstimateForShield,
  populateShield,
} from '@railgun-community/wallet';

import {
  calculateGasPrice,
  TXIDVersion,
  EVMGasType,
  type TransactionGasDetails,
  FallbackProviderJsonConfig,
} from '@railgun-community/shared-models';

import { 
    TEST_MNEMONIC,
    TEST_NETWORK,
    TEST_RPC_URL,
    TEST_ERC20_TOKEN_ADDRESS,
    TEST_ENCRYPTION_KEY,
    TEST_SHIELD_AMOUNT,
    TEST_NETWORK_ID,
    TEST_WALLET_SOURCE,
    TEST_POI_NODE_URL,
} from './constants';
import { createNodeDatabase } from './database';
import { createArtifactStore } from './artifact-store';

const getGasDetailsForTransaction = async (
  provider: JsonRpcProvider,
): Promise<TransactionGasDetails> => {
  const fee = await provider.getFeeData();
  return {
    evmGasType: EVMGasType.Type2,
    gasEstimate: undefined,
    maxFeePerGas: fee.maxFeePerGas ?? (1n * 10n ** 9n),
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? (1n * 10n ** 9n),
  };
};

async function getShieldSignature(signer: Signer): Promise<string> {
  // The cookbook/docs refer to this helper. Many projects implement it as:
  // sign a fixed message and hash it to get a 32-byte key.
  // Keep the message constant so relayers/wallets can reproduce behavior.
  const MESSAGE = 'RAILGUN_SHIELD';
  const sig = await signer.signMessage(MESSAGE);
  return keccak256(sig as `0x${string}`);
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(TEST_RPC_URL);
  console.log('Provider:', provider);
  const publicWallet = Wallet.fromPhrase(TEST_MNEMONIC, provider);

  // Start engine
  const db = createNodeDatabase('./engine.db');
  const artifactStore = createArtifactStore('./artifacts');
  const isDebug = true;
  const useNativeArtifacts = false;
  const skipMerkletreeScans = false;
  const customPOILists = undefined;
  const verboseScanLogging = false;
  console.log('Starting engine...');
  await startRailgunEngine(
    TEST_WALLET_SOURCE,
    db as unknown as any,
    isDebug,
    artifactStore,
    useNativeArtifacts,
    skipMerkletreeScans,
    [TEST_POI_NODE_URL],
    customPOILists,
    verboseScanLogging,
  );
  console.log('Engine started.');

  // Connect Sepolia
  console.log('Connecting to Sepolia...');
  const providerConfig: FallbackProviderJsonConfig = {
      chainId: TEST_NETWORK_ID,
      providers: [
        { provider: TEST_RPC_URL, priority: 1, weight: 2 },
      ],
    };
  await loadProvider(providerConfig, TEST_NETWORK);
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
      'function approve(address spender, uint256 amount) returns (bool)',
    ],
    publicWallet,
  );
  const decimals: number = await erc20.decimals();
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
