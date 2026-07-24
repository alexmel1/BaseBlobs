import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, getDocs,
  setDoc, updateDoc, onSnapshot,
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
      npcPower: isNPC
        ? d.tier === 1
          ? 4 + Math.floor(Math.random() * 4) // 4-7 power for Tier 1 so starter Blob (power 10+) wins!
          : d.tier === 2
          ? 12 + Math.floor(Math.random() * 5)
          : d.tier === 3
          ? 25 + Math.floor(Math.random() * 10)
          : d.tier === 4
          ? 50 + Math.floor(Math.random() * 15)
          : 90 + Math.floor(Math.random() * 20)
        : 0,
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
  syncId?: string | null;
  walletAddress: string | null;
  playerName: string;
  blobs: Blob[];
  onCubesEarned: (amount: number) => void;  // callback to add cubes to GameState
  onServerClaim?: (updatedState: any) => void;
}

export function useNetworkMap({
  syncId,
  walletAddress,
  playerName,
  blobs,
  onCubesEarned,
  onServerClaim,
}: UseNetworkMapOptions) {
  // Fallback initial nodes generator
  const getFallbackNodes = useCallback((): NetworkNode[] => {
    return buildInitialNodes().map((node, i) => ({
      ...node,
      id: `node_${String(i).padStart(3, '0')}`,
    }));
  }, []);

  const [nodes, setNodes] = useState<NetworkNode[]>(getFallbackNodes);
  const [isLoading, setIsLoading] = useState(false);
  const [attackCooldowns, setAttackCooldowns] = useState<Record<string, number>>({});
  // nodeId -> timestamp until which attacking is forbidden
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Nodes initialization in Firestore (only on first launch or missing nodes) ──
  const initNodesIfNeeded = useCallback(async () => {
    try {
      const col = collection(db, 'nodes');
      const snap = await getDocs(col);
      const initial = buildInitialNodes();
      if (snap.size >= initial.length) return; // already fully initialized

      console.log('Initializing/repairing network nodes in Firestore...');
      const existingIds = new Set(snap.docs.map(d => d.id));
      
      const missingNodes = initial
        .map((node, i) => ({ ...node, id: `node_${String(i).padStart(3, '0')}` }))
        .filter(node => !existingIds.has(node.id));

      const CHUNK_SIZE = 25;
      for (let i = 0; i < missingNodes.length; i += CHUNK_SIZE) {
        const chunk = missingNodes.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((node) => {
          batch.set(doc(db, 'nodes', node.id), node);
        });
        await batch.commit();
      }
      console.log(`Initialized ${missingNodes.length} missing nodes in Firestore.`);
    } catch (err) {
      console.warn('initNodesIfNeeded error:', err);
    }
  }, []);

  // ── Subscribe to real-time node updates ──
  const subscribeToNodes = useCallback(() => {
    if (unsubRef.current) unsubRef.current();

    const col = collection(db, 'nodes');

    const unsub = onSnapshot(col, (snap) => {
      // Always maintain the complete set of fallback nodes so map never vanishes
      const fallbackNodes = getFallbackNodes();
      const nodeMap = new Map<string, NetworkNode>(
        fallbackNodes.map(n => [n.id, n])
      );

      if (snap.docs.length > 0) {
        snap.docs.forEach(d => {
          const raw = d.data() as Partial<NetworkNode>;
          const fallback = nodeMap.get(d.id);
          if (!fallback) return;

          const tier = (raw.tier || fallback.tier || 1) as NodeTier;
          const cubesPerHour = typeof raw.cubesPerHour === 'number' && !isNaN(raw.cubesPerHour)
            ? raw.cubesPerHour
            : (NODE_CONFIG.cubesPerHour[tier] || 10);

          nodeMap.set(d.id, {
            ...fallback,
            ...raw,
            id: d.id,
            tier,
            col: typeof raw.col === 'number' && !isNaN(raw.col) ? raw.col : fallback.col,
            row: typeof raw.row === 'number' && !isNaN(raw.row) ? raw.row : fallback.row,
            cubesPerHour,
            owner: raw.owner ?? null,
            ownerName: raw.ownerName ?? null,
            blobId: raw.blobId ?? null,
            blobPersonality: raw.blobPersonality ?? null,
            blobPower: typeof raw.blobPower === 'number' && !isNaN(raw.blobPower) ? raw.blobPower : 0,
            capturedAt: typeof raw.capturedAt === 'number' && !isNaN(raw.capturedAt) ? raw.capturedAt : null,
            lastCollected: typeof raw.lastCollected === 'number' && !isNaN(raw.lastCollected) ? raw.lastCollected : null,
            fortifyBonus: typeof raw.fortifyBonus === 'number' && !isNaN(raw.fortifyBonus) ? raw.fortifyBonus : 0,
          });
        });
      }

      const totalInitial = buildInitialNodes().length;
      if (snap.docs.length < totalInitial) {
        initNodesIfNeeded();
      }

      const merged = Array.from(nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id));
      setNodes(merged);
      setIsLoading(false);
    }, (err) => {
      console.warn('NetworkMap snapshot error:', err);
      setIsLoading(false);
    });

    unsubRef.current = unsub;
    return unsub;
  }, [getFallbackNodes, initNodesIfNeeded]);

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
    const activeWallet = walletAddress || localStorage.getItem('bb_raw_wallet') || localStorage.getItem('bb_sync_id')?.replace('wallet_', '') || 'trainer_local';
    const activeOwnerId = activeWallet.toLowerCase();
    const activeOwnerName = playerName || 'Trainer';

    // Find blob
    const blob = blobs.find(b => b.id === blobId);
    if (!blob) return { success: false, message: 'Blob not found' };

    // Check level required for tier
    const minLv = NODE_CONFIG.minBlobLevel[node.tier] ?? 1;
    if (blob.level < minLv) {
      return { success: false, message: `Need Blob Lv.${minLv} for Tier ${node.tier}` };
    }

    // Check attack cooldown
    const cooldownUntil = attackCooldowns[node.id] ?? 0;
    if (Date.now() < cooldownUntil) {
      const secLeft = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
      return { success: false, message: `Cooldown active: ${secLeft}s left` };
    }

    // Check existing guarding node for this blob
    const guardingNode = nodes.find(n => n.owner && n.owner.toLowerCase() === activeOwnerId && n.blobId === blobId);

    // Check max nodes per wallet (if blob isn't already guarding a node, this adds a new node)
    const myNodesList = nodes.filter(n => n.owner && n.owner.toLowerCase() === activeOwnerId);
    const maxNodes = Math.max(2, blobs.length * NODE_CONFIG.maxNodesPerBlob);
    const isAddingNewNode = !guardingNode && node.owner?.toLowerCase() !== activeOwnerId;
    if (isAddingNewNode && myNodesList.length >= maxNodes) {
      return { success: false, message: `Max nodes reached (${maxNodes}). Summon more Blobs!` };
    }

    // Check shield
    if (node.shieldUntil && Date.now() < node.shieldUntil) {
      return { success: false, message: 'Node is currently shielded' };
    }

    const myPower = calcBlobPower(blob);
    const defPower = node.isNPC
      ? node.npcPower
      : (node.owner && node.owner.toLowerCase() !== activeOwnerId ? node.blobPower : 0);

    const effectiveDefense = defPower * (1 + (node.fortifyBonus ?? 0) / 100);

    // Attack result calculation
    let win: boolean;
    if (!node.owner && !node.isNPC) {
      win = true; // empty node — always win
    } else if (myPower >= effectiveDefense) {
      win = true;  // equal or higher power — guaranteed win
    } else if (myPower >= effectiveDefense * 0.75) {
      win = Math.random() < 0.5; // close match — 50% chance
    } else {
      win = false; // too weak — defeat
    }

    const now = Date.now();

    if (win) {
      const updatedData = {
        owner: activeOwnerId,
        ownerName: activeOwnerName,
        blobId,
        blobPersonality: blob.personality,
        blobPower: myPower,
        capturedAt: now,
        lastCollected: now,
        fortifyBonus: 0,
        isNPC: false,
      };

      // Optimistically update local nodes state immediately so UI feedback is instant
      setNodes(prev => prev.map(n => {
        if (n.id === node.id) return { ...n, ...updatedData };
        if (guardingNode && n.id === guardingNode.id && n.id !== node.id) {
          return { ...n, owner: null, ownerName: null, blobId: null, blobPersonality: null, blobPower: 0, fortifyBonus: 0, capturedAt: null };
        }
        return n;
      }));

      // Cooldown 10s after capture
      setAttackCooldowns(prev => ({
        ...prev,
        [node.id]: now + 10 * 1000,
      }));

      // Persist to Firestore asynchronously
      try {
        const nodeRef = doc(db, 'nodes', node.id);
        setDoc(nodeRef, updatedData, { merge: true }).catch(err => {
          console.warn('Firestore setDoc failed:', err);
        });

        if (guardingNode && guardingNode.id !== node.id) {
          const oldNodeRef = doc(db, 'nodes', guardingNode.id);
          setDoc(oldNodeRef, {
            owner: null,
            ownerName: null,
            blobId: null,
            blobPersonality: null,
            blobPower: 0,
            fortifyBonus: 0,
            capturedAt: null,
          }, { merge: true }).catch(err => {
            console.warn('Firestore setDoc old node failed:', err);
          });
        }
      } catch (err) {
        console.warn('Firestore trigger failed:', err);
      }

      return {
        success: true,
        message: node.owner
          ? `Captured from ${node.ownerName || 'enemy'}!`
          : guardingNode && guardingNode.id !== node.id
          ? `Node captured! Reassigned Blob from ${guardingNode.name}.`
          : 'Node captured successfully!',
      };
    } else {
      // Defeat — short 10s cooldown
      setAttackCooldowns(prev => ({
        ...prev,
        [node.id]: now + 10 * 1000,
      }));

      return {
        success: false,
        message: `Attack failed! Your Power: ${myPower} vs Def: ${Math.round(effectiveDefense)}. Level up your Blob!`,
      };
    }
  }, [walletAddress, blobs, nodes, attackCooldowns, playerName]);

  // Helper to get active owner wallet/sync ID consistently
  const getActiveOwnerId = useCallback(() => {
    return (walletAddress || localStorage.getItem('bb_raw_wallet') || localStorage.getItem('bb_sync_id')?.replace('wallet_', '') || 'trainer_local').toLowerCase();
  }, [walletAddress]);

  // ── Collect cubes from node ────────────────────────────────────
  const collectFromNode = useCallback(async (node: NetworkNode): Promise<number> => {
    const activeOwnerId = getActiveOwnerId();
    if (!node.owner || node.owner.toLowerCase() !== activeOwnerId) return 0;
    if (!node.lastCollected) return 0;

    const activeSyncId = syncId || `wallet_${activeOwnerId}`;

    // Server-side claim via Vercel / Express API function
    if (activeOwnerId && activeSyncId) {
      try {
        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'node',
            syncId: activeSyncId,
            walletAddress: walletAddress || activeOwnerId,
            nodeId: node.id,
          }),
        });

        const updated = await res.json();
        if (res.ok && updated) {
          if (onServerClaim) {
            onServerClaim(updated);
          }
          setNodes(prev => prev.map(n => n.id === node.id ? { ...n, lastCollected: Date.now() } : n));
          return typeof updated.reward === 'number' ? updated.reward : 0;
        } else {
          console.warn('Server node claim failed:', updated?.error);
        }
      } catch (err) {
        console.warn('Server node claim fetch error:', err);
      }
    }

    return 0;
  }, [getActiveOwnerId, syncId, walletAddress, onServerClaim]);

  // ── Collect all (all nodes at once) ─────────────────────────
  const collectAll = useCallback(async (): Promise<number> => {
    const activeOwnerId = getActiveOwnerId();
    const myNodesList = nodes.filter(n => n.owner && n.owner.toLowerCase() === activeOwnerId);
    if (myNodesList.length === 0) return 0;

    let total = 0;
    for (const node of myNodesList) {
      total += await collectFromNode(node);
    }
    return total;
  }, [nodes, getActiveOwnerId, collectFromNode]);

  // ── Calculate pending cubes for a single node ────────────────
  const getPendingCubes = useCallback((node: NetworkNode): number => {
    const activeOwnerId = getActiveOwnerId();
    if (!node.lastCollected || !node.owner || node.owner.toLowerCase() !== activeOwnerId) return 0;
    const rate = typeof node.cubesPerHour === 'number' && !isNaN(node.cubesPerHour)
      ? node.cubesPerHour
      : (NODE_CONFIG.cubesPerHour[node.tier] || 10);
    const hours = Math.max(0, (Date.now() - node.lastCollected) / 3600000);
    if (isNaN(hours)) return 0;
    return Math.min(
      Math.floor(hours * rate),
      rate * NODE_CONFIG.maxAccumulationHours,
    );
  }, [getActiveOwnerId]);

  // ── Total pending across all nodes ──────────────────────
  const activeOwnerId = getActiveOwnerId();
  const myNodes = nodes.filter(n => n.owner && n.owner.toLowerCase() === activeOwnerId);
  const totalPending = myNodes.reduce((sum, n) => {
    const p = getPendingCubes(n);
    return sum + (isNaN(p) ? 0 : p);
  }, 0);
  const totalIncome = myNodes.reduce((sum, n) => {
    const rate = typeof n.cubesPerHour === 'number' && !isNaN(n.cubesPerHour)
      ? n.cubesPerHour
      : (NODE_CONFIG.cubesPerHour[n.tier] || 10);
    return sum + rate;
  }, 0);

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
