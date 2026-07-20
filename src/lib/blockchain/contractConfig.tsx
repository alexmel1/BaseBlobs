import abi from './abi.json';

export const CONTRACT_ADDRESS = "0x5bcDc3A8D2Ec68aD2df65B2b5a0600cD85c52BE7";

export const CONTRACT_ABI = abi;

export interface BlobData {
  id: bigint;
  rarity: bigint;
  createdAt: bigint;
}