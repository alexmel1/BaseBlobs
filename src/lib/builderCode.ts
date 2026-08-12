import { Attribution } from 'ox/erc8021';
import { sendCalls, waitForCallsStatus } from 'wagmi/actions';

/**
 * Generates an ERC-8021 data suffix for Base Builder Code attribution.
 * Reads the builder code from `import.meta.env.VITE_BASE_BUILDER_CODE`.
 * Returns the hex string data suffix (e.g., `0x...`) or `undefined` if not configured.
 */
export function getBuilderCodeSuffix(): `0x${string}` | undefined {
  const code = (import.meta.env?.VITE_BASE_BUILDER_CODE as string | undefined)?.trim();
  if (!code) return undefined;
  try {
    return Attribution.toDataSuffix({ codes: [code] }) as `0x${string}`;
  } catch (err) {
    console.warn('Failed to generate Base Builder Code data suffix:', err);
    return undefined;
  }
}

/**
 * Sends a transaction call using ERC-5792 sendCalls with the dataSuffix capability
 * for ERC-8021 Builder Code attribution.
 */
export async function sendTransactionWithBuilderCode(
  wagmiConfig: any,
  parameters: {
    account: `0x${string}`;
    chainId: number;
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  }
): Promise<`0x${string}`> {
  const builderSuffix = getBuilderCodeSuffix();

  const callsResult = await sendCalls(wagmiConfig, {
    account: parameters.account,
    chainId: parameters.chainId,
    calls: [
      {
        to: parameters.to,
        data: parameters.data,
        value: parameters.value,
      },
    ],
    capabilities: builderSuffix
      ? {
          dataSuffix: {
            value: builderSuffix,
            optional: true,
          },
        }
      : undefined,
    experimental_fallback: true,
  });

  const batchId = typeof callsResult === 'string' ? callsResult : callsResult.id;
  if (!batchId) {
    throw new Error('No transaction ID returned from sendCalls');
  }

  // 1. If batchId is directly a 66-character txHash
  if (typeof batchId === 'string' && /^0x[a-fA-F0-9]{64}$/.test(batchId)) {
    return batchId as `0x${string}`;
  }

  // 2. Try waitForCallsStatus to resolve batchId to transaction hash
  try {
    const callsStatus = await waitForCallsStatus(wagmiConfig, { id: batchId });
    if (callsStatus.receipts?.[0]?.transactionHash) {
      return callsStatus.receipts[0].transactionHash as `0x${string}`;
    }
  } catch (err) {
    console.warn('waitForCallsStatus notice:', err);
  }

  // 3. Fallback to batchId if string starting with 0x
  if (typeof batchId === 'string' && batchId.startsWith('0x')) {
    return batchId as `0x${string}`;
  }

  throw new Error('Failed to resolve transaction hash from sendCalls');
}
