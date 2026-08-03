import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, getDocs,
  setDoc, updateDoc, onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NetworkNode, NodeTier, Blob } from '../types';
import { NODE_CONFIG, calcBlobPower, canAttackNode } from '../data';
import { fetchWithSession } from '../lib/wallet';

// ─── Types ─────────────────────────────────────────────────

export interface AttackResult {
  success: boolean;
  message: string;
  cubesLost?: number;  // cubes taken by the winner (currently 0, for future use)
}

/**
 * Результат сбора кубов. Ошибку возвращаем значением, а не только через state:
 * вызывающий код читает её сразу после await, а state в его замыкании
 * на этот момент ещё старый.
 */
export interface CollectResult {
  earned: number;
  error: string | null;
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
  // Последняя ошибка сбора кубов — чтобы UI показал причину, а не молчаливый "+0"
  const [collectError, setCollectError] = useState<string | null>(null);
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

  // Helper to get active owner wallet/sync ID consistently
  const getActiveOwnerId = useCallback(() => {
    return (walletAddress || localStorage.getItem('bb_raw_wallet') || localStorage.getItem('bb_sync_id')?.replace('wallet_', '') || 'trainer_local').toLowerCase();
  }, [walletAddress]);

  // ── Node capture / attack ──────────────────────────────────
  const attackNode = useCallback(async (
    node: NetworkNode,
    blobId: string,
  ): Promise<AttackResult> => {
    const activeOwnerId = getActiveOwnerId();
    const activeSyncId = syncId || `wallet_${activeOwnerId}`;
    const activeWallet = walletAddress || activeOwnerId;

    try {
      const res = await fetchWithSession('/api/claim', {
        type: 'attack_node',
        syncId: activeSyncId,
        walletAddress: activeWallet,
        nodeId: node.id,
        blobId,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || 'Attack failed',
        };
      }

      if (data.node) {
        setNodes(prev => prev.map(n => n.id === data.node.id ? { ...n, ...data.node } : n));
      }

      return {
        success: data.success,
        message: data.message,
      };
    } catch (err: any) {
      console.error('attackNode error:', err);
      return {
        success: false,
        message: err.message || 'Attack failed',
      };
    }
  }, [getActiveOwnerId, syncId, walletAddress]);

  // ── Collect cubes from node ────────────────────────────────────
  const collectFromNode = useCallback(async (node: NetworkNode): Promise<CollectResult> => {
    const activeOwnerId = getActiveOwnerId();
    if (!node.owner || node.owner.toLowerCase() !== activeOwnerId) return { earned: 0, error: null };
    if (!node.lastCollected) return { earned: 0, error: null };

    const activeSyncId = syncId || `wallet_${activeOwnerId}`;
    const activeWallet = walletAddress || activeOwnerId;

    if (activeOwnerId && activeSyncId) {
      setCollectError(null);
      try {
        const res = await fetchWithSession('/api/claim', {
          type: 'node',
          syncId: activeSyncId,
          walletAddress: activeWallet,
          nodeId: node.id,
        });

        const updated = await res.json();
        if (res.ok && updated) {
          if (onServerClaim) {
            onServerClaim(updated);
          }
          setNodes(prev => prev.map(n => n.id === node.id ? { ...n, lastCollected: Date.now() } : n));
          return {
            earned: typeof updated.reward === 'number' ? updated.reward : 0,
            error: null,
          };
        } else {
          // Раньше ошибка тонула в console.warn и игрок видел просто "+0"
          const msg = updated?.error || 'Server rejected the claim';
          console.warn('Server node claim failed:', msg);
          setCollectError(msg);
          return { earned: 0, error: msg };
        }
      } catch (err: any) {
        console.warn('Server node claim fetch error:', err);
        const msg = err?.message || 'Network error while collecting';
        setCollectError(msg);
        return { earned: 0, error: msg };
      }
    }

    return { earned: 0, error: null };
  }, [getActiveOwnerId, syncId, walletAddress, onServerClaim]);

  // ── Collect all (all nodes at once) ─────────────────────────
  // Один серверный запрос на все ноды. Поштучный цикл здесь не работал:
  // каждый claim обновляет lastUpdated, и следующие запросы влетали
  // в анти-спам проверку (1 сек) — собиралась только первая нода.
  const collectAll = useCallback(async (): Promise<CollectResult> => {
    const activeOwnerId = getActiveOwnerId();
    const myNodesList = nodes.filter(n => n.owner && n.owner.toLowerCase() === activeOwnerId);
    if (myNodesList.length === 0) return { earned: 0, error: null };

    const activeSyncId = syncId || `wallet_${activeOwnerId}`;
    const activeWallet = walletAddress || activeOwnerId;

    setCollectError(null);
    try {
      const res = await fetchWithSession('/api/claim', {
        type: 'collect_all_nodes',
        syncId: activeSyncId,
        walletAddress: activeWallet,
      });

      const updated = await res.json();
      if (!res.ok || !updated) {
        const msg = updated?.error || 'Server rejected the claim';
        console.warn('Server collect-all failed:', msg);
        setCollectError(msg);
        return { earned: 0, error: msg };
      }

      if (onServerClaim) {
        onServerClaim(updated);
      }

      // Сбрасываем таймер только у нод, которые сервер реально засчитал,
      // чтобы остальные продолжали показывать накопленное
      const collectedIds: string[] = Array.isArray(updated.collectedNodeIds)
        ? updated.collectedNodeIds
        : [];
      if (collectedIds.length > 0) {
        const collectedAt = Date.now();
        setNodes(prev => prev.map(n =>
          collectedIds.includes(n.id) ? { ...n, lastCollected: collectedAt } : n
        ));
      }

      return {
        earned: typeof updated.reward === 'number' ? updated.reward : 0,
        error: null,
      };
    } catch (err: any) {
      console.warn('Server collect-all fetch error:', err);
      const msg = err?.message || 'Network error while collecting';
      setCollectError(msg);
      return { earned: 0, error: msg };
    }
  }, [nodes, getActiveOwnerId, syncId, walletAddress, onServerClaim]);

  // ── Calculate pending cubes for a single node ────────────────
  const getPendingCubes = useCallback((node: NetworkNode): number => {
    const activeOwnerId = getActiveOwnerId();
    if (!node.lastCollected || !node.owner || node.owner.toLowerCase() !== activeOwnerId) return 0;
    const rate = typeof node.cubesPerHour === 'number' && !isNaN(node.cubesPerHour)
      ? node.cubesPerHour
      : (NODE_CONFIG.cubesPerHour[node.tier] || 10);
    const hours = Math.max(0, (Date.now() - node.lastCollected) / 3600000);
    if (isNaN(hours)) return 0;

    const base = Math.min(
      Math.floor(hours * rate),
      rate * NODE_CONFIG.maxAccumulationHours,
    );
    if (base <= 0) return 0;

    // Бонус за удержание. Повторяет расчёт сервера (api/claim.ts): тот
    // пересчитывает fortifyBonus из capturedAt на момент сбора и умножает
    // на него награду. Без этого UI показывал базу без бонуса, а на баланс
    // приходило больше — отсюда расхождение при «Collect all».
    const holdHours = node.capturedAt
      ? Math.max(0, (Date.now() - node.capturedAt) / 3600000)
      : 0;
    const fortifyBonus = Math.min(
      NODE_CONFIG.maxFortifyBonus,
      Math.floor(holdHours / 24) * NODE_CONFIG.fortifyBonusPerDay,
    );

    return Math.round(base * (1 + fortifyBonus / 100));
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
    collectError,
  };
}
