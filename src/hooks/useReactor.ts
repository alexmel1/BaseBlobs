import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  doc, onSnapshot, updateDoc, setDoc, increment, getDoc, collection, getDocs, writeBatch,
} from 'firebase/firestore';
import { ethers } from 'ethers';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { encodeFunctionData } from 'viem';
import { sendTransactionWithBuilderCode } from '../lib/builderCode';
import { wagmiConfig } from '../lib/web3Config';
import { base } from '@reown/appkit/networks';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { db } from '../lib/firebase';
import { fetchWithSession } from '../lib/wallet';
import { REACTOR_ADDRESS, BASE_MAINNET_CHAIN_ID } from '../contracts/reactorConfig';
import { BLOB_REACTOR_ABI } from '../contracts/reactorABI';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReactorPhase =
  | 'inactive'
  | 'collecting'
  | 'synthesizing'
  | 'claimable'
  | 'closed';

export interface ReactorGlobal {
  phase: ReactorPhase;
  eventId: number;
  target: number;
  totalContributed: number;
  totalReward: number;
  contributorsCount: number;
  claimWindowEnd: number | null;
  merkleRoot: string | null;
  merkleTreeDump: string | null;
  synthesizingAt?: number | null;
}

export interface MyContribution {
  walletAddress: string;
  contributed: number;
  allocation: number;
  allocationWei: string;
  claimed: boolean;
  claimedAt: number | null;
  eventId?: number;
}

export interface UnclaimedReward {
  eventId: number;
  allocationTokens: number;
  allocationWei: string;
  proof: string[];
}

// ─── Firestore Error Handling (as mandated by Skill) ─────────────────────────

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getProvider() {
  if (!(window as any).ethereum) throw new Error('No wallet found');
  return new ethers.BrowserProvider((window as any).ethereum);
}

async function switchToBase(): Promise<boolean> {
  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }], // 8453 hex
    });
    return true;
  } catch (e: any) {
    if (e.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Base network:', addError);
        return false;
      }
    }
    return false;
  }
}

export interface MerkleProofResult {
  found: boolean;
  proof: string[];
  allocationWei: string;
  allocationTokens: number;
}

function getMerkleProofAndAllocation(treeJson: string, address: string): MerkleProofResult {
  try {
    if (!treeJson || !address) {
      return { found: false, proof: [], allocationWei: '0', allocationTokens: 0 };
    }
    const tree = JSON.parse(treeJson);
    const loaded = StandardMerkleTree.load(tree);
    const targetAddr = address.toLowerCase();

    for (const [i, v] of loaded.entries()) {
      const leafAddr = String(v[0]).toLowerCase();
      if (leafAddr === targetAddr) {
        const allocWei = String(v[1]);
        const proof = loaded.getProof(i) as string[];
        const allocTokens = Number(ethers.formatUnits(allocWei, 6));
        return {
          found: true,
          proof,
          allocationWei: allocWei,
          allocationTokens: allocTokens,
        };
      }
    }
  } catch (e) {
    console.error('Merkle proof lookup error:', e);
  }
  return { found: false, proof: [], allocationWei: '0', allocationTokens: 0 };
}

// ─── Promise Timeout Helper for Robust Firestore Connection Management ────
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 7000,
  errorMsg = 'Database operation timed out. The Firestore client is offline or cannot establish a connection. Please verify your custom Firebase config and ensure your Database exists and allows read/write.'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
}

// Helper to parse complex contract/wallet errors into user-friendly messages
function parseContractError(e: any, fallbackMsg: string): string {
  if (!e) return fallbackMsg;
  const msg = e.message || '';
  const reason = e.reason || '';
  const code = e.code;
  const fullStr = `${msg} ${reason}`;
  
  if (code === 'ACTION_REJECTED' || code === 4001 || fullStr.includes('rejected') || fullStr.includes('denied') || fullStr.includes('UserRejected') || fullStr.includes('User denied')) {
    return 'Transaction was cancelled/rejected in your wallet.';
  }
  if (fullStr.includes('Already synthesizing')) {
    return 'Smart contract error: "Already synthesizing". The event is already in the synthesizing phase on-chain.';
  }
  if (fullStr.includes('Must be synthesizing')) {
    return 'Smart contract error: "Must be synthesizing". You cannot close the event yet because it is not in the "Synthesizing" state. Please generate and submit the Merkle Root first.';
  }
  if (fullStr.includes('No contributions found') || fullStr.includes('contributions to generate')) {
    return 'No contributions were found to generate a Merkle Tree. Please make sure players have contributed cubes first during the "collecting" phase.';
  }
  if (fullStr.includes('execution reverted')) {
    if (e.reason) return `Transaction reverted: ${e.reason}`;
    return `Transaction reverted on-chain. Please make sure you are the contract owner and the action is valid for the current contract phase.`;
  }
  return msg || fallbackMsg;
}

/**
 * onServerCubes — колбэк, через который серверный баланс кубов попадает в GameState.
 * Кубы списывает сервер (api/claim.ts, type: 'reactor_contribute') и возвращает
 * итоговое значение; клиент обязан просто его применить, а не считать сам.
 */
export function useReactor(
  rawWalletAddress: string | null,
  onServerCubes?: (payload: { cubes: number; rev?: number }) => void,
) {
  // Helper functions to manage Local Fallback cache
  const saveLocalGlobal = useCallback((data: ReactorGlobal) => {
    try {
      localStorage.setItem('reactor_local_global', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to cache global reactor state:', e);
    }
  }, []);

  const saveLocalContrib = useCallback((address: string, data: MyContribution | null) => {
    try {
      if (!data) {
        localStorage.removeItem(`reactor_local_contrib_${address.toLowerCase()}`);
      } else {
        localStorage.setItem(`reactor_local_contrib_${address.toLowerCase()}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Failed to cache contribution:', e);
    }
  }, []);

  const [reactor, setReactor] = useState<ReactorGlobal | null>(() => {
    try {
      const stored = localStorage.getItem('reactor_local_global');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      phase: 'inactive',
      eventId: 0,
      target: 100000,
      totalContributed: 0,
      totalReward: 50000,
      contributorsCount: 0,
      claimWindowEnd: null,
      merkleRoot: null,
      merkleTreeDump: null,
    };
  });

  const [myContrib, setMyContrib] = useState<MyContribution | null>(() => {
    if (!rawWalletAddress) return null;
    try {
      const stored = localStorage.getItem(`reactor_local_contrib_${rawWalletAddress.toLowerCase()}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unclaimedRewards, setUnclaimedRewards] = useState<UnclaimedReward[]>([]);
  const [contributedEvents, setContributedEvents] = useState<number[]>([]);

  // Subscribe to global reactor state
  useEffect(() => {
    setFirestoreError(null);
    let active = true;
    const unsub = onSnapshot(doc(db, 'reactor_global', 'state'), snap => {
      if (!active) return;
      if (snap.exists()) {
        const data = snap.data();
        const sanitized: ReactorGlobal = {
          phase: (data.phase || 'inactive') as ReactorPhase,
          eventId: Number(data.eventId || 0),
          target: Number(data.target || 0),
          totalContributed: Number(data.totalContributed || 0),
          totalReward: Number(data.totalReward || 0),
          contributorsCount: Number(data.contributorsCount || 0),
          claimWindowEnd: (data.claimWindowEnd === 'null' || !data.claimWindowEnd) ? null : Number(data.claimWindowEnd),
          merkleRoot: (data.merkleRoot === 'null' || !data.merkleRoot) ? null : String(data.merkleRoot),
          merkleTreeDump: (data.merkleTreeDump === 'null' || !data.merkleTreeDump) ? null : String(data.merkleTreeDump),
          synthesizingAt: (data.synthesizingAt === 'null' || !data.synthesizingAt) ? null : Number(data.synthesizingAt),
        };
        setReactor(sanitized);
        saveLocalGlobal(sanitized);
      }
    }, (error) => {
      console.warn('Firestore subscription offline / error, using Local Storage fallback system:', error);
      // Fail silently and let the user enjoy instant local storage interactions instead of hanging
    });
    return () => {
      active = false;
      unsub();
    };
  }, [saveLocalGlobal]);

  // Subscribe to user contribution
  useEffect(() => {
    if (!rawWalletAddress) {
      setMyContrib(null);
      return;
    }
    let active = true;
    const ref = doc(db, 'reactor_contributions', rawWalletAddress.toLowerCase());
    const unsub = onSnapshot(ref, snap => {
      if (!active) return;
      if (snap.exists()) {
        const data = snap.data();
        const dataEventId = data.eventId !== undefined ? Number(data.eventId) : null;

        const eventsArr: number[] = Array.isArray(data.contributedEvents)
          ? data.contributedEvents.map(Number)
          : (dataEventId ? [dataEventId] : []);
        setContributedEvents(eventsArr);

        // If the contribution belongs to an old event, treat as null/0
        if (reactor && dataEventId !== null && dataEventId !== reactor.eventId) {
          setMyContrib(null);
        } else {
          const sanitized: MyContribution = {
            walletAddress: String(data.walletAddress || rawWalletAddress),
            contributed: Number(data.contributed || 0),
            allocation: Number(data.allocation || 0),
            allocationWei: String(data.allocationWei || '0'),
            claimed: Boolean(data.claimed || false),
            claimedAt: (data.claimedAt === 'null' || !data.claimedAt) ? null : Number(data.claimedAt),
            eventId: dataEventId || undefined,
          };
          setMyContrib(sanitized);
          saveLocalContrib(rawWalletAddress, sanitized);
        }
      } else {
        // Only set to null if we don't have a local cache that is ahead
        setMyContrib(prev => {
          if (prev && prev.contributed > 0 && prev.eventId === reactor?.eventId) return prev;
          return null;
        });
      }
    }, (error) => {
      console.warn('Firestore contributions subscription offline, using Local Storage fallback:', error);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [rawWalletAddress, saveLocalContrib, reactor?.eventId]);

  // ── Contribute Cubes ────────────────────────────────────────────────────────────
  const contribute = useCallback(async (cubeAmount: number): Promise<boolean> => {
    if (!rawWalletAddress || !reactor) return false;
    if (reactor.phase !== 'collecting') return false;
    if (cubeAmount <= 0) return false;

    setFirestoreError(null);
    setActionError(null);
    const addr = rawWalletAddress.toLowerCase();
    const currentEventId = reactor.eventId;

    // 1. Immediately update Local Cache for ultra-responsive instant UI rendering (0ms lag)
    const isNewForThisEvent = !myContrib || myContrib.eventId !== currentEventId;
    const updatedGlobal: ReactorGlobal = {
      ...reactor,
      totalContributed: reactor.totalContributed + cubeAmount,
      contributorsCount: isNewForThisEvent ? reactor.contributorsCount + 1 : reactor.contributorsCount,
    };
    const updatedContrib: MyContribution = !isNewForThisEvent
      ? { ...myContrib, contributed: myContrib.contributed + cubeAmount }
      : {
          walletAddress: rawWalletAddress,
          contributed: cubeAmount,
          allocation: 0,
          allocationWei: '0',
          claimed: false,
          claimedAt: null,
          eventId: currentEventId,
        };

    setReactor(updatedGlobal);
    saveLocalGlobal(updatedGlobal);
    setMyContrib(updatedContrib);
    saveLocalContrib(rawWalletAddress, updatedContrib);

    // Save to all contributors list to fallback for Merkle generation
    try {
      const stored = localStorage.getItem('reactor_local_all_contributors');
      const contributorsList = stored ? JSON.parse(stored) : [];
      if (!contributorsList.includes(addr)) {
        contributorsList.push(addr);
        localStorage.setItem('reactor_local_all_contributors', JSON.stringify(contributorsList));
      }
    } catch (e) {
      console.error('Failed to update contributors cache:', e);
    }

    // 2. Call server endpoint to deduct cubes and record contribution atomically
    const syncId = `wallet_${addr}`;

    try {
      const res = await fetchWithSession('/api/claim', {
        type: 'reactor_contribute',
        syncId,
        walletAddress: rawWalletAddress,
        eventId: currentEventId,
        amount: cubeAmount,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Contribution rejected by server');
      }

      const serverData = await res.json().catch(() => null);
      if (serverData?.myContribution) {
        const finalContrib: MyContribution = {
          walletAddress: rawWalletAddress,
          contributed: Number(serverData.myContribution.contributed),
          allocation: 0,
          allocationWei: '0',
          claimed: false,
          claimedAt: null,
          eventId: currentEventId,
        };
        setMyContrib(finalContrib);
        saveLocalContrib(rawWalletAddress, finalContrib);
      }

      // Баланс кубов берём строго из ответа сервера — он уже списал их в транзакции
      if (typeof serverData?.cubes === 'number' && onServerCubes) {
        onServerCubes({ cubes: serverData.cubes, rev: serverData.rev });
      }
    } catch (e: any) {
      console.error('Reactor contribution server sync failed:', e);
      setActionError(e.message || 'Contribution failed');

      // Revert optimistic state
      setReactor(reactor);
      saveLocalGlobal(reactor);
      setMyContrib(myContrib);
      if (myContrib) {
        saveLocalContrib(rawWalletAddress, myContrib);
      } else {
        localStorage.removeItem(`reactor_local_contrib_${addr}`);
      }
      return false;
    }

    return true;
  }, [rawWalletAddress, reactor, myContrib, saveLocalGlobal, saveLocalContrib, onServerCubes]);

  const effectiveMyContrib = useMemo(() => {
    if (!myContrib && !rawWalletAddress) return null;
    let base = myContrib;
    if (rawWalletAddress && reactor?.merkleTreeDump) {
      const proofRes = getMerkleProofAndAllocation(reactor.merkleTreeDump, rawWalletAddress);
      if (proofRes.found) {
        base = {
          walletAddress: rawWalletAddress,
          contributed: base?.contributed || 0,
          allocation: proofRes.allocationTokens,
          allocationWei: proofRes.allocationWei,
          claimed: base?.claimed || false,
          claimedAt: base?.claimedAt || null,
          eventId: base?.eventId ?? reactor.eventId,
        };
      }
    }
    return base;
  }, [myContrib, rawWalletAddress, reactor?.merkleTreeDump, reactor?.eventId]);

  // ── Claim USDC Tokens ───────────────────────────────────────────────────────────
  const claimTokens = useCallback(async (): Promise<boolean> => {
    if (!rawWalletAddress || !reactor) return false;
    if (reactor.phase !== 'claimable') {
      setClaimError('Claim is not open yet');
      return false;
    }
    if (effectiveMyContrib?.claimed) {
      setClaimError('Already claimed');
      return false;
    }
    if (!reactor.merkleTreeDump) {
      setClaimError('Merkle tree not ready');
      return false;
    }
    if (!(window as any).ethereum) {
      setClaimError('No Web3 wallet found');
      return false;
    }

    setIsClaiming(true);
    setClaimError(null);

    try {
      // Retrieve exact proof and allocation directly from Merkle tree
      const proofResult = getMerkleProofAndAllocation(reactor.merkleTreeDump, rawWalletAddress);
      if (!proofResult.found) {
        setClaimError('No allocation or proof found for this wallet in the Merkle Tree. Contact support if you contributed.');
        setIsClaiming(false);
        return false;
      }

      const { proof, allocationWei } = proofResult;
      const currentEvId = reactor.eventId || 1;

      // Check hasClaimed on smart contract
      const readContract = new ethers.Contract(
        REACTOR_ADDRESS,
        BLOB_REACTOR_ABI,
        new ethers.JsonRpcProvider('https://mainnet.base.org'),
      );
      const alreadyClaimed = await readContract.hasClaimed(currentEvId, rawWalletAddress);
      if (alreadyClaimed) {
        setClaimError('Already claimed on-chain');
        setIsClaiming(false);
        return false;
      }

      const claimCalldata = encodeFunctionData({
        abi: BLOB_REACTOR_ABI as any,
        functionName: 'claim',
        args: [BigInt(currentEvId), BigInt(allocationWei), proof as `0x${string}`[]],
      });

      const hash = await sendTransactionWithBuilderCode(wagmiConfig, {
        account: rawWalletAddress as `0x${string}`,
        chainId: base.id,
        to: REACTOR_ADDRESS as `0x${string}`,
        data: claimCalldata,
      });
      setClaimTxHash(hash);
      await waitForTransactionReceipt(wagmiConfig, { hash });

      // Update Local State instantly
      const updatedContrib: MyContribution = {
        ...(effectiveMyContrib || {
          walletAddress: rawWalletAddress,
          contributed: 0,
          allocation: proofResult.allocationTokens,
          allocationWei: proofResult.allocationWei,
          eventId: reactor.eventId,
        }),
        claimed: true,
        claimedAt: Date.now(),
      };
      setMyContrib(updatedContrib);
      saveLocalContrib(rawWalletAddress, updatedContrib);

      // Attempt Firestore update with fast timeout
      const userRef = doc(db, 'reactor_contributions', rawWalletAddress.toLowerCase());
      try {
        await withTimeout(
          updateDoc(userRef, { claimed: true, claimedAt: Date.now() }),
          2000
        );
      } catch (e) {
        console.warn('Firestore offline during claim status update, status successfully saved to local session:', e);
      }

      return true;
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.code === 4001) {
        setClaimError('Transaction rejected by user');
      } else if (e.message?.includes('Already claimed')) {
        setClaimError('Already claimed on-chain');
      } else {
        setClaimError(parseContractError(e, 'Failed to claim tokens'));
      }
      return false;
    } finally {
      setIsClaiming(false);
    }
  }, [rawWalletAddress, effectiveMyContrib, reactor, saveLocalContrib]);

  // Check unclaimed rewards across past events in reactor_events_archive
  useEffect(() => {
    if (!rawWalletAddress || contributedEvents.length === 0) {
      setUnclaimedRewards([]);
      return;
    }

    let active = true;
    const currentEvId = reactor?.eventId;

    async function checkArchive() {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, provider);

        const foundRewards: UnclaimedReward[] = [];
        const pastEvents = contributedEvents.filter((e) => e > 0 && e !== currentEvId);

        for (const evId of pastEvents) {
          if (!active) return;
          try {
            const hasClaimedOnChain: boolean = await contract.hasClaimed(evId, rawWalletAddress);
            if (hasClaimedOnChain) continue;

            const root: string = await contract.merkleRoots(evId);
            if (!root || root === '0x0000000000000000000000000000000000000000000000000000000000000000') {
              continue;
            }

            const archiveRef = doc(db, 'reactor_events_archive', String(evId));
            const archiveSnap = await getDoc(archiveRef);
            if (!archiveSnap.exists()) continue;

            const dump = archiveSnap.data()?.merkleTreeDump;
            if (!dump) continue;

            const proofRes = getMerkleProofAndAllocation(dump, rawWalletAddress);
            if (proofRes.found && proofRes.allocationTokens > 0) {
              foundRewards.push({
                eventId: evId,
                allocationTokens: proofRes.allocationTokens,
                allocationWei: proofRes.allocationWei,
                proof: proofRes.proof,
              });
            }
          } catch (e) {
            console.warn(`Error checking archive reward for season ${evId}:`, e);
          }
        }

        if (active) {
          setUnclaimedRewards(foundRewards);
        }
      } catch (err) {
        console.warn('Archive check error:', err);
      }
    }

    checkArchive();

    return () => {
      active = false;
    };
  }, [rawWalletAddress, contributedEvents, reactor?.eventId]);

  const claimArchiveToken = useCallback(async (reward: UnclaimedReward): Promise<boolean> => {
    if (!rawWalletAddress || !(window as any).ethereum) return false;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const switched = await switchToBase();
      if (!switched) {
        setClaimError('Please switch your wallet network to Base L2');
        return false;
      }

      const claimCalldata = encodeFunctionData({
        abi: BLOB_REACTOR_ABI as any,
        functionName: 'claim',
        args: [BigInt(reward.eventId), BigInt(reward.allocationWei), reward.proof as `0x${string}`[]],
      });

      const hash = await sendTransactionWithBuilderCode(wagmiConfig, {
        account: rawWalletAddress as `0x${string}`,
        chainId: base.id,
        to: REACTOR_ADDRESS as `0x${string}`,
        data: claimCalldata,
      });
      setClaimTxHash(hash);
      await waitForTransactionReceipt(wagmiConfig, { hash });

      setUnclaimedRewards((prev) => prev.filter((r) => r.eventId !== reward.eventId));
      return true;
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.code === 4001) {
        setClaimError('Transaction rejected by user');
      } else if (e.message?.includes('Already claimed')) {
        setClaimError('Already claimed on-chain');
      } else {
        setClaimError(parseContractError(e, 'Failed to claim reward'));
      }
      return false;
    } finally {
      setIsClaiming(false);
    }
  }, [rawWalletAddress]);

  // ── Calculated Values ─────────────────────────────────────────────────────
  const progressPercent = reactor && reactor.target > 0
    ? Math.min(100, (reactor.totalContributed / reactor.target) * 100)
    : 0;

  // Real-time estimated reward during collecting phase
  const estimatedReward = reactor && reactor.totalContributed > 0 && myContrib?.contributed
    ? Number(
        (BigInt(Math.round(reactor.totalReward * 1e6)) * BigInt(Math.round(myContrib.contributed)))
        / BigInt(Math.round(reactor.totalContributed))
      ) / 1e6
    : 0;

  const msUntilClaimEnd = reactor?.claimWindowEnd
    ? Math.max(0, reactor.claimWindowEnd - Date.now())
    : 0;

  // Synthesizing progress (6 hours duration as specified)
  const synthesizingProgress = reactor?.synthesizingAt
    ? Math.min(100, ((Date.now() - reactor.synthesizingAt) / (6 * 3600000)) * 100)
    : 0;

  return {
    reactor,
    myContrib: effectiveMyContrib,
    progressPercent,
    estimatedReward,
    msUntilClaimEnd,
    synthesizingProgress,
    isClaiming,
    claimError,
    claimTxHash,
    firestoreError,
    actionError,
    unclaimedRewards,
    contribute,
    claimTokens,
    claimArchiveToken,
  };
}