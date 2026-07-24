import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import {
  ZONES,
  applyUpgrades,
  NODE_CONFIG,
  XP4LV,
  getBlobStats,
  EVENT_WEIGHTS,
  EXPEDITION_EVENTS,
  UPGRADES,
} from '../src/data.js';
import type { ExpeditionEventType } from '../src/types.js';

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

  const db = getFirestore('ai-studio-baseblobs-b454a390-ce86-4da0-9cdd-300e7ddd380c');
  return db;
}

function rollExpeditionEvent(): typeof EXPEDITION_EVENTS[ExpeditionEventType] {
  const total = Object.values(EVENT_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of Object.entries(EVENT_WEIGHTS) as [ExpeditionEventType, number][]) {
    roll -= weight;
    if (roll <= 0) return EXPEDITION_EVENTS[type];
  }
  return EXPEDITION_EVENTS.normal;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({
      error: 'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not configured on the server.',
    });
  }

  const { type, syncId, walletAddress } = req.body || {};

  if (!syncId || !walletAddress) {
    return res.status(400).json({ error: 'Missing syncId or walletAddress' });
  }

  const expectedSyncId = `wallet_${walletAddress.toLowerCase()}`;
  if (syncId.toLowerCase() !== expectedSyncId) {
    return res.status(400).json({ error: 'Invalid syncId / walletAddress mismatch' });
  }

  try {
    const db = getAdminDb();

    if (type === 'expedition') {
      const { blobId } = req.body;
      if (!blobId) {
        return res.status(400).json({ error: 'Missing blobId' });
      }
      const updatedState = await claimExpedition(db, syncId, blobId);
      return res.status(200).json(updatedState);
    }

    if (type === 'node') {
      const { nodeId } = req.body;
      if (!nodeId) {
        return res.status(400).json({ error: 'Missing nodeId' });
      }
      const updatedState = await claimNode(db, syncId, walletAddress, nodeId);
      return res.status(200).json(updatedState);
    }

    return res.status(400).json({ error: 'Unknown claim type' });
  } catch (e: any) {
    console.error('Claim handler error:', e);
    return res.status(400).json({ error: e.message || 'Claim failed' });
  }
}

async function claimExpedition(db: Firestore, syncId: string, blobId: string) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const expeditions: any[] = state.activeExpeditions || (state.activeExpedition ? [state.activeExpedition] : []);
    const exp = expeditions.find((e) => e.blobIds?.includes(blobId) || e.blobId === blobId);
    if (!exp) {
      // Expedition already claimed and removed by a concurrent request — return current state
      return state;
    }

    const now = Date.now();
    if (now < exp.endTime) {
      throw new Error('Expedition is not finished yet');
    }

    const zone = ZONES.find((z) => z.id === exp.zoneId);
    if (!zone) throw new Error('Unknown expedition zone');

    const activeBlobIds: string[] = exp.blobIds || [exp.blobId || blobId];
    const activeBlobs = (state.blobs || []).filter((b: any) => activeBlobIds.includes(b.id));
    if (!activeBlobs.length) throw new Error('Expedition blob not found');

    // Calculate reward
    const baseReward = Math.round(zone.reward[0] + Math.random() * (zone.reward[1] - zone.reward[0]));
    let xpGain = zone.xp;

    const maxHarvestLevel = activeBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.harvest || 0), 0);
    const maxFortuneLevel = activeBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.fortune || 0), 0);

    const statsList = activeBlobs.map((b: any) => getBlobStats(b.personality, b.level));
    const avgLuck = statsList.reduce((acc: number, s: any) => acc + s.luck, 0) / statsList.length;

    const fakeUpgrades = { speed: 0, harvest: maxHarvestLevel, fortune: maxFortuneLevel };
    const { reward: upgradedReward, bonusChance } = applyUpgrades(baseReward, 0, 0.30, fakeUpgrades);
    let reward = upgradedReward;

    const fortuneBonus = maxFortuneLevel > 0 ? UPGRADES[2].levels[maxFortuneLevel - 1].value : 0;
    const luckCritChance = Math.min(0.95, avgLuck * 0.004 + fortuneBonus);
    if (Math.random() < luckCritChance) {
      reward = reward * 2;
    }

    const hasLucky = activeBlobs.some((b: any) => b.personality === 'lucky');
    const hasCosmicHighLv = activeBlobs.some((b: any) => b.personality === 'cosmic' && b.level >= 10);
    const hasChaotic = activeBlobs.some((b: any) => b.personality === 'chaotic');

    if (hasLucky) reward = Math.round(reward * 1.15);
    if (hasCosmicHighLv) reward = Math.round(reward * 1.25);
    if (hasChaotic && Math.random() < bonusChance) {
      reward = Math.round(reward * 1.5);
    }

    const event = rollExpeditionEvent();
    reward = Math.round(reward * event.cubeMultiplier);
    xpGain = Math.round(xpGain * event.xpMultiplier);

    if (exp.charmActive) {
      reward = Math.round(reward * 2);
    }

    let blobCharms = state.blobCharms || 0;
    if (event.bonusItem === 'blob_charm') {
      blobCharms += 1;
    }

    const newCubes = (state.cubes || 0) + reward;
    const totalCubesAllTime = (state.totalCubesAllTime || 0) + reward;
    const totalExpeditionsAllTime = (state.totalExpeditionsAllTime || 0) + 1;
    const cubesCollectedToday = (state.cubesCollectedToday || 0) + reward;
    const expeditionsToday = (state.expeditionsToday || 0) + 1;

    // Update blobs
    const updatedBlobs = (state.blobs || []).map((blob: any) => {
      if (!activeBlobIds.includes(blob.id)) return blob;

      let blobXpGain = xpGain;
      if (blob.personality === 'happy') blobXpGain = Math.round(blobXpGain * 1.2);

      let currentXp = (blob.xp ?? blob.experience ?? 0) + blobXpGain;
      let currentLevel = blob.level || 1;

      while (currentXp >= XP4LV(currentLevel) && currentLevel < 20) {
        currentXp -= XP4LV(currentLevel);
        currentLevel++;
      }

      return {
        ...blob,
        xp: currentXp,
        level: currentLevel,
        totalExpeditions: (blob.totalExpeditions || 0) + 1,
        totalCubesEarned: (blob.totalCubesEarned || 0) + reward,
      };
    });

    const remainingExpeditions = expeditions.filter((e) => e !== exp);

    // Quests check
    const questDone = { ...(state.questDone || {}) };
    if (!questDone.exp && expeditionsToday >= 1) questDone.exp = true;
    if (!questDone.cubes && cubesCollectedToday >= 100) questDone.cubes = true;

    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      totalCubesAllTime,
      totalExpeditionsAllTime,
      cubesCollectedToday,
      expeditionsToday,
      blobCharms,
      lastExpeditionEvent: event,
      activeExpeditions: remainingExpeditions,
      activeExpedition: null,
      blobs: updatedBlobs,
      questDone,
      rev: newRev,
      lastUpdated: now,
    };

    tx.update(saveRef, updatePayload);

    return {
      ...state,
      ...updatePayload,
    };
  });
}

async function claimNode(db: Firestore, syncId: string, walletAddress: string, nodeId: string) {
  const saveRef = db.collection('saves').doc(syncId);
  const nodeRef = db.collection('nodes').doc(nodeId);

  return db.runTransaction(async (tx) => {
    const [saveSnap, nodeSnap] = await Promise.all([tx.get(saveRef), tx.get(nodeRef)]);
    if (!saveSnap.exists) throw new Error('Save not found');
    if (!nodeSnap.exists) throw new Error('Node not found');

    const state = saveSnap.data()!;
    const node = nodeSnap.data()!;

    if (!node.owner || node.owner.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('You do not own this node');
    }
    if (!node.lastCollected) throw new Error('Node has no collection history');

    const now = Date.now();
    const rate = typeof node.cubesPerHour === 'number' && !isNaN(node.cubesPerHour)
      ? node.cubesPerHour
      : (NODE_CONFIG.cubesPerHour[node.tier as keyof typeof NODE_CONFIG.cubesPerHour] || 10);

    const hoursElapsed = Math.max(0, (now - node.lastCollected) / 3600000);
    const pendingCubes = Math.min(
      Math.floor(hoursElapsed * rate),
      rate * NODE_CONFIG.maxAccumulationHours
    );

    if (pendingCubes <= 0) {
      return { ...state, reward: 0 };
    }

    const holdHours = node.capturedAt ? Math.max(0, (now - node.capturedAt) / 3600000) : 0;
    const newFortifyBonus = Math.min(
      NODE_CONFIG.maxFortifyBonus,
      Math.floor(holdHours / 24) * NODE_CONFIG.fortifyBonusPerDay
    );

    const fortifyMult = 1 + (newFortifyBonus || 0) / 100;
    const reward = Math.round(pendingCubes * fortifyMult);

    const newCubes = (state.cubes || 0) + reward;
    const totalCubesAllTime = (state.totalCubesAllTime || 0) + reward;
    const cubesCollectedToday = (state.cubesCollectedToday || 0) + reward;

    const questDone = { ...(state.questDone || {}) };
    if (!questDone.cubes && cubesCollectedToday >= 100) questDone.cubes = true;

    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      totalCubesAllTime,
      cubesCollectedToday,
      questDone,
      rev: newRev,
      lastUpdated: now,
    };

    tx.update(saveRef, updatePayload);
    tx.update(nodeRef, {
      lastCollected: now,
      fortifyBonus: newFortifyBonus,
    });

    return {
      ...state,
      ...updatePayload,
      reward,
    };
  });
}
