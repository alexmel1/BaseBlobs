import { useState, useCallback } from 'react';
import { createWalletClient, custom, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/blockchain/contractConfig';

export function useBlobs() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const summonBlob = useCallback(async () => {
    setIsPending(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = (window as any).ethereum;
      if (!provider) {
        throw new Error('No web3 provider found. Please open this app inside a compatible wallet like Coinbase Wallet.');
      }

      // Ensure account is connected
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      if (!account) {
        throw new Error('Please connect your wallet first.');
      }

      // Check current chain and switch to Base if necessary (Base Chain ID: 8453 / 0x2105)
      try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        if (chainId !== '0x2105' && chainId !== '8453') {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        }
      } catch (switchError: any) {
        // If the chain isn't added, request to add it
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } else {
          throw switchError;
        }
      }

      // Create Viem Clients
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Fetch the summon price from contract (stateMutability: view)
      let summonPriceVal = 0n;
      try {
        const price = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI as any,
          functionName: 'summonPrice',
        } as any);
        summonPriceVal = BigInt(price as any);
      } catch (priceErr) {
        console.warn('Could not fetch summon price, defaulting to 0:', priceErr);
      }

      // Base Builder Suffix: "bc_ch35e92e" (Hex: 62635f6368333565393265)
      // Standard ERC-8021 format appends this 10-byte suffix to calldata.
      const BUILDER_SUFFIX = '0x62635f6368333565393265';

      // Submit the transaction with the dataSuffix option
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI as any,
        functionName: 'summonBlob',
        account: account as `0x${string}`,
        value: summonPriceVal,
        chain: base,
        dataSuffix: BUILDER_SUFFIX as `0x${string}`,
      } as any);

      setTxHash(hash);
      return { hash, publicClient };
    } catch (err: any) {
      console.error('Error summoning blob:', err);
      const formattedError = err instanceof Error ? err : new Error(err?.message || 'Transaction rejected/failed');
      setError(formattedError);
      throw formattedError;
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    summonBlob,
    txHash,
    isPending,
    error,
  };
}
