import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
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

  const { action } = req.body || {};

  try {
    const db = getAdminDb();
    const globalRef = db.collection('reactor_global').doc('state');

    if (action === 'start_event') {
      const { rewardAmount, targetCubes } = req.body || {};
      const snap = await globalRef.get();
      const existing = snap.exists ? snap.data()! : {};

      const newEventId = Number(existing.eventId || 0) + 1;

      const updatedData = {
        phase: 'collecting',
        eventId: newEventId,
        target: Number(targetCubes || 100000),
        totalReward: Number(rewardAmount || 50000),
        totalContributed: 0,
        contributorsCount: 0,
        claimWindowEnd: null,
        merkleRoot: null,
        merkleTreeDump: null,
        synthesizingAt: null,
        updatedAt: Date.now(),
      };

      await globalRef.set(updatedData, { merge: true });
      return res.status(200).json({ success: true, state: updatedData });
    }

    if (action === 'sync_event') {
      const { targetCubes } = req.body || {};
      const provider = new ethers.JsonRpcProvider(BASE_RPC);
      const contract = new ethers.Contract(REACTOR_ADDRESS, BLOB_REACTOR_ABI, provider);

      const currentEvIdBig = await contract.currentEventId();
      const eventId = Number(currentEvIdBig);
      let merkleRoot: string | null = null;
      let totalReward = 50000;

      if (eventId > 0) {
        const rootOnChain = await contract.merkleRoots(eventId);
        if (rootOnChain && rootOnChain !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          merkleRoot = rootOnChain;
        }
        const poolOnChain = await contract.eventTotalPool(eventId);
        if (poolOnChain > 0n) {
          totalReward = Number(ethers.formatUnits(poolOnChain, 18));
        }
      }

      const snap = await globalRef.get();
      const existing = snap.exists ? snap.data()! : {};
      const isNewEvent = Number(existing.eventId || 0) !== eventId;

      let phase = existing.phase || 'inactive';
      if (merkleRoot) {
        phase = 'claimable';
      }

      const updatedData = {
        phase,
        eventId,
        target: Number(targetCubes || existing.target || 100000),
        totalReward,
        merkleRoot,
        merkleTreeDump: isNewEvent ? null : (existing.merkleTreeDump || null),
        totalContributed: isNewEvent ? 0 : (existing.totalContributed || 0),
        contributorsCount: isNewEvent ? 0 : (existing.contributorsCount || 0),
        claimWindowEnd: existing.claimWindowEnd || null,
        synthesizingAt: isNewEvent ? null : (existing.synthesizingAt || null),
        updatedAt: Date.now(),
      };

      await globalRef.set(updatedData, { merge: true });
      return res.status(200).json({ success: true, state: updatedData });
    }

    if (action === 'set_phase') {
      const { phase } = req.body || {};
      if (!phase) {
        return res.status(400).json({ error: 'Missing phase' });
      }

      await globalRef.set({ phase, updatedAt: Date.now() }, { merge: true });
      return res.status(200).json({ success: true, phase });
    }

    return res.status(400).json({ error: 'Unknown admin action' });
  } catch (e: any) {
    console.error('Reactor admin handler error:', e);
    return res.status(500).json({ error: e.message || 'Reactor admin request failed' });
  }
}