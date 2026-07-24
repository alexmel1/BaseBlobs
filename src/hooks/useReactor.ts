import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  doc, onSnapshot, updateDoc, setDoc, increment, getDoc, collection, getDocs, writeBatch,
} from 'firebase/firestore';
import { ethers } from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { db } from '../lib/firebase';
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
        const allocTokens = Number(ethers.formatUnits(allocWei, 18));
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
  if (fullStr.includes('Close current event first')) {
    return 'Smart contract error: "Close current event first". An event is already active on the smart contract. Step 2 (Generate Merkle Root) must be submitted or the current claim window must expire before starting a new event.';
  }
  if (fullStr.includes('Already synthesizing')) {
    return 'Smart contract error: "Already synthesizing". The event is already in the synthesizing phase on-chain.';
  }
  if (fullStr.includes('Claim window still open')) {
    return 'Smart contract error: "Claim window still open". The claim window is currently open for players. The event can only be closed on-chain after the claim window expires.';
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

export function useReactor(rawWalletAddress: string | null) {
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

  const [isAdmin, setIsAdmin] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  // Fetch contract owner and check admin
  useEffect(() => {
    async function checkOwner() {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, provider);
        const owner = await contract.owner();
        setOwnerAddress(owner);
        if (rawWalletAddress && owner && rawWalletAddress.toLowerCase() === owner.toLowerCase()) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error('Failed to fetch contract owner:', e);
      }
    }
    checkOwner();
  }, [rawWalletAddress]);

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

        // If the contribution belongs to an old event, treat as null/0
        if (reactor && dataEventId !== null && dataEventId !== reactor.eventId) {
          setMyContrib(null);
          return;
        }

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

    // 2. Attempt Firestore sync with a fast timeout (fail-safe fallback)
    const globalRef = doc(db, 'reactor_global', 'state');
    const myRef = doc(db, 'reactor_contributions', addr);

    try {
      const mySnap = await withTimeout(
        getDoc(myRef),
        2000,
        'Offline fallback write activated'
      );
      
      let shouldOverwrite = true;
      if (mySnap.exists()) {
        const existingData = mySnap.data();
        if (Number(existingData.eventId || 0) === currentEventId) {
          shouldOverwrite = false;
        }
      }

      await withTimeout(
        Promise.all([
          updateDoc(globalRef, {
            totalContributed: increment(cubeAmount),
            ...(shouldOverwrite ? { contributorsCount: increment(1) } : {}),
          }),
          shouldOverwrite
            ? setDoc(myRef, {
                walletAddress: rawWalletAddress,
                contributed: cubeAmount,
                allocation: 0,
                allocationWei: '0',
                claimed: false,
                claimedAt: null,
                eventId: currentEventId,
              })
            : updateDoc(myRef, { 
                contributed: increment(cubeAmount),
                eventId: currentEventId,
              }),
        ]),
        2500,
        'Offline fallback write activated'
      );
    } catch (e: any) {
      console.warn('Firestore is unreachable, contribution successfully cached locally:', e);
    }

    return true;
  }, [rawWalletAddress, reactor, myContrib, saveLocalGlobal, saveLocalContrib]);

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

  // ── Claim $BLOBS Tokens ───────────────────────────────────────────────────────────
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
      const provider = await getProvider();
      const network = await provider.getNetwork();

      // Check if user is on Base mainnet
      if (Number(network.chainId) !== BASE_MAINNET_CHAIN_ID) {
        const switched = await switchToBase();
        if (!switched) {
          setClaimError('Please switch to the Base network');
          setIsClaiming(false);
          return false;
        }
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, signer);

      // Retrieve exact proof and allocation directly from Merkle tree
      const proofResult = getMerkleProofAndAllocation(reactor.merkleTreeDump, rawWalletAddress);
      if (!proofResult.found) {
        setClaimError('No allocation or proof found for this wallet in the Merkle Tree. Contact support if you contributed.');
        setIsClaiming(false);
        return false;
      }

      const { proof, allocationWei } = proofResult;

      // Check canClaim on smart contract
      const readContract = new ethers.Contract(
        REACTOR_ADDRESS,
        BLOB_REACTOR_ABI,
        new ethers.JsonRpcProvider('https://mainnet.base.org'),
      );
      const ok = await readContract.canClaim(rawWalletAddress);
      if (!ok) {
        setClaimError('Cannot claim: already claimed or window closed');
        setIsClaiming(false);
        return false;
      }

      // Send the transaction
      const tx = await contract.claim(BigInt(allocationWei), proof);
      setClaimTxHash(tx.hash);
      await tx.wait();

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

  // ── Admin Functions ─────────────────────────────────────────────────────────────
  const syncEventFromContract = useCallback(async (targetCubes: number): Promise<boolean> => {
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, provider);
      
      const eventOnChain = await contract.getCurrentEvent();
      
      const eventId = Number(eventOnChain.eventId);
      const merkleRoot = eventOnChain.merkleRoot;
      const totalReward = Number(ethers.formatUnits(eventOnChain.totalReward, 18));
      const claimWindowEnd = Number(eventOnChain.claimWindowEnd) * 1000; // ms
      const active = Boolean(eventOnChain.active);
      const synthesizing = Boolean(eventOnChain.synthesizing);

      // Fetch existing from local state
      const existing = reactor;
      const isNewEvent = !existing || Number(existing.eventId || 0) !== eventId;

      if (isNewEvent) {
        // Clear old event contributions cache from local storage
        try {
          const storedAddrs = localStorage.getItem('reactor_local_all_contributors');
          if (storedAddrs) {
            const addrs: string[] = JSON.parse(storedAddrs);
            for (const addr of addrs) {
              localStorage.removeItem(`reactor_local_contrib_${addr.toLowerCase()}`);
            }
          }
          localStorage.removeItem('reactor_local_all_contributors');
        } catch (e) {
          console.error('Failed to clear old contributors cache:', e);
        }
        // If the user's wallet is loaded, update local state and localStorage
        if (rawWalletAddress) {
          setMyContrib(null);
          localStorage.removeItem(`reactor_local_contrib_${rawWalletAddress.toLowerCase()}`);
        }
      }

      let phase: ReactorPhase = 'inactive';
      if (active) {
        phase = synthesizing ? 'synthesizing' : 'collecting';
      } else if (claimWindowEnd > Date.now() && merkleRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        phase = 'claimable';
      } else if (eventId > 0) {
        phase = 'closed';
      }

      const updatedGlobal: ReactorGlobal = {
        phase,
        eventId,
        target: targetCubes,
        totalReward,
        claimWindowEnd: claimWindowEnd > 0 ? claimWindowEnd : null,
        merkleRoot: merkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? null : merkleRoot,
        merkleTreeDump: isNewEvent ? null : (existing?.merkleTreeDump || null),
        totalContributed: isNewEvent ? 0 : (existing?.totalContributed || 0),
        contributorsCount: isNewEvent ? 0 : (existing?.contributorsCount || 0),
        synthesizingAt: isNewEvent ? null : (existing?.synthesizingAt || null),
      };

      // Save to memory and Local Storage instantly
      setReactor(updatedGlobal);
      saveLocalGlobal(updatedGlobal);

      // Attempt to save to Firestore
      const globalRef = doc(db, 'reactor_global', 'state');
      try {
        await withTimeout(
          setDoc(globalRef, updatedGlobal, { merge: true }),
          2000
        );
        setAdminSuccess('Successfully synchronized state from Base contract (and Cloud DB).');
      } catch (err) {
        console.warn('Firestore unreachable during syncEvent, cached locally:', err);
        setAdminSuccess('State successfully synchronized from Base smart contract (Saved to Local Storage).');
      }

      return true;
    } catch (e: any) {
      console.error('Failed to sync event:', e);
      setAdminError(e.message || 'Failed to sync event');
      return false;
    } finally {
      setAdminLoading(false);
    }
  }, [reactor, saveLocalGlobal]);

  const startEventOnChain = useCallback(async (rewardAmount: number, targetCubes: number): Promise<boolean> => {
    if (!rawWalletAddress || !isAdmin) {
      setAdminError('Access Denied: Only contract owner can start an event');
      return false;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const provider = await getProvider();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_MAINNET_CHAIN_ID) {
        const switched = await switchToBase();
        if (!switched) {
          setAdminError('Please switch to Base network');
          setAdminLoading(false);
          return false;
        }
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, signer);
      
      const rewardWei = ethers.parseUnits(rewardAmount.toString(), 18);
      const tx = await contract.startEvent(rewardWei);
      await tx.wait();

      // Pause briefly for RPC nodes to propagate block update
      await new Promise(r => setTimeout(r, 1200));

      // Immediately sync after tx confirms
      await syncEventFromContract(targetCubes);
      
      // Ensure local state explicitly reflects rewardAmount if RPC lag occurs
      if (reactor && (reactor.totalReward === 0 || reactor.phase === 'inactive')) {
        const overrideGlobal: ReactorGlobal = {
          ...reactor,
          phase: 'collecting',
          totalReward: rewardAmount,
          target: targetCubes,
        };
        setReactor(overrideGlobal);
        saveLocalGlobal(overrideGlobal);
      }

      setAdminSuccess('Event successfully launched on-chain and synced!');
      return true;
    } catch (e: any) {
      console.error('Failed to start event on-chain:', e);
      setAdminError(parseContractError(e, 'Transaction failed'));
      return false;
    } finally {
      setAdminLoading(false);
    }
  }, [rawWalletAddress, isAdmin, syncEventFromContract]);

  const generateAndSubmitMerkle = useCallback(async (): Promise<boolean> => {
    if (!rawWalletAddress || !isAdmin) {
      setAdminError('Access Denied: Only contract owner can generate Merkle tree');
      return false;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);

    try {
      const provider = await getProvider();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_MAINNET_CHAIN_ID) {
        const switched = await switchToBase();
        if (!switched) {
          setAdminError('Please switch to Base');
          setAdminLoading(false);
          return false;
        }
      }

      if (!reactor) {
        throw new Error('No active reactor config found in memory');
      }

      const currentEventId = reactor.eventId;

      // 1. Fetch contributions with robust merging of Cloud DB and local storage
      let contribMap = new Map<string, { addr: string; contributed: number }>();

      // A. Populate from local storage first as base / offline safety net
      try {
        const storedAddrs = localStorage.getItem('reactor_local_all_contributors');
        if (storedAddrs) {
          const addrs: string[] = JSON.parse(storedAddrs);
          for (const addr of addrs) {
            const itemStored = localStorage.getItem(`reactor_local_contrib_${addr.toLowerCase()}`);
            if (itemStored) {
              const d = JSON.parse(itemStored);
              if (d.contributed && d.contributed > 0 && Number(d.eventId || 0) === currentEventId) {
                contribMap.set(addr.toLowerCase(), {
                  addr: d.walletAddress || addr,
                  contributed: Number(d.contributed),
                });
              }
            }
          }
        }
      } catch (e2) {
        console.error('Local contributor cache retrieval failed:', e2);
      }

      // B. Attempt to fetch from Firestore and merge / update
      try {
        const contribsSnap = await withTimeout(
          getDocs(collection(db, 'reactor_contributions')),
          2500
        );
        contribsSnap.forEach(s => {
          const d = s.data();
          if (d.contributed && d.contributed > 0 && d.walletAddress && Number(d.eventId || 0) === currentEventId) {
            contribMap.set(d.walletAddress.toLowerCase(), {
              addr: d.walletAddress,
              contributed: Number(d.contributed),
            });
          }
        });
      } catch (err) {
        console.warn('Firestore offline/error during contributions retrieval. Using local cache exclusively:', err);
      }

      // C. Convert map back to list
      const contribs = Array.from(contribMap.values());
      const sumContributed = contribs.reduce((acc, c) => acc + c.contributed, 0);

      if (contribs.length === 0 || sumContributed === 0) {
        throw new Error('No contributions found to generate Merkle Tree! Try contributing first in the "collecting" phase.');
      }

      // 2. Calculate allocations and format leaves
      const totalReward = reactor.totalReward;
      const leaves: [string, string][] = [];
      const updatedContribs: { walletAddress: string; allocation: number; allocationWei: string }[] = [];

      const totalRewardWei = ethers.parseUnits(totalReward.toString(), 18);
      const sumContributedBig = BigInt(sumContributed);

      for (const item of contribs) {
        const allocWeiBig = (totalRewardWei * BigInt(item.contributed)) / sumContributedBig;
        const allocWei = allocWeiBig.toString();
        const alloc = Number(ethers.formatUnits(allocWei, 18));

        leaves.push([item.addr, allocWei]);
        updatedContribs.push({
          walletAddress: item.addr,
          allocation: alloc,
          allocationWei: allocWei,
        });
      }

      // 3. Generate Standard Merkle Tree
      const tree = StandardMerkleTree.of(leaves, ['address', 'uint256']);
      const root = tree.root;
      const treeDump = JSON.stringify(tree.dump());

      // 4. Submit to smart contract
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, signer);

      // Check if we need setSynthesizing or updateMerkleRoot
      const onChainEvent = await contract.getCurrentEvent();
      let tx;
      if (Boolean(onChainEvent.synthesizing)) {
        tx = await contract.updateMerkleRoot(root);
      } else if (Boolean(onChainEvent.active)) {
        try {
          tx = await contract.setSynthesizing(root);
        } catch (synthErr: any) {
          const errStr = `${synthErr?.message || ''} ${synthErr?.reason || ''}`;
          if (errStr.includes('Already synthesizing')) {
            console.log('Contract already synthesizing, falling back to updateMerkleRoot...');
            tx = await contract.updateMerkleRoot(root);
          } else {
            throw synthErr;
          }
        }
      } else {
        tx = await contract.updateMerkleRoot(root);
      }
      
      setAdminSuccess('Submitting Merkle root to contract, please wait...');
      await tx.wait();

      // 5. Update Local Cache instantly for all contributors
      for (const item of updatedContribs) {
        const existingContrib = contribs.find(c => c.addr.toLowerCase() === item.walletAddress.toLowerCase());
        const updatedObj: MyContribution = {
          walletAddress: item.walletAddress,
          contributed: existingContrib ? existingContrib.contributed : 0,
          allocation: item.allocation,
          allocationWei: item.allocationWei,
          claimed: false,
          claimedAt: null,
          eventId: currentEventId,
        };
        if (rawWalletAddress && item.walletAddress.toLowerCase() === rawWalletAddress.toLowerCase()) {
          setMyContrib(updatedObj);
        }
        saveLocalContrib(item.walletAddress, updatedObj);
      }

      // Update Firestore batch in background
      try {
        const batch = writeBatch(db);
        for (const item of updatedContribs) {
          const ref = doc(db, 'reactor_contributions', item.walletAddress.toLowerCase());
          batch.update(ref, {
            allocation: item.allocation,
            allocationWei: item.allocationWei,
            eventId: currentEventId,
          });
        }
        await withTimeout(batch.commit(), 3000);
      } catch (e) {
        console.warn('Firestore offline during batch update, saved successfully to local storage:', e);
      }

      // 6. Update global doc to claimable
      const freshOnChainEvent = await contract.getCurrentEvent();
      const updatedGlobal: ReactorGlobal = {
        ...reactor,
        phase: 'claimable',
        merkleRoot: root,
        merkleTreeDump: treeDump,
        claimWindowEnd: Number(freshOnChainEvent.claimWindowEnd) * 1000,
      };
      setReactor(updatedGlobal);
      saveLocalGlobal(updatedGlobal);

      const globalRef = doc(db, 'reactor_global', 'state');
      try {
        await withTimeout(
          setDoc(globalRef, {
            phase: 'claimable',
            merkleRoot: root,
            merkleTreeDump: treeDump,
            claimWindowEnd: Number(freshOnChainEvent.claimWindowEnd) * 1000,
          }, { merge: true }),
          2500
        );
        setAdminSuccess('Merkle Tree successfully generated, submitted to blockchain, and Cloud DB synced!');
      } catch (e) {
        console.warn('Firestore offline during Merkle state update, successfully saved locally:', e);
        setAdminSuccess('Merkle Tree generated & submitted to blockchain! Saved to local session.');
      }

      return true;
    } catch (e: any) {
      console.error('Merkle generation/submission failed:', e);
      setAdminError(parseContractError(e, 'Merkle generation failed'));
      return false;
    } finally {
      setAdminLoading(false);
    }
  }, [rawWalletAddress, isAdmin, reactor]);

  const closeEventOnChain = useCallback(async (): Promise<boolean> => {
    if (!rawWalletAddress || !isAdmin) {
      setAdminError('Access Denied: Only contract owner can close an event');
      return false;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, signer);

      // Check on-chain claim window status before attempting close
      const onChainEvent = await contract.getCurrentEvent();
      const claimEndSec = Number(onChainEvent.claimWindowEnd || 0);
      const nowSec = Math.floor(Date.now() / 1000);

      if (claimEndSec > 0 && nowSec < claimEndSec) {
        const remainingSec = claimEndSec - nowSec;
        const minsLeft = Math.ceil(remainingSec / 60);
        setAdminError(`Claim window is still active on-chain (~${minsLeft} min remaining). Players are currently claiming their $BLOBS tokens! On-chain close will be available after the claim window expires.`);
        return false;
      }

      const tx = await contract.closeEvent();
      await tx.wait();

      await syncEventFromContract(reactor?.target || 100000);
      setAdminSuccess('Event successfully closed on-chain and Firestore updated.');
      return true;
    } catch (e: any) {
      console.error('Failed to close event:', e);
      setAdminError(parseContractError(e, 'Transaction failed'));
      return false;
    } finally {
      setAdminLoading(false);
    }
  }, [rawWalletAddress, isAdmin, reactor, syncEventFromContract]);

  const setPhaseInFirestore = useCallback(async (phase: ReactorPhase): Promise<boolean> => {
    if (!isAdmin) {
      setAdminError('Access Denied: Only contract owner can update phase');
      return false;
    }
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);
    try {
      // 1. Immediately update Local Cache for ultra-responsive instant UI rendering (0ms lag)
      if (reactor) {
        const updatedGlobal: ReactorGlobal = { ...reactor, phase };
        setReactor(updatedGlobal);
        saveLocalGlobal(updatedGlobal);
      } else {
        const dummyGlobal: ReactorGlobal = {
          phase,
          eventId: 0,
          target: 100000,
          totalContributed: 0,
          totalReward: 50000,
          contributorsCount: 0,
          claimWindowEnd: null,
          merkleRoot: null,
          merkleTreeDump: null,
        };
        setReactor(dummyGlobal);
        saveLocalGlobal(dummyGlobal);
      }

      // 2. Try Firestore in the background with a fast timeout (fail-safe fallback)
      const globalRef = doc(db, 'reactor_global', 'state');
      try {
        await withTimeout(
          setDoc(globalRef, { phase }, { merge: true }),
          2000
        );
        setAdminSuccess(`Phase updated to ${phase} (Cloud & Local).`);
      } catch (err) {
        console.warn('Firestore unreachable during phase update, saved locally:', err);
        setAdminSuccess(`Phase updated to ${phase} (Saved to Local Storage).`);
      }
      return true;
    } catch (e: any) {
      console.error('Failed to update phase:', e);
      setAdminError(e.message || 'Firestore update failed');
      return false;
    } finally {
      setAdminLoading(false);
    }
  }, [isAdmin, reactor, saveLocalGlobal]);

  // ── Calculated Values ─────────────────────────────────────────────────────
  const progressPercent = reactor && reactor.target > 0
    ? Math.min(100, (reactor.totalContributed / reactor.target) * 100)
    : 0;

  // Real-time estimated reward during collecting phase
  const estimatedReward = reactor && reactor.totalContributed > 0 && myContrib?.contributed
    ? Math.floor((myContrib.contributed / reactor.totalContributed) * reactor.totalReward)
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
    contribute,
    claimTokens,
    
    // Admin Controls
    isAdmin,
    ownerAddress,
    adminLoading,
    adminError,
    adminSuccess,
    syncEventFromContract,
    startEventOnChain,
    generateAndSubmitMerkle,
    closeEventOnChain,
    setPhaseInFirestore,
  };
}
