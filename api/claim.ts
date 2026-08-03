import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { verifySessionToken } from './auth.js';
import { executeReactorClose } from './reactor-close.js';
import {
  ZONES,
  applyUpgrades,
  NODE_CONFIG,
  XP4LV,
  getBlobStats,
  EVENT_WEIGHTS,
  EXPEDITION_EVENTS,
  UPGRADES,
  PKEYS,
  calcBlobPower,
  calcAttackPower,
  canUpgrade,
  getEvolutionStage,
  getBlobBranches,
  rollBlobBranches,
  getUpgradeValue,
  EREGEN,
} from '../src/data.js';
import type { ExpeditionEventType, PersonalityType, UpgradeBranchId } from '../src/types.js';

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

const ENERGY_PACKAGES: Record<string, { amount: number; price: number }> = {
  small: { amount: 50, price: 500 },
  medium: { amount: 120, price: 1000 },
  large: { amount: 300, price: 2200 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({
      error: 'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not configured on the server.',
    });
  }

  const { type, syncId, walletAddress, sessionToken, token } = req.body || {};
  const authToken = sessionToken || token;

  if (!syncId || !walletAddress) {
    return res.status(400).json({ error: 'Missing syncId or walletAddress' });
  }

  const expectedSyncId = `wallet_${walletAddress.toLowerCase()}`;
  if (syncId.toLowerCase() !== expectedSyncId) {
    return res.status(400).json({ error: 'Invalid syncId / walletAddress mismatch' });
  }

  if (!authToken) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  try {
    verifySessionToken(authToken, walletAddress);
  } catch (sigErr: any) {
    return res.status(401).json({ error: sigErr.message || 'Session expired, please reconnect wallet' });
  }

  try {
    const db = getAdminDb();

    if (type === 'status' || type === 'sync' || type === 'get_state') {
      const saveRef = db.collection('saves').doc(syncId);
      const snap = await saveRef.get();
      if (!snap.exists) {
        return res.status(200).json({ status: 'ok', state: null });
      }
      let state = snap.data()!;
      const now = Date.now();
      const expeditions: any[] = state.activeExpeditions || (state.activeExpedition ? [state.activeExpedition] : []);
      const finishedExp = expeditions.find((e: any) => e && e.endTime && now >= e.endTime);

      if (finishedExp) {
        const activeIds = finishedExp.blobIds || (finishedExp.blobId ? [finishedExp.blobId] : []);
        const primaryBlobId = activeIds[0];
        if (primaryBlobId) {
          try {
            state = await claimExpedition(db, syncId, primaryBlobId);
          } catch (e) {
            console.warn('Auto-claiming finished expedition on status check failed:', e);
          }
        }
      }

      return res.status(200).json({ status: 'ok', state });
    }

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

    if (type === 'collect_all_nodes') {
      const updatedState = await claimAllNodes(db, syncId, walletAddress);
      return res.status(200).json(updatedState);
    }

    if (type === 'reactor_contribute') {
      const { eventId, amount } = req.body || {};
      if (typeof eventId !== 'number' || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Missing or invalid eventId/amount' });
      }
      const updatedState = await claimReactorContribute(db, syncId, walletAddress, eventId, amount);
      return res.status(200).json(updatedState);
    }

    if (type === 'attack_node') {
      const { nodeId, blobId } = req.body || {};
      if (!nodeId || !blobId) {
        return res.status(400).json({ error: 'Missing nodeId or blobId' });
      }
      const result = await claimAttackNode(db, syncId, walletAddress, nodeId, blobId);
      return res.status(200).json(result);
    }

    if (type === 'summon') {
      const updatedState = await claimSummon(db, syncId);
      return res.status(200).json(updatedState);
    }

    if (type === 'unlock_species') {
      const { personality } = req.body || {};
      if (!personality) {
        return res.status(400).json({ error: 'Missing personality' });
      }
      const updatedState = await claimUnlockSpecies(db, syncId, personality);
      return res.status(200).json(updatedState);
    }

    if (type === 'upgrade_blob') {
      const { blobId, branch } = req.body || {};
      if (!blobId || !branch) {
        return res.status(400).json({ error: 'Missing blobId or branch' });
      }
      // Ветка из тела запроса — недоверенный ввод: сверяем со списком
      // известных веток до похода в транзакцию.
      if (!UPGRADES.some((u) => u.id === branch)) {
        return res.status(400).json({ error: 'Invalid upgrade branch' });
      }
      const updatedState = await claimUpgradeBlob(db, syncId, blobId, branch);
      return res.status(200).json(updatedState);
    }

    if (type === 'buy_energy') {
      const { packageId, amount } = req.body || {};
      const pkgKey = packageId || (amount === 50 ? 'small' : 'small');
      const pkg = ENERGY_PACKAGES[pkgKey];
      if (!pkg) {
        return res.status(400).json({ error: 'Invalid energy package' });
      }
      const updatedState = await claimBuyEnergy(db, syncId, pkg.amount, pkg.price);
      return res.status(200).json(updatedState);
    }

    if (type === 'start_expedition') {
      const { zoneId, blobId, blobIds } = req.body || {};
      const targetBlobIds = Array.isArray(blobIds) && blobIds.length > 0 ? blobIds : (blobId ? [blobId] : []);
      if (!zoneId || targetBlobIds.length === 0) {
        return res.status(400).json({ error: 'Missing zoneId or blobIds' });
      }
      const updatedState = await claimStartExpedition(db, syncId, zoneId, targetBlobIds);
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

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const expeditions: any[] = state.activeExpeditions || (state.activeExpedition ? [state.activeExpedition] : []);
    const exp = expeditions.find((e) => e.blobIds?.includes(blobId) || e.blobId === blobId);
    if (!exp) {
      return state;
    }

    if (now < exp.endTime) {
      throw new Error('Expedition is not finished yet');
    }

    const zone = ZONES.find((z) => z.id === exp.zoneId);
    if (!zone) throw new Error('Unknown expedition zone');

    const activeBlobIds: string[] = exp.blobIds || [exp.blobId || blobId];
    const activeBlobs = (state.blobs || []).filter((b: any) => activeBlobIds.includes(b.id));
    if (!activeBlobs.length) throw new Error('Expedition blob not found');

    const baseReward = Math.round(zone.reward[0] + Math.random() * (zone.reward[1] - zone.reward[0]));
    let xpGain = zone.xp;

    const maxHarvestLevel = activeBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.harvest || 0), 0);
    const maxFortuneLevel = activeBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.fortune || 0), 0);
    const maxInsightLevel = activeBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.insight || 0), 0);

    const statsList = activeBlobs.map((b: any) => getBlobStats(b.personality, b.level));
    const avgLuck = statsList.reduce((acc: number, s: any) => acc + s.luck, 0) / statsList.length;

    const fakeUpgrades = {
      speed: 0,
      harvest: maxHarvestLevel,
      fortune: maxFortuneLevel,
      insight: maxInsightLevel,
    };
    const { reward: upgradedReward, bonusChance, xpMult } = applyUpgrades(baseReward, 0, 0.30, fakeUpgrades);
    let reward = upgradedReward;

    // Insight — новая ветка: больше опыта за экспедицию
    xpGain = Math.round(xpGain * xpMult);

    // Поиск по id, а не по индексу UPGRADES: добавление новых веток
    // не должно молча сдвигать расчёт fortune.
    const fortuneBonus = getUpgradeValue('fortune', maxFortuneLevel, 0);
    const luckCritChance = Math.min(0.50, avgLuck * 0.0015 + fortuneBonus);
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

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    if (!node.owner || node.owner.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('You do not own this node');
    }
    if (!node.lastCollected) throw new Error('Node has no collection history');

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

/**
 * Собирает кубы со ВСЕХ нод игрока в одной транзакции.
 *
 * Зачем отдельный тип, а не цикл по 'node' с клиента: на каждом действии стоит
 * анти-спам проверка lastUpdated (1 сек). Поштучные запросы из collectAll влетали
 * в неё сами же и молча падали — собиралась только первая нода.
 *
 * Владение и накопленные кубы считаются ТОЛЬКО из Firestore внутри транзакции,
 * тело запроса не влияет ни на что кроме walletAddress (уже сверен с sessionToken).
 */
async function claimAllNodes(db: Firestore, syncId: string, walletAddress: string) {
  const saveRef = db.collection('saves').doc(syncId);
  const ownerId = walletAddress.toLowerCase();
  const myNodesQuery = db.collection('nodes').where('owner', '==', ownerId);

  return db.runTransaction(async (tx) => {
    // Все чтения — до записей (требование Firestore)
    const [saveSnap, nodesSnap] = await Promise.all([
      tx.get(saveRef),
      tx.get(myNodesQuery),
    ]);
    if (!saveSnap.exists) throw new Error('Save not found');

    const state = saveSnap.data()!;
    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    let totalReward = 0;
    const collectedNodeIds: string[] = [];
    const nodeUpdates: { ref: any; lastCollected: number; fortifyBonus: number }[] = [];

    nodesSnap.forEach((doc) => {
      const node = doc.data();

      // Перепроверка владения на сервере, несмотря на фильтр запроса
      if (!node.owner || String(node.owner).toLowerCase() !== ownerId) return;
      if (!node.lastCollected) return;

      const rate = typeof node.cubesPerHour === 'number' && !isNaN(node.cubesPerHour)
        ? node.cubesPerHour
        : (NODE_CONFIG.cubesPerHour[node.tier as keyof typeof NODE_CONFIG.cubesPerHour] || 10);

      const hoursElapsed = Math.max(0, (now - node.lastCollected) / 3600000);
      const pendingCubes = Math.min(
        Math.floor(hoursElapsed * rate),
        rate * NODE_CONFIG.maxAccumulationHours
      );

      if (pendingCubes <= 0) return;

      const holdHours = node.capturedAt ? Math.max(0, (now - node.capturedAt) / 3600000) : 0;
      const newFortifyBonus = Math.min(
        NODE_CONFIG.maxFortifyBonus,
        Math.floor(holdHours / 24) * NODE_CONFIG.fortifyBonusPerDay
      );

      const fortifyMult = 1 + (newFortifyBonus || 0) / 100;
      totalReward += Math.round(pendingCubes * fortifyMult);

      collectedNodeIds.push(doc.id);
      nodeUpdates.push({ ref: doc.ref, lastCollected: now, fortifyBonus: newFortifyBonus });
    });

    if (totalReward <= 0) {
      return { ...state, reward: 0, collectedNodeIds: [], collectedCount: 0 };
    }

    const newCubes = (state.cubes || 0) + totalReward;
    const totalCubesAllTime = (state.totalCubesAllTime || 0) + totalReward;
    const cubesCollectedToday = (state.cubesCollectedToday || 0) + totalReward;

    const questDone = { ...(state.questDone || {}) };
    if (!questDone.cubes && cubesCollectedToday >= 100) questDone.cubes = true;

    const updatePayload = {
      cubes: newCubes,
      totalCubesAllTime,
      cubesCollectedToday,
      questDone,
      rev: (state.rev || 0) + 1,
      lastUpdated: now,
    };

    tx.update(saveRef, updatePayload);
    for (const upd of nodeUpdates) {
      tx.update(upd.ref, {
        lastCollected: upd.lastCollected,
        fortifyBonus: upd.fortifyBonus,
      });
    }

    return {
      ...state,
      ...updatePayload,
      reward: totalReward,
      collectedNodeIds,
      collectedCount: collectedNodeIds.length,
    };
  });
}

async function claimReactorContribute(
  db: Firestore,
  syncId: string,
  walletAddress: string,
  eventId: number,
  amount: number,
) {
  const saveRef = db.collection('saves').doc(syncId);
  const globalRef = db.collection('reactor_global').doc('state');
  const contribRef = db.collection('reactor_contributions').doc(walletAddress.toLowerCase());

  let isTargetReached = false;

  const result = await db.runTransaction(async (tx) => {
    const [saveSnap, globalSnap, contribSnap] = await Promise.all([
      tx.get(saveRef),
      tx.get(globalRef),
      tx.get(contribRef),
    ]);

    if (!saveSnap.exists) throw new Error('Save not found');
    const state = saveSnap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    if (!globalSnap.exists) throw new Error('Reactor not initialized');
    const global = globalSnap.data()!;

    if (global.phase !== 'collecting') {
      throw new Error('Reactor is not in the collecting phase');
    }
    if (Number(global.eventId) !== Number(eventId)) {
      throw new Error('Event mismatch — reactor has moved to a new event');
    }

    const currentCubes = Number(state.cubes || 0);
    if (currentCubes < amount) {
      throw new Error('Not enough cubes');
    }

    const existingContrib = contribSnap.exists ? contribSnap.data()! : null;
    const isSameEvent = existingContrib && Number(existingContrib.eventId || 0) === eventId;
    const priorContributed = isSameEvent ? Number(existingContrib!.contributed || 0) : 0;
    const MAX_CONTRIBUTION_PER_EVENT = 10000;
    if (priorContributed + amount > MAX_CONTRIBUTION_PER_EVENT) {
      throw new Error(`Contribution cap reached (${MAX_CONTRIBUTION_PER_EVENT} per event)`);
    }

    const newCubes = currentCubes - amount;
    const newRev = (state.rev || 0) + 1;

    const newTotalContributed = Number(global.totalContributed || 0) + amount;
    const targetCubes = Number(global.target || Infinity);
    if (Number(global.totalContributed || 0) >= targetCubes) {
      throw new Error('Reactor target already reached, wait for the next event');
    }
    if (newTotalContributed > targetCubes) {
      throw new Error(`Only ${targetCubes - Number(global.totalContributed || 0)} cubes remaining until target is reached`);
    }
    if (newTotalContributed >= targetCubes) {
      isTargetReached = true;
    }

    tx.update(saveRef, {
      cubes: newCubes,
      rev: newRev,
      lastUpdated: now,
    });

    tx.set(
      contribRef,
      {
        walletAddress,
        contributed: priorContributed + amount,
        allocation: 0,
        allocationWei: '0',
        merkleProof: null,
        claimed: isSameEvent ? existingContrib!.claimed ?? false : false,
        claimedAt: isSameEvent ? existingContrib!.claimedAt ?? null : null,
        eventId,
      },
      { merge: true }
    );

    tx.update(globalRef, {
      totalContributed: newTotalContributed,
      contributorsCount: isSameEvent
        ? Number(global.contributorsCount || 0)
        : Number(global.contributorsCount || 0) + 1,
    });

    return {
      cubes: newCubes,
      rev: newRev,
      myContribution: {
        walletAddress,
        contributed: priorContributed + amount,
        eventId,
      },
    };
  });

  if (isTargetReached) {
    try {
      await executeReactorClose(db, false);
    } catch (e) {
      console.error('Failed to auto-close reactor after reaching target contribution:', e);
    }
  }

  return result;
}

async function claimAttackNode(
  db: Firestore,
  syncId: string,
  walletAddress: string,
  nodeId: string,
  blobId: string
) {
  const saveRef = db.collection('saves').doc(syncId);
  const nodeRef = db.collection('nodes').doc(nodeId);
  const nodesColl = db.collection('nodes');

  return db.runTransaction(async (tx) => {
    const [saveSnap, nodeSnap] = await Promise.all([tx.get(saveRef), tx.get(nodeRef)]);
    if (!saveSnap.exists) throw new Error('Save not found');
    if (!nodeSnap.exists) throw new Error('Node not found');

    const state = saveSnap.data()!;
    const node = nodeSnap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const blob = (state.blobs || []).find((b: any) => b.id === blobId);
    if (!blob) throw new Error('Attacking blob not found');

    const minLvMap: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 8, 5: 12 };
    const minLv = minLvMap[node.tier] || 1;
    if (blob.level < minLv) {
      throw new Error(`Need Blob Lv.${minLv} for Tier ${node.tier}`);
    }

    const cooldownUntil = Number(node.cooldownUntil || 0);
    if (now < cooldownUntil) {
      const secLeft = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
      throw new Error(`Cooldown active: ${secLeft}s left`);
    }

    const allNodesSnap = await tx.get(nodesColl);
    const allNodes: any[] = [];
    allNodesSnap.forEach((doc) => allNodes.push({ id: doc.id, ...doc.data() }));

    const activeOwnerId = walletAddress.toLowerCase();
    const activeOwnerName = state.playerName || 'Trainer';

    const guardingNode = allNodes.find(
      (n) => n.owner && n.owner.toLowerCase() === activeOwnerId && n.blobId === blobId
    );

    const myNodesList = allNodes.filter(
      (n) => n.owner && n.owner.toLowerCase() === activeOwnerId
    );
    const maxNodes = Math.max(2, (state.blobs || []).length * NODE_CONFIG.maxNodesPerBlob);
    const isAddingNewNode = !guardingNode && node.owner?.toLowerCase() !== activeOwnerId;
    if (isAddingNewNode && myNodesList.length >= maxNodes) {
      throw new Error(`Max nodes reached (${maxNodes}). Summon more Blobs!`);
    }

    // Ferocity усиливает атаку, Guard — защиту. Голый Power остаётся
    // тем, что записывается в ноду: иначе бонус атакующего навсегда
    // оседал бы в защите захваченной ноды.
    const myPower = calcBlobPower(blob);
    const myAttack = calcAttackPower(blob);
    const defPower = node.isNPC
      ? node.npcPower
      : node.owner && node.owner.toLowerCase() !== activeOwnerId
      ? node.blobPower
      : 0;

    const effectiveDefense = defPower * (1 + Number(node.fortifyBonus || 0) / 100) * Number(node.guardMult || 1);

    let win = false;
    if (!node.owner && !node.isNPC) {
      win = true;
    } else if (myAttack >= effectiveDefense) {
      win = true;
    } else if (myAttack >= effectiveDefense * 0.75) {
      win = Math.random() < 0.5;
    } else {
      win = false;
    }

    if (win) {
      const updatedNodeData = {
        owner: activeOwnerId,
        ownerName: activeOwnerName,
        blobId,
        blobPersonality: blob.personality,
        blobPower: myPower,
        // Множитель защиты нового владельца — из его ветки Guard.
        // Берём значение ветки напрямую: делить защиту на Power нельзя,
        // при Power=0 это давало бы деление на ноль.
        guardMult: getUpgradeValue('guard', blob.upgrades?.guard, 1),
        capturedAt: now,
        lastCollected: now,
        fortifyBonus: 0,
        isNPC: false,
        cooldownUntil: now + 5 * 60 * 1000,
      };

      tx.update(nodeRef, updatedNodeData);

      if (guardingNode && guardingNode.id !== node.id) {
        const guardingRef = db.collection('nodes').doc(guardingNode.id);
        tx.update(guardingRef, {
          owner: null,
          ownerName: null,
          blobId: null,
          blobPersonality: null,
          blobPower: 0,
          fortifyBonus: 0,
          capturedAt: null,
        });
      }

      return {
        success: true,
        message: 'Node captured!',
        node: { ...node, id: nodeId, ...updatedNodeData },
      };
    } else {
      tx.update(nodeRef, {
        cooldownUntil: now + 5 * 60 * 1000,
      });

      return {
        success: false,
        message: 'Defeat! Defender was too strong.',
        node: { ...node, id: nodeId, cooldownUntil: now + 5 * 60 * 1000 },
      };
    }
  });
}

async function claimSummon(db: Firestore, syncId: string) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const MAX_BLOBS = 10;
    const currentBlobCount = (state.blobs || []).length;
    if (currentBlobCount >= MAX_BLOBS) {
      throw new Error(`You already have the maximum of ${MAX_BLOBS} Blobs!`);
    }

    const SUMMON_COST = 1500 + currentBlobCount * 500;
    const currentCubes = Number(state.cubes || 0);
    if (currentCubes < SUMMON_COST) {
      throw new Error(`Need ${SUMMON_COST} 💠 Cubes to summon!`);
    }

    const rolledPersonality = PKEYS[Math.floor(Math.random() * PKEYS.length)];
    const nextIdNum = Number(state.nextId || ((state.blobs || []).length + 1));
    const newBlobId = `b${nextIdNum}`;

    const newBlob = {
      id: newBlobId,
      personality: rolledPersonality,
      level: 1,
      xp: 0,
      upgrades: {},
      // Набор веток роллится ТОЛЬКО на сервере и сохраняется вместе с блобом
      branches: rollBlobBranches(),
      mood: { level: 3, lastFed: now, winsToday: 0, lossesToday: 0 },
      trait: null,
      isRadiant: false,
      totalExpeditions: 0,
      totalCubesEarned: 0,
      nodesHeld: [],
    };

    const newCubes = currentCubes - SUMMON_COST;
    const newBlobs = [...(state.blobs || []), newBlob];
    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      blobs: newBlobs,
      nextId: nextIdNum + 1,
      selectedId: newBlobId,
      rev: newRev,
      lastUpdated: now,
    };

    tx.update(saveRef, updatePayload);

    return {
      ...state,
      ...updatePayload,
      newBlob,
      randomPersonality: rolledPersonality,
    };
  });
}

async function claimUnlockSpecies(db: Firestore, syncId: string, personality: PersonalityType) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const UNLOCK_COST = 3000;
    const currentCubes = Number(state.cubes || 0);
    if (currentCubes < UNLOCK_COST) {
      throw new Error(`Need ${UNLOCK_COST} 💠 Cubes to unlock species!`);
    }

    const blobs: any[] = state.blobs || [];
    if (blobs.some((b) => b.personality === personality)) {
      throw new Error('Species already unlocked');
    }

    const nextIdNum = Number(state.nextId || (blobs.length + 1));
    const newBlobId = `b${nextIdNum}`;

    const newBlob = {
      id: newBlobId,
      personality,
      level: 1,
      xp: 0,
      upgrades: {},
      branches: rollBlobBranches(),
      mood: { level: 3, lastFed: now, winsToday: 0, lossesToday: 0 },
      trait: null,
      isRadiant: false,
      totalExpeditions: 0,
      totalCubesEarned: 0,
      nodesHeld: [],
    };

    const newCubes = currentCubes - UNLOCK_COST;
    const newBlobs = [...blobs, newBlob];
    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      blobs: newBlobs,
      nextId: nextIdNum + 1,
      selectedId: newBlobId,
      rev: newRev,
      lastUpdated: now,
    };

    tx.update(saveRef, updatePayload);

    return {
      ...state,
      ...updatePayload,
      newBlob,
    };
  });
}

async function claimUpgradeBlob(
  db: Firestore,
  syncId: string,
  blobId: string,
  branch: UpgradeBranchId
) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const blobs = state.blobs || [];
    const blobIndex = blobs.findIndex((b: any) => b.id === blobId);
    if (blobIndex === -1) throw new Error('Blob not found');

    const blob = { ...blobs[blobIndex] };
    if (!blob.upgrades) {
      blob.upgrades = {};
    }

    // Набор веток берётся ИЗ СОХРАНЕНИЯ, а не из тела запроса.
    // Иначе через devtools можно было бы прокачать любую ветку,
    // включая боевые, которые блобу не выпадали.
    const allowedBranches = getBlobBranches(blob);
    if (!allowedBranches.includes(branch)) {
      throw new Error('This Blob does not have that upgrade branch');
    }

    const currentLv = blob.upgrades[branch] || 0;
    const check = canUpgrade(
      branch,
      currentLv,
      blob.level,
      blob.upgrades,
      state.cubes || 0,
      getEvolutionStage(blob.level),
      allowedBranches
    );

    if (!check.allowed) {
      throw new Error(check.reason || 'Upgrade locked');
    }

    const branchInfo = UPGRADES.find((u) => u.id === branch);
    if (!branchInfo) throw new Error('Invalid upgrade branch');

    const nextLevelCost = branchInfo.levels[currentLv].cost;

    blob.upgrades = {
      ...blob.upgrades,
      [branch]: currentLv + 1,
    };
    // Фиксируем набор веток в сохранении, если блоб был создан до этой
    // системы: дальше он уже не «переедет» на другой набор.
    blob.branches = allowedBranches;

    const newBlobs = [...blobs];
    newBlobs[blobIndex] = blob;

    const newCubes = (state.cubes || 0) - nextLevelCost;
    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      blobs: newBlobs,
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

async function claimBuyEnergy(db: Firestore, syncId: string, amount: number, price: number) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const currentCubes = Number(state.cubes || 0);
    if (currentCubes < price) {
      throw new Error(`Need ${price} 💠 Cubes!`);
    }

    let energy = Number(state.energy ?? 100);
    const energyMax = Number(state.energyMax ?? 100);
    let lastEnergyTime = Number(state.lastEnergyTime || now);

    if (energy < energyMax) {
      const el = now - lastEnergyTime;
      const hasSleepy = (state.blobs || []).some((b: any) => b.personality === 'sleepy');
      const rate = hasSleepy ? EREGEN * 0.7 : EREGEN;
      const gained = Math.floor(el / rate);
      if (gained > 0) {
        energy = Math.min(energyMax, energy + gained);
        lastEnergyTime = now - (el % rate);
      }
    } else {
      lastEnergyTime = now;
    }

    const newCubes = currentCubes - price;
    const newEnergy = Math.min(energyMax, energy + amount);
    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      cubes: newCubes,
      energy: newEnergy,
      lastEnergyTime,
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

async function claimStartExpedition(db: Firestore, syncId: string, zoneId: string, blobIds: string[]) {
  const saveRef = db.collection('saves').doc(syncId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) throw new Error('Save not found');
    const state = snap.data()!;

    const now = Date.now();
    const minIntervalMs = 1000;
    if (state.lastUpdated && now - state.lastUpdated < minIntervalMs) {
      throw new Error('Too many requests, slow down');
    }

    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) {
      throw new Error('Zone not found');
    }

    const blobs = state.blobs || [];
    const selectedBlobs = blobs.filter((b: any) => blobIds.includes(b.id));
    if (selectedBlobs.length === 0) {
      throw new Error('No blob selected');
    }

    const isUnderleveled = selectedBlobs.some((b: any) => b.level < zone.unlockLv);
    if (isUnderleveled) {
      throw new Error(`All selected blobs must be at least Lv.${zone.unlockLv}`);
    }

    const activeExpeditionsList = state.activeExpeditions || [];
    const isAnyBlobBusy = selectedBlobs.some((b: any) => {
      return activeExpeditionsList.some((exp: any) => exp.blobIds?.includes(b.id) || exp.blobId === b.id);
    });
    if (isAnyBlobBusy) {
      throw new Error('One or more selected blobs are already away on an expedition');
    }

    let energy = Number(state.energy ?? 100);
    const energyMax = Number(state.energyMax ?? 100);
    let lastEnergyTime = Number(state.lastEnergyTime || now);

    if (energy < energyMax) {
      const el = now - lastEnergyTime;
      const hasSleepy = blobs.some((b: any) => b.personality === 'sleepy');
      const rate = hasSleepy ? EREGEN * 0.7 : EREGEN;
      const gained = Math.floor(el / rate);
      if (gained > 0) {
        energy = Math.min(energyMax, energy + gained);
        lastEnergyTime = now - (el % rate);
      }
    } else {
      lastEnergyTime = now;
    }

    if (energy < zone.cost) {
      throw new Error(`Not enough ⚡ energy! Need ${zone.cost}`);
    }

    energy -= zone.cost;
    const sendsToday = (state.sendsToday || 0) + 1;

    const statsList = selectedBlobs.map((b: any) => getBlobStats(b.personality, b.level));
    const avgSpeed = statsList.reduce((acc: number, s: any) => acc + s.speed, 0) / statsList.length;
    const speedBonus = Math.min(0.50, avgSpeed * 0.003);
    const baseDuration = Math.round(zone.dur * (1 - speedBonus));

    const maxSpeedLevel = selectedBlobs.reduce((max: number, b: any) => Math.max(max, b.upgrades?.speed || 0), 0);
    const fakeUpgrades = { speed: maxSpeedLevel, harvest: 0, fortune: 0 };
    const { duration } = applyUpgrades(0, baseDuration, 0, fakeUpgrades);

    const useCharm = (state.blobCharms ?? 0) > 0;
    let blobCharms = state.blobCharms ?? 0;
    if (useCharm) {
      blobCharms = Math.max(0, blobCharms - 1);
    }

    const newExp = {
      blobIds: selectedBlobs.map((b: any) => b.id),
      zoneId,
      name: zone.name,
      reward: zone.reward,
      xp: zone.xp,
      duration: duration,
      endTime: now + duration * 1000,
      charmActive: useCharm,
    };

    const updatedActiveExpeditions = [...activeExpeditionsList, newExp];

    const questDone = { ...(state.questDone || {}) };
    if (!questDone.sends && sendsToday >= 3) {
      questDone.sends = true;
    }

    const newRev = (state.rev || 0) + 1;

    const updatePayload = {
      energy,
      lastEnergyTime,
      sendsToday,
      blobCharms,
      activeExpeditions: updatedActiveExpeditions,
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
