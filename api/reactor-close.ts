import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { ethers } from 'ethers';
import { REACTOR_ADDRESS, BASE_RPC } from '../src/contracts/reactorConfig.js';
import { BLOB_REACTOR_ABI } from '../src/contracts/reactorABI.js';

function getAdminDb(): Firestore {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not configured.');
  }

  if (!getApps().length) {
    try {
      const serviceAccount = JSON.parse(key);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (err: any) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${err.message}`);
    }
  }

  return getFirestore('ai-studio-baseblobs-b454a390-ce86-4da0-9cdd-300e7ddd380c');
}

const ADMIN_SECRET = process.env.REACTOR_CLOSE_SECRET;

export async function executeReactorClose(db: Firestore, force = false) {
  const globalRef = db.collection('reactor_global').doc('state');

  // Atomically check condition and mark as closing inside a transaction to prevent concurrent execution
  const stateData = await db.runTransaction(async (tx) => {
    const snap = await tx.get(globalRef);
    if (!snap.exists) {
      return null;
    }

    const d = snap.data()!;
    if (d.phase !== 'collecting' && !force) {
      return { cannotClose: true, reason: 'not_collecting', phase: d.phase };
    }

    const totalContributed = Number(d.totalContributed || 0);
    const target = Number(d.target || Infinity);

    if (totalContributed < target && !force) {
      return { cannotClose: true, reason: 'target_not_reached', totalContributed, target };
    }

    tx.update(globalRef, { phase: 'closing' });
    return d;
  });

  if (!stateData) {
    return { closed: false, reason: 'No active reactor state' };
  }

  if ('cannotClose' in stateData) {
    if (stateData.reason === 'not_collecting') {
      return { closed: false, phase: stateData.phase };
    }
    return { closed: false, totalContributed: stateData.totalContributed, target: stateData.target };
  }

  const totalReward = Number(stateData.totalReward || 0);
  const totalContributed = Number(stateData.totalContributed || 0);
  const totalRewardWei = ethers.parseUnits(totalReward.toString(), 18);

  const currentEventId = Number(stateData.eventId || 0);

  // Collect all contributions for current event
  const contribSnap = await db.collection('reactor_contributions')
    .where('eventId', '==', currentEventId)
    .get();
  const entriesMap = new Map<string, { addr: string; contributed: number }>();

  contribSnap.forEach((doc) => {
    const d = doc.data();
    if (Number(d.eventId || 0) !== currentEventId) return;
    const contributed = Number(d.contributed || 0);
    const addr = String(d.walletAddress || doc.id).toLowerCase();
    if (contributed > 0) {
      entriesMap.set(addr, { addr, contributed });
    }
  });

  const contribs = Array.from(entriesMap.values());
  if (contribs.length === 0 || totalContributed === 0) {
    await globalRef.update({ phase: 'collecting' });
    return { closed: false, reason: 'No contributions' };
  }

  // Calculate allocation in wei for each address
  // shareWei = (totalRewardWei * contributed) / totalContributed
  const sumContributedBig = BigInt(totalContributed);
  const entries: [string, string][] = [];
  const allocationsList: { addr: string; allocTokens: number; allocWei: string }[] = [];

  for (const c of contribs) {
    const shareWei = (totalRewardWei * BigInt(c.contributed)) / sumContributedBig;
    const shareWeiStr = shareWei.toString();
    const allocTokens = Number(ethers.formatUnits(shareWei, 18));

    entries.push([c.addr, shareWeiStr]);
    allocationsList.push({
      addr: c.addr,
      allocTokens,
      allocWei: shareWeiStr,
    });
  }

  // Build standard Merkle tree
  const tree = StandardMerkleTree.of(entries, ['address', 'uint256']);
  const merkleRoot = tree.root;
  const merkleTreeDump = JSON.stringify(tree.dump());

  let txHash: string | null = null;
  let newEventId = Number(stateData.eventId || 0);

  // Publish Merkle root on-chain (required)
  const operatorKey = process.env.REACTOR_OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!operatorKey) {
    await globalRef.update({ phase: 'collecting' });
    throw new Error('REACTOR_OPERATOR_PRIVATE_KEY is not configured, cannot publish root');
  }

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const wallet = new ethers.Wallet(operatorKey, provider);
    const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, wallet);

    const tx = await contract.publishRoot(merkleRoot, totalRewardWei);
    txHash = tx.hash;
    await tx.wait();

    const onChainEventId = await contract.currentEventId();
    newEventId = Number(onChainEventId);
  } catch (onChainErr: any) {
    console.error('Failed to publish root on-chain:', onChainErr);
    await globalRef.update({ phase: 'collecting' }); // rollback phase back to collecting
    throw new Error('On-chain publishRoot failed: ' + (onChainErr.message || onChainErr));
  }

  // Update all contributor docs in Firestore with proofs and allocations
  const batch = db.batch();
  for (const item of allocationsList) {
    const proof = tree.getProof([item.addr, item.allocWei]);
    const userRef = db.collection('reactor_contributions').doc(item.addr);
    batch.set(
      userRef,
      {
        allocation: item.allocTokens,
        allocationWei: item.allocWei,
        merkleProof: proof,
        eventId: newEventId,
        claimed: false,
        claimedAt: null,
      },
      { merge: true }
    );
  }

  const claimWindowEnd = Date.now() + 7 * 86400 * 1000; // 7 days claim window

  batch.update(globalRef, {
    phase: 'claimable',
    eventId: newEventId,
    merkleRoot,
    merkleTreeDump,
    claimWindowEnd,
  });

  await batch.commit();

  return {
    closed: true,
    root: merkleRoot,
    eventId: newEventId,
    txHash,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: allow this endpoint to be called from tools/pages hosted on a different origin
  // (e.g. a standalone admin HTML page). Access is still gated by the x-admin-secret check below.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ADMIN_SECRET || req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getAdminDb();
    const forceClose = req.body?.force === true;
    const result = await executeReactorClose(db, forceClose);
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('Reactor close handler error:', e);
    return res.status(500).json({ error: e.message || 'Failed to close reactor' });
  }
}