import { NETWORK_CONFIG, NetworkName } from "@railgun-community/shared-models";
import dotenv from "dotenv";

dotenv.config();

if (process.env.RAILGUN_TEST_RPC == null) {
  throw new Error("No TEST RPC URL configured.");
}

export const TEST_NETWORK: NetworkName = NetworkName.EthereumSepolia;
export const TEST_RPC_URL: string = `${process.env.RAILGUN_TEST_RPC}`;
export const TEST_TOKEN: string = NETWORK_CONFIG[TEST_NETWORK].baseToken.wrappedAddress;
export const TEST_NFT_ADDRESS = "0x....";
export const TEST_NFT_SUBID = "1";
export const TEST_MNEMONIC =
  process.env.RAILGUN_TEST_MNEMONIC ??
  "test test test test test test test test test test test junk";
export const TEST_ENCRYPTION_KEY =
  "0101010101010101010101010101010101010101010101010101010101010101";