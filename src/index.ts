import "dotenv/config";
import { startRailgunEngine, stopRailgunEngine, loadProvider } from "@railgun-community/wallet";
import { NETWORK_CONFIG, NetworkName, type FallbackProviderJsonConfig } from "@railgun-community/shared-models";
import { groth16 } from "snarkjs";
import { createNodeDatabase } from "./database";
import { createArtifactStore } from "./artifact-store";
import { TEST_NETWORK, TEST_RPC_URL } from "./constants";
import { getProviderWallet } from "./provider";

const isDebug = true;

async function initializeRailgun() {
  const walletSource = process.env.RAILGUN_WALLET_SOURCE || "railguntest";
  const databasePath = process.env.RAILGUN_DB_PATH || "./engine.db";
  const artifactsDir = process.env.RAILGUN_ARTIFACTS_DIR || "./artifacts";
  const poiNodeURLs = [process.env.RAILGUN_POI_NODE_URL || "https://poi.railgun.org"];

  const db = createNodeDatabase(databasePath);
  const artifactStore = createArtifactStore(artifactsDir);

  const useNativeArtifacts = false;
  const skipMerkletreeScans = false;
  const customPOILists = undefined;
  const verboseScanLogging = false;

  await startRailgunEngine(
    walletSource,
    db,
    isDebug,
    artifactStore,
    useNativeArtifacts,
    skipMerkletreeScans,
    poiNodeURLs,
    customPOILists,
    verboseScanLogging,
  );

  if (groth16?.prove && groth16?.verify) {
    console.log("Groth16 prover detected from snarkjs.");
  }

  console.log("RAILGUN engine initialized.");
}

async function loadNetworkProvider() {
  const chainId = 11155111;
  console.log("Selected network:", TEST_NETWORK, "chainId:", chainId);
  const providerConfig: FallbackProviderJsonConfig = {
    chainId,
    providers: [
      { provider: TEST_RPC_URL, priority: 1, weight: 2 },
    ],
  };

  const pollingInterval = 60_000;
  // Basic ethers provider + wallet setup per docs step 2.
  try {
    const { provider, wallet } = getProviderWallet();
    const [blockNumber, address] = await Promise.all([
      provider.getBlockNumber(),
      wallet.getAddress(),
    ]);
    console.log("RPC connected. block:", blockNumber, "wallet:", address);
  } catch (rpcErr) {
    console.warn("RPC provider/wallet init error:", rpcErr);
  }

  try {
    const { feesSerialized } = await loadProvider(providerConfig, TEST_NETWORK, pollingInterval);
    console.log("RAILGUN fees:", feesSerialized);
  } catch (e) {
    console.warn("loadProvider error:", e);
  }
}

async function main() {
  try {
    await initializeRailgun();
    await loadNetworkProvider();

    process.on("SIGINT", async () => {
      console.log("Stopping RAILGUN engine...");
      await stopRailgunEngine();
      process.exit(0);
    });
  } catch (err) {
    console.error("Initialization error:", err);
    process.exit(1);
  }
}

main();