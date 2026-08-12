import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { processExpeditionCompletion, calcNextExpeditionEndTime, getOrCreateSaveState } from './claim.js';

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

const CLEANUP_SECRET = process.env.CLEANUP_SECRET;

export async function cleanupExpiredExpeditions(db: Firestore): Promise<{ candidates: number; closed: number }> {
  const now = Date.now();
  const candidatesSnap = await db
    .collection('saves')
    .where('nextExpeditionEndTime', '<=', now)
    .limit(500)
    .get();

  const candidatesCount = candidatesSnap.size;
  let totalClosed = 0;

  for (const doc of candidatesSnap.docs) {
    const saveRef = doc.ref;
    try {
      const closedCount = await db.runTransaction(async (tx) => {
        const { state } = await getOrCreateSaveState(tx, saveRef);
        const expeditions: any[] = state.activeExpeditions || (state.activeExpedition ? [state.activeExpedition] : []);
        const expiredExps = expeditions.filter((e: any) => e && typeof e.endTime === 'number' && e.endTime <= now);

        if (expiredExps.length === 0) {
          const correctNext = calcNextExpeditionEndTime(expeditions);
          if (state.nextExpeditionEndTime !== correctNext) {
            tx.update(saveRef, { nextExpeditionEndTime: correctNext });
          }
          return 0;
        }

        let currState = { ...state };
        let count = 0;

        for (const exp of expiredExps) {
          try {
            currState = processExpeditionCompletion(currState, exp, now);
            count++;
          } catch (expErr) {
            console.warn(`Failed to auto-complete expedition for doc ${doc.id}:`, expErr);
          }
        }

        if (count > 0) {
          const {
            cubes,
            totalCubesAllTime,
            totalExpeditionsAllTime,
            cubesCollectedToday,
            expeditionsToday,
            blobCharms,
            lastExpeditionEvent,
            activeExpeditions,
            activeExpedition,
            nextExpeditionEndTime,
            blobs,
            rev,
            lastUpdated,
          } = currState;

          tx.update(saveRef, {
            cubes,
            totalCubesAllTime,
            totalExpeditionsAllTime,
            cubesCollectedToday,
            expeditionsToday,
            blobCharms,
            lastExpeditionEvent,
            activeExpeditions,
            activeExpedition,
            nextExpeditionEndTime,
            blobs,
            rev,
            lastUpdated,
          });
        }

        return count;
      });

      totalClosed += closedCount;
    } catch (docErr) {
      console.error(`Error during transaction for doc ${doc.id}:`, docErr);
    }
  }

  return { candidates: candidatesCount, closed: totalClosed };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cleanup-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!CLEANUP_SECRET || req.headers['x-cleanup-secret'] !== CLEANUP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({
      error: 'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not configured on the server.',
    });
  }

  try {
    const db = getAdminDb();
    const result = await cleanupExpiredExpeditions(db);
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('Cleanup expired expeditions handler error:', e);
    return res.status(500).json({ error: e.message || 'Failed to cleanup expired expeditions' });
  }
}
