import { JsonRpcProvider } from 'ethers';
import { EVMGasType, type TransactionGasDetails } from '@railgun-community/shared-models';

export const getGasDetailsForTransaction = async (
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