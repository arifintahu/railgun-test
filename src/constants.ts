import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import dotenv from "dotenv";

dotenv.config();

if (process.env.RAILGUN_TEST_RPC == null) {
  throw new Error("No TEST RPC URL configured.");
}

export const TEST_NETWORK: NetworkName = NetworkName.EthereumSepolia;
export const TEST_NETWORK_ID: number = parseInt(process.env.RAILGUN_NETWORK_ID ?? "11155111");
export const TEST_RPC_URL: string = `${process.env.RAILGUN_TEST_RPC}`;
export const TEST_TOKEN: string = NETWORK_CONFIG[TEST_NETWORK].baseToken.wrappedAddress;
export const TEST_NFT_ADDRESS = "0x....";
export const TEST_NFT_SUBID = "1";
export const TEST_MNEMONIC =
  process.env.RAILGUN_TEST_MNEMONIC ??
  "test test test test test test test test test test test junk";
export const TEST_ENCRYPTION_KEY =
  "0101010101010101010101010101010101010101010101010101010101010101";
export const TEST_ERC20_TOKEN_ADDRESS =
  process.env.ERC20_TOKEN_ADDRESS ?? "0xb7F1CAD2080fA7EfF168eB1d3CD25a6094FD4A99";
export const TEST_ENGINE_PASSWORD =
  process.env.ENGINE_PASSWORD ?? "1234567890";
export const TEST_SHIELD_AMOUNT =
  process.env.SHIELD_AMOUNT ?? "1";

export const TEST_WALLET_SOURCE = process.env.RAILGUN_WALLET_SOURCE ?? "railguntest";
export const TEST_POI_NODE_URL = process.env.RAILGUN_POI_NODE_URL ?? "https://ppoi-agg.horsewithsixlegs.xyz";
