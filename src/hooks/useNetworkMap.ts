import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, getDocs,
  updateDoc, onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NetworkNode, NodeTier, Blob } from '../types';
import { NODE_CONFIG } from '../data';

// ─── Types ─────────────────────────────────────────────────

export interface AttackResult {
  success: boolean;
  message: string;
  cubesLost?: number;  // cubes taken by the winner (currently 0, for future use)
}

// ─── Initial nodes generation (once on first launch) ─

function buildInitialNodes(): Omit<NetworkNode, 'id'>[] {
  const nodes: Omit<NetworkNode, 'id'>[] = [];

  type NodeDef = { tier: NodeTier; type: NetworkNode['type']; col: number; row: number; name: string };

  const defs: NodeDef[] = [
    // Tier 5 — Base Core (1)
    { tier: 5, type: 'event',     col: 0,  row: 0,  name: 'Base Core' },

    // Tier 4 — Genesis (5)
    { tier: 4, type: 'standard',  col: 2,  row: -1, name: 'Genesis Alpha' },
    { tier: 4, type: 'standard',  col: 1,  row: 1,  name: 'Genesis Beta' },
    { tier: 4, type: 'boost',     col: -1, row: 2,  name: 'Genesis Gamma' },
    { tier: 4, type: 'standard',  col: -2, row: 1,  name: 'Genesis Delta' },
    { tier: 4, type: 'contested', col: 0,  row: -2, name: 'Genesis Epsilon' },

    // Tier 3 — Core (15) — middle ring
    ...[
      [3,-1], [3,-2], [2,-3], [1,-3], [0,-3],
      [-1,-2], [-2,-1], [-3,0], [-3,1], [-2,2],
      [-1,3], [0,3], [1,3], [2,2], [3,0],
    ].map(([col, row], i) => ({
      tier: 3 as NodeTier,
      col, row,
      type: (['standard','boost','contested','dark','standard'] as const)[i % 5],
      name: `Core Node ${i + 1}`,
    })),

    // Tier 2 — Hub (25)
    ...((() => {
      const hubs: NodeDef[] = [];
      for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2;
        const r = 4.5;
        const col = Math.round(Math.cos(angle) * r);
        const row = Math.round(Math.sin(angle) * r);
        const types: NetworkNode['type'][] = ['standard', 'standard', 'standard', 'boost', 'contested'];
        hubs.push({ tier: 2, type: types[i % 5], col, row, name: `Hub Node ${i + 1}` });
      }
      return hubs;
    })()),

    // Tier 1 — Sector (40) — outer ring
    ...((() => {
      const sectors: NodeDef[] = [];
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2;
        const r = 6.5;
        const col = Math.round(Math.cos(angle) * r);
        const row = Math.round(Math.sin(angle) * r);
        sectors.push({
          tier: 1,
          type: i % 5 === 3 ? 'boost' : 'standard',
          col, row,
          name: `Sector ${i + 1}`,
        });
      }
      return sectors;
    })()),
  ];

  defs.forEach((d, i) => {
    // ~30% of nodes are occupied by NPC at start to make the map lively
    const isNPC = i > 0 && i % 3 === 0;
    nodes.push({
      ...d,
      owner: null,
      ownerName: null,
      blobId: null,
      blobPersonality: null,
      blobPower: 0,
      cubesPerHour: NODE_CONFIG.cubesPerHour[d.tier],
      capturedAt: null,
      lastCollected: null,
      fortifyBonus: 0,
      shieldUntil: null,
      isNPC,
      npcPower: isNPC ? 20 + d.tier * 15 + Math.floor(Math.random() * 20) : 0,
      boostType: d.type === 'boost'
        ? (['xp', 'fortune', 'speed'] as const)[i % 3]
        : null,
      isEventNode: d.type === 'event',
    });
  });

  return nodes;
}

// ─── Blob power formula ────────────────────────────────────

export function calcBlobPower(blob: Blob): number {
  const moodMultipliers = [0.8, 0.9, 1.0, 1.15];
  const moodMult = moodMultipliers[blob.mood?.level ?? 2];

  const basePower =
    blob.level * 10 +
    (blob.upgrades.speed   ?? 0) * 8 +
    (blob.upgrades.harvest ?? 0) * 5 +
    (blob.upgrades.fortune ?? 0) * 6;

  // Trait bonus
  let traitMult = 1;
  if (blob.trait === 'ancient') traitMult = 1.05;
  if (blob.trait === 'berserker') traitMult = 1.08;

  return Math.round(basePower * moodMult * traitMult);
}

// ─── IS POWER SUFFICIENT FOR ATTACK ────────────────────────────

export function canAttackNode(
  blobPower: number,
  node: NetworkNode,
): boolean {
  if (!node.owner && !node.isNPC) return true; // empty node
  const defenderPower = node.isNPC ? node.npcPower : node.blobPower;
  const effectiveDefense = defenderPower * (1 + node.fortifyBonus / 100);
  // Need to be stronger by at least 1
  return blobPower > effectiveDefense * 0.8; // 80% — minimum for attempt
}

// ─── MAIN HOOK ─────────────────────────────────────────

interface UseNetworkMapOptions {
  walletAddress: string | null;
  playerName: string;
  blobs: Blob[];
  onCubesEarned: (amount: number) => void;  // callback to add cubes to GameState
}

export function useNetworkMap({
  walletAddress,
  playerName,
  blobs,
  onCubesEarned,
}: UseNetworkMapOptions) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attackCooldowns, setAttackCooldowns] = useState<Record<string, number>>({});
  // nodeId -> timestamp until which attacking is forbidden
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Nodes initialization in Firestore (only on first launch) ──
  const initNodesIfNeeded = useCallback(async () => {
    const col = collection(db, 'nodes');
    const snap = await getDocs(col);
    if (snap.size > 0) return; // already initialized

    console.log('Initializing network nodes in Firestore...');
    const initial = buildInitialNodes();
    const batch = writeBatch(db);

    initial.forEach((node, i) => {
      const id = `node_${String(i).padStart(3, '0')}`;
      batch.set(doc(db, 'nodes', id), { ...node, id });
    });

    await batch.commit();
    console.log(`Created ${initial.length} nodes in Firestore.`);
  }, []);

  // ── Subscribe to real-time node updates ──
  const subscribeToNodes = useCallback(() => {
    if (unsubRef.current) unsubRef.current();

    const col = collection(db, 'nodes');
    const unsub = onSnapshot(col, (snap) => {
      const updated: NetworkNode[] = snap.docs.map(d => ({
        ...(d.data() as NetworkNode),
        id: d.id,
      }));
      setNodes(updated.sort((a, b) => a.id.localeCompare(b.id)));
      setIsLoading(false);
    }, (err) => {
      console.warn('NetworkMap snapshot error:', err);
      setIsLoading(false);
    });

    unsubRef.current = unsub;
    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await initNodesIfNeeded();
        if (mounted) subscribeToNodes();
      } catch (e) {
        console.warn('NetworkMap init failed (offline?):', e);
        setIsLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
      unsubRef.current?.();
    };
  }, [initNodesIfNeeded, subscribeToNodes]);

  // ── Node capture / attack ──────────────────────────────────
  const attackNode = useCallback(async (
    node: NetworkNode,
    blobId: string,
  ): Promise<AttackResult> => {
    if (!walletAddress) return { success: false, message: 'Connect wallet first' };

    // Find blob
    const blob = blobs.find(b => b.id === blobId);
    if (!blob) return { success: false, message: 'Blob not found' };

    // Check that blob is not already guarding another node
    const guardingNode = nodes.find(n => n.owner === walletAddress && n.blobId === blobId);
    if (guardingNode) {
      return { success: false, message: `This Blob is already guarding ${guardingNode.name}!` };
    }

    // Check level required for tier
    const minLv = NODE_CONFIG.minBlobLevel[node.tier];
    if (blob.level < minLv) {
      return { success: false, message: `Need Blob Lv.${minLv} for Tier ${node.tier}` };
    }

    // Check attack cooldown
    const cooldownUntil = attackCooldowns[node.id] ?? 0;
    if (Date.now() < cooldownUntil) {
      const minLeft = Math.ceil((cooldownUntil - Date.now()) / 60000);
      return { success: false, message: `Cooldown: ${minLeft}m left` };
    }

    // Check max nodes per wallet
    const myNodes = nodes.filter(n => n.owner === walletAddress);
    const maxNodes = blobs.length * NODE_CONFIG.maxNodesPerBlob;
    if (!node.owner && myNodes.length >= maxNodes) {
      return { success: false, message: `Max nodes reached (${maxNodes}). Summon more Blobs!` };
    }

    // Check shield
    if (node.shieldUntil && Date.now() < node.shieldUntil) {
      return { success: false, message: 'Node is shielded' };
    }

    const myPower = calcBlobPower(blob);
    const defPower = node.isNPC
      ? node.npcPower
      : (node.owner && node.owner !== walletAddress ? node.blobPower : 0);

    const effectiveDefense = defPower * (1 + (node.fortifyBonus ?? 0) / 100);

    // Attack result
    let win: boolean;
    if (!node.owner && !node.isNPC) {
      win = true; // empty node — always win
    } else if (myPower >= effectiveDefense * 1.2) {
      win = true;  // stronger by 20%+ — guaranteed win
    } else if (myPower < effectiveDefense * 0.8) {
      win = false; // weaker by 20%+ — guaranteed defeat
    } else {
      // Within 80-120% range — 60/40 random favoring attacker
      win = Math.random() < 0.6;
    }

    const nodeRef = doc(db, 'nodes', node.id);
    const now = Date.now();

    if (win) {
      // Capture node
      await updateDoc(nodeRef, {
        owner: walletAddress,
        ownerName: playerName,
        blobId,
        blobPersonality: blob.personality,
        blobPower: myPower,
        capturedAt: now,
        lastCollected: now,
        fortifyBonus: 0,
        isNPC: false,
      });

      // Cooldown 30 min after capture (cannot abandon immediately)
      setAttackCooldowns(prev => ({
        ...prev,
        [node.id]: now + 30 * 60 * 1000,
      }));

      return {
        success: true,
        message: node.owner
          ? `Captured from ${node.ownerName || 'enemy'}!`
          : 'Node captured!',
      };
    } else {
      // Defeat — 6 hours cooldown
      setAttackCooldowns(prev => ({
        ...prev,
        [node.id]: now + NODE_CONFIG.defeatCooldownHours * 60 * 60 * 1000,
      }));

      return { success: false, message: 'Attack failed! Cooldown: 6h' };
    }
  }, [walletAddress, blobs, nodes, attackCooldowns, playerName]);

  // ── Collect cubes from node ────────────────────────────────────
  const collectFromNode = useCallback(async (node: NetworkNode): Promise<number> => {
    if (!walletAddress || node.owner !== walletAddress) return 0;
    if (!node.lastCollected) return 0;

    const hoursElapsed = (Date.now() - node.lastCollected) / 3600000;
    const pending = Math.min(
      Math.floor(hoursElapsed * node.cubesPerHour),
      node.cubesPerHour * NODE_CONFIG.maxAccumulationHours,
    );

    if (pending <= 0) return 0;

    // Fortify bonus — +10% for every 24h of holding
    const holdHours = node.capturedAt
      ? (Date.now() - node.capturedAt) / 3600000
      : 0;
    const newFortifyBonus = Math.min(
      NODE_CONFIG.maxFortifyBonus,
      Math.floor(holdHours / 24) * NODE_CONFIG.fortifyBonusPerDay,
    );

    // Add cubes to GameState immediately via callback
    onCubesEarned(pending);

    // Update Firestore asynchronously in background without await to avoid lag
    const nodeRef = doc(db, 'nodes', node.id);
    updateDoc(nodeRef, {
      lastCollected: Date.now(),
      fortifyBonus: newFortifyBonus,
    }).catch(err => {
      console.warn(`Failed to update node ${node.id} in Firestore:`, err);
    });

    return pending;
  }, [walletAddress, onCubesEarned]);

  // ── Collect all (all nodes at once) ─────────────────────────
  const collectAll = useCallback(async (): Promise<number> => {
    const myNodes = nodes.filter(n => n.owner === walletAddress);
    if (myNodes.length === 0) return 0;

    let total = 0;
    for (const node of myNodes) {
      total += await collectFromNode(node);
    }
    return total;
  }, [nodes, walletAddress, collectFromNode]);

  // ── Calculate pending cubes for a single node ────────────────
  const getPendingCubes = useCallback((node: NetworkNode): number => {
    if (!node.lastCollected || node.owner !== walletAddress) return 0;
    const hours = (Date.now() - node.lastCollected) / 3600000;
    return Math.min(
      Math.floor(hours * node.cubesPerHour),
      node.cubesPerHour * NODE_CONFIG.maxAccumulationHours,
    );
  }, [walletAddress]);

  // ── Total pending across all nodes ──────────────────────
  const totalPending = nodes
    .filter(n => n.owner === walletAddress)
    .reduce((sum, n) => sum + getPendingCubes(n), 0);

  const myNodes = nodes.filter(n => n.owner === walletAddress);
  const totalIncome = myNodes.reduce((sum, n) => sum + n.cubesPerHour, 0);

  return {
    nodes,
    isLoading,
    myNodes,
    totalIncome,
    totalPending,
    attackNode,
    collectFromNode,
    collectAll,
    getPendingCubes,
    calcBlobPower,
    canAttackNode,
    attackCooldowns,
  };
}
