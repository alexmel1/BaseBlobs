import React, { useState, useRef } from 'react';
import { NetworkNode, NodeTier } from '../types';
import { NODE_CONFIG } from '../data';
import { calcBlobPower } from '../hooks/useNetworkMap';

// ─── MOCK NODES for display without Firebase ──────────────
// In Task 3, this data will be replaced by real data from Firebase
function generateMockNodes(): NetworkNode[] {
  const nodes: NetworkNode[] = [];

  // Map structure: concentric rings around the center
  // Center = Base Core (tier 5), ring 1 = Genesis (tier 4), etc.

  const layout: { tier: NodeTier; type: NetworkNode['type']; col: number; row: number; name: string }[] = [
    // Centre — Base Core (1 node)
    { tier: 5, type: 'event', col: 0, row: 0, name: 'Base Core' },

    // Ring 1 — Genesis (5 nodes)
    { tier: 4, type: 'standard', col: 1, row: 0, name: 'Genesis Alpha' },
    { tier: 4, type: 'standard', col: 0, row: 1, name: 'Genesis Beta' },
    { tier: 4, type: 'boost',    col: -1, row: 1, name: 'Genesis Gamma' },
    { tier: 4, type: 'standard', col: -1, row: 0, name: 'Genesis Delta' },
    { tier: 4, type: 'contested',col: 0, row: -1, name: 'Genesis Epsilon' },

    // Ring 2 — Core (15 nodes)
    { tier: 3, type: 'standard', col: 2, row: 0, name: 'Core Node 1' },
    { tier: 3, type: 'boost',    col: 2, row: -1, name: 'Core Node 2' },
    { tier: 3, type: 'standard', col: 1, row: -1, name: 'Core Node 3' },
    { tier: 3, type: 'dark',     col: 0, row: -2, name: 'Core Node 4' },
    { tier: 3, type: 'standard', col: -1, row: -1, name: 'Core Node 5' },
    { tier: 3, type: 'standard', col: -2, row: 0, name: 'Core Node 6' },
    { tier: 3, type: 'contested',col: -2, row: 1, name: 'Core Node 7' },
    { tier: 3, type: 'standard', col: -1, row: 2, name: 'Core Node 8' },
    { tier: 3, type: 'boost',    col: 0, row: 2, name: 'Core Node 9' },
    { tier: 3, type: 'standard', col: 1, row: 1, name: 'Core Node 10' },
    { tier: 3, type: 'standard', col: 2, row: 1, name: 'Core Node 11' },
    { tier: 3, type: 'dark',     col: 1, row: -2, name: 'Core Node 12' },
    { tier: 3, type: 'standard', col: -1, row: -2, name: 'Core Node 13' },
    { tier: 3, type: 'standard', col: -2, row: -1, name: 'Core Node 14' },
    { tier: 3, type: 'standard', col: -2, row: 2, name: 'Core Node 15' },

    // Ring 3 — Hub (25 nodes)
    ...Array.from({ length: 25 }, (_, i) => {
      const angle = (i / 25) * Math.PI * 2;
      const r = 3.5;
      const col = Math.round(Math.cos(angle) * r);
      const row = Math.round(Math.sin(angle) * r);
      const types: NetworkNode['type'][] = ['standard', 'standard', 'standard', 'boost', 'contested'];
      return {
        tier: 2 as NodeTier,
        type: types[i % types.length] as NetworkNode['type'],
        col, row,
        name: `Hub ${i + 1}`,
      };
    }),

    // Ring 4 — Sector (40 nodes, outer ring)
    ...Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2;
      const r = 5.5;
      const col = Math.round(Math.cos(angle) * r);
      const row = Math.round(Math.sin(angle) * r);
      const types: NetworkNode['type'][] = ['standard', 'standard', 'standard', 'standard', 'boost'];
      return {
        tier: 1 as NodeTier,
        type: types[i % types.length] as NetworkNode['type'],
        col, row,
        name: `Sector ${i + 1}`,
      };
    }),
  ];

  // Convert to NetworkNode with mock data
  layout.forEach((n, i) => {
    const isOwned = i % 5 === 1; // every 5th node is "owned" for demo
    const isNPC = i % 5 === 3;   // every other 5th is NPC

    nodes.push({
      id: `node_${String(i).padStart(3, '0')}`,
      tier: n.tier,
      type: n.type,
      name: n.name,
      col: n.col,
      row: n.row,
      owner: isOwned ? '0xMOCK' : null,
      ownerName: isOwned ? 'You' : null,
      blobId: isOwned ? 'b1' : null,
      blobPersonality: isOwned ? 'happy' : null,
      blobPower: isOwned ? 120 : 0,
      cubesPerHour: NODE_CONFIG.cubesPerHour[n.tier],
      capturedAt: isOwned ? Date.now() - 3600000 : null,
      lastCollected: isOwned ? Date.now() - 1800000 : null,
      fortifyBonus: isOwned ? 10 : 0,
      shieldUntil: null,
      isNPC,
      npcPower: isNPC ? 30 + n.tier * 20 : 0,
      boostType: n.type === 'boost' ? (['xp', 'fortune', 'speed'] as const)[i % 3] : null,
      isEventNode: n.type === 'event',
    });
  });

  return nodes;
}

// ─── COLORS AND ICONS ───────────────────────────────────────

const TIER_COLORS: Record<NodeTier, string> = {
  1: '#0088ff',
  2: '#6600ff',
  3: '#9900cc',
  4: '#cc3300',
  5: '#ccaa00',
};

const TIER_ICONS: Record<NodeTier, string> = {
  1: '🌱',
  2: '🔮',
  3: '🌌',
  4: '⛓️',
  5: '👑',
};

const PERSONALITY_GLOWS: Record<string, string> = {
  happy:   '#00aaff',
  sleepy:  '#aa44ff',
  lucky:   '#00ff88',
  chaotic: '#ff44aa',
  cosmic:  '#8844ff',
};

// ─── HEX MATH ─────────────────────────────────────────────
// Pointy-top hex grid, axial coordinates

const HEX_SIZE = 26; // hex radius in pixels

function hexToPixel(col: number, row: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * col + (Math.sqrt(3) / 2) * row);
  const y = HEX_SIZE * ((3 / 2) * row);
  return { x, y };
}

function hexPoints(cx: number, cy: number, size: number): string {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

// ─── NODE DETAIL PANEL ────────────────────────────────────

interface NodePanelProps {
  node: NetworkNode;
  onClose: () => void;
  onAttack: (node: NetworkNode) => void;
  onCollect: (node: NetworkNode) => void;
  pendingCubes: number;
  walletAddress?: string | null;
  onBuyShield?: (nodeId: string, hours: number, cost: number) => void;
}

function NodePanel({ node, onClose, onAttack, onCollect, pendingCubes, walletAddress, onBuyShield }: NodePanelProps) {
  const color = TIER_COLORS[node.tier];
  const icon = TIER_ICONS[node.tier];
  const isOwned = walletAddress ? node.owner === walletAddress : false;

  const typeLabels: Record<NetworkNode['type'], string> = {
    standard:  'Standard',
    boost:     `Boost (${node.boostType ?? ''})`,
    contested: '⚔️ Contested',
    dark:      '🌙 Dark Node',
    event:     '🎯 Event Node',
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 bg-[#08102a]/98 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4 shadow-2xl">
      {/* Handle */}
      <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="text-white font-bold text-sm">{node.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                style={{ color, borderColor: color + '66', backgroundColor: color + '18' }}
              >
                Tier {node.tier}
              </span>
              <span className="text-[10px] text-slate-400">{typeLabels[node.type]}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/5 rounded-xl p-2.5">
          <div className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">Income</div>
          <div className="text-white font-bold text-sm">💠 {node.cubesPerHour}/hr</div>
        </div>
        <div className="bg-white/5 rounded-xl p-2.5">
          <div className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">Status</div>
          <div className="font-bold text-sm">
            {isOwned ? (
              <span className="text-emerald-400">✓ Owned</span>
            ) : node.isNPC ? (
              <span className="text-slate-400">🤖 NPC (pw: {node.npcPower})</span>
            ) : node.owner ? (
              <span className="text-amber-400">⚔️ Occupied</span>
            ) : (
              <span className="text-blue-400">○ Empty</span>
            )}
          </div>
        </div>
      </div>

      {/* Pending cubes for owned node */}
      {isOwned && pendingCubes > 0 && (
        <div
          className="flex items-center justify-between p-2.5 rounded-xl mb-3 border"
          style={{ borderColor: color + '44', backgroundColor: color + '12' }}
        >
          <span className="text-white text-xs">Pending cubes</span>
          <span className="font-bold text-sm" style={{ color }}>💠 +{pendingCubes}</span>
        </div>
      )}

      {/* Fortify bonus */}
      {isOwned && node.fortifyBonus > 0 && (
        <div className="text-[10px] text-slate-400 mb-3">
          🏰 Fortify bonus: +{node.fortifyBonus}% defense
        </div>
      )}

      {/* Boost info */}
      {node.type === 'boost' && node.boostType && (
        <div className="text-[10px] text-amber-300 mb-3">
          ⚡ Boost: +{node.boostType === 'xp' ? '5% XP' : node.boostType === 'fortune' ? '10% Fortune' : '15% Speed'} while held
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isOwned && pendingCubes > 0 && (
          <button
            onClick={() => onCollect(node)}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
            style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
          >
            Collect 💠 {pendingCubes}
          </button>
        )}
        {!isOwned && (
          <button
            onClick={() => onAttack(node)}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border transition-all active:scale-95 hover:bg-white/5"
            style={{ borderColor: color + '66', color }}
          >
            {node.owner || node.isNPC ? '⚔️ Attack' : '🚩 Capture'}
          </button>
        )}
        {isOwned && !pendingCubes && (
          <div className="flex-1 py-2.5 text-center text-slate-500 text-xs">
            Nothing to collect yet
          </div>
        )}
      </div>

      {/* Buy Shield section */}
      {isOwned && onBuyShield && (
        <div className="mt-3 pt-3 border-t border-white/8">
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">
            🛡️ Buy Shield
          </p>
          {node.shieldUntil && Date.now() < node.shieldUntil ? (
            <div className="text-emerald-400 text-xs text-center py-1">
              Shield active: {Math.ceil((node.shieldUntil - Date.now()) / 3600000)}h remaining
            </div>
          ) : (
            <div className="flex gap-2">
              {[
                { hours: 2, cost: 200, label: '2h' },
                { hours: 8, cost: 600, label: '8h' },
                { hours: 16, cost: 1000, label: 'Night' },
              ].map(shield => (
                <button
                  key={shield.hours}
                  onClick={() => onBuyShield(node.id, shield.hours, shield.cost)}
                  className="flex-1 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="text-white text-xs font-semibold">{shield.label}</div>
                  <div className="text-slate-400 text-[10px]">{shield.cost} 💠</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────

interface BlobSelectorSheetProps {
  node: NetworkNode;
  blobs: import('../types').Blob[];
  nodes: NetworkNode[];
  walletAddress?: string | null;
  selectedBlobId: string | null;
  onSelect: (blobId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  calcPower: (blob: import('../types').Blob) => number;
  attackCooldowns: Record<string, number>;
}

function BlobSelectorSheet({
  node, blobs, nodes, walletAddress, selectedBlobId, onSelect, onConfirm, onCancel, calcPower, attackCooldowns,
}: BlobSelectorSheetProps) {
  const tierColor = { 1:'#0088ff',2:'#6600ff',3:'#9900cc',4:'#cc3300',5:'#ccaa00' }[node.tier] ?? '#0088ff';
  const minLv = NODE_CONFIG.minBlobLevel[node.tier];
  const cooldownUntil = attackCooldowns[node.id] ?? 0;
  const isCooling = Date.now() < cooldownUntil;

  const moodEmoji = ['😢','😴','😐','😊'];
  const moodColor = ['#ef4444','#f59e0b','#94a3b8','#22c55e'];

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 bg-[#08102a]/98 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4 shadow-2xl">
      <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

      <h3 className="text-white font-bold text-sm mb-1">Select Blob to Attack</h3>
      <p className="text-slate-400 text-xs mb-3">
        Target: <span className="font-semibold" style={{ color: tierColor }}>{node.name}</span>
        {' · '}Requires Lv.{minLv}+
        {node.owner && node.owner !== '0xMOCK' && (
          <span className="text-amber-400"> · Defender: {node.blobPower} power</span>
        )}
      </p>

      {isCooling && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-2.5 mb-3 text-red-400 text-xs text-center">
          ⏳ Cooldown active — {Math.ceil((cooldownUntil - Date.now()) / 60000)}m left
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
        {blobs.map(blob => {
          const power = calcPower(blob);
          const guardingNode = walletAddress ? nodes.find(n => n.owner === walletAddress && n.blobId === blob.id) : null;
          const eligible = blob.level >= minLv && !guardingNode;
          const mood = blob.mood?.level ?? 2;
          const isSelected = blob.id === selectedBlobId;

          return (
            <button
              key={blob.id}
              disabled={!eligible}
              onClick={() => eligible && onSelect(blob.id)}
              className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-blue-400/60 bg-blue-600/20'
                  : eligible
                  ? 'border-white/10 bg-white/5 hover:bg-white/10'
                  : 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                {/* blob emoji placeholder */}
                🟦
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs font-semibold truncate">
                    {blob.personality.charAt(0).toUpperCase() + blob.personality.slice(1)}
                  </span>
                  <span className="text-slate-400 text-[10px]">Lv.{blob.level}</span>
                  <span style={{ color: moodColor[mood] }} className="text-[10px]">
                    {moodEmoji[mood]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Power: <span className="text-white font-semibold">{power}</span>
                  {!eligible && (
                    <span className="text-red-400 ml-1">
                      · {guardingNode ? `Guarding ${guardingNode.name}` : `Need Lv.${minLv}`}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <span className="text-blue-400 text-sm">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          disabled={!selectedBlobId || isCooling}
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: selectedBlobId && !isCooling ? `linear-gradient(90deg, ${tierColor}cc, ${tierColor})` : undefined, backgroundColor: (!selectedBlobId || isCooling) ? '#1e293b' : undefined }}
        >
          {node.owner && node.owner !== '0xMOCK' ? '⚔️ Attack' : '🚩 Capture'}
        </button>
      </div>
    </div>
  );
}

interface NetworkMapProps {
  walletAddress?: string | null;
  playerName?: string;
  blobs?: import('../types').Blob[];
  // From hook:
  nodes: import('../types').NetworkNode[];
  isLoading: boolean;
  myNodes: import('../types').NetworkNode[];
  totalIncome: number;
  totalPending: number;
  attackNode: (node: import('../types').NetworkNode, blobId: string) => Promise<{ success: boolean; message: string }>;
  collectFromNode: (node: import('../types').NetworkNode) => Promise<number>;
  collectAll: () => Promise<number>;
  getPendingCubes: (node: import('../types').NetworkNode) => number;
  attackCooldowns: Record<string, number>;
  onBuyShield?: (nodeId: string, hours: number, cost: number) => void;
  onToast?: (msg: string) => void;
}

export function NetworkMap({
  walletAddress,
  playerName,
  blobs,
  nodes,
  isLoading,
  myNodes,
  totalIncome,
  totalPending,
  attackNode,
  collectFromNode,
  collectAll,
  getPendingCubes,
  attackCooldowns,
  onBuyShield,
  onToast,
}: NetworkMapProps) {
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [pendingAttackNode, setPendingAttackNode] = useState<NetworkNode | null>(null);
  const [selectedAttackBlobId, setSelectedAttackBlobId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG viewport dimensions
  const VP_W = 380;
  const VP_H = 480;

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };
  const onPointerUp = () => {
    setIsDragging(false);
    dragStart.current = null;
  };

  const handleNodeClick = (node: NetworkNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

  const handleAttack = (node: NetworkNode) => {
    // Open blob selector instead of immediate attack
    setPendingAttackNode(node);
    setSelectedNode(null);
  };

  const confirmAttack = async () => {
    if (!pendingAttackNode || !selectedAttackBlobId) return;
    const result = await attackNode(pendingAttackNode, selectedAttackBlobId);
    onToast?.(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    setPendingAttackNode(null);
    setSelectedAttackBlobId(null);
  };

  const handleCollect = async (node: NetworkNode) => {
    const earned = await collectFromNode(node);
    if (earned > 0) onToast?.(`💠 +${earned} collected!`);
    setSelectedNode(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading network…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 relative">

      {/* Stats bar */}
      <div className="flex gap-2 px-4 pt-1 pb-2">
        <div className="flex-1 bg-white/5 rounded-xl p-2.5 border border-white/8">
          <div className="text-slate-400 text-[9px] uppercase tracking-wider">Nodes held</div>
          <div className="text-white font-bold text-sm mt-0.5">{myNodes.length} / {nodes.length}</div>
        </div>
        <div className="flex-1 bg-white/5 rounded-xl p-2.5 border border-white/8">
          <div className="text-slate-400 text-[9px] uppercase tracking-wider">Income</div>
          <div className="text-white font-bold text-sm mt-0.5">💠 {totalIncome}/hr</div>
        </div>
        {totalPending > 0 ? (
          <button
            onClick={() => collectAll().then(n => onToast?.(`Collected 💠 ${n}!`))}
            className="flex-1 bg-blue-600/80 rounded-xl p-2.5 border border-blue-500/60 active:scale-95 transition-all text-left"
          >
            <div className="text-[9px] text-blue-200 uppercase tracking-wider">Collect all</div>
            <div className="text-white font-bold text-sm">💠 {totalPending}</div>
          </button>
        ) : (
          <div className="flex-1 bg-white/5 rounded-xl p-2.5 border border-white/8">
            <div className="text-slate-400 text-[9px] uppercase tracking-wider">Max nodes</div>
            <div className="text-white font-bold text-sm mt-0.5">{blobs ? blobs.length * 2 : '∞'}</div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="px-4 pb-2 text-slate-500 text-[10px]">
        Drag to pan · tap a node to capture or attack
      </div>

      {/* SVG Map */}
      <div className="flex-1 overflow-hidden relative mx-2 mb-2 rounded-2xl border border-white/8 bg-[#04081a]">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${-VP_W / 2 - offset.x} ${-VP_H / 2 - offset.y} ${VP_W} ${VP_H}`}
          className={`select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Background grid glow */}
          <defs>
            <radialGradient id="centerGlow">
              <stop offset="0%" stopColor="#ccaa00" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ccaa00" stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="0" cy="0" r="200" fill="url(#centerGlow)" />

          {nodes.map(node => {
            const { x, y } = hexToPixel(node.col, node.row);
            const color = TIER_COLORS[node.tier];
            const icon = TIER_ICONS[node.tier];
            const isSelected = selectedNode?.id === node.id;
            const isOwned = walletAddress ? node.owner === walletAddress : false;
            const glowColor = isOwned && node.blobPersonality
              ? PERSONALITY_GLOWS[node.blobPersonality] ?? color
              : color;

            // Hex inner radius (slightly smaller than HEX_SIZE for gap)
            const innerSize = HEX_SIZE - 2;

            return (
              <g
                key={node.id}
                data-node="true"
                transform={`translate(${x}, ${y})`}
                onClick={(e) => handleNodeClick(node, e)}
                className="cursor-pointer"
                style={{ transition: 'opacity 0.2s' }}
              >
                {/* Glow ring for selected or owned */}
                {(isSelected || isOwned) && (
                  <polygon
                    points={hexPoints(0, 0, innerSize + 4)}
                    fill="none"
                    stroke={glowColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={isSelected ? 0.9 : 0.5}
                    filter="url(#glow)"
                  />
                )}

                {/* Main hex */}
                <polygon
                  points={hexPoints(0, 0, innerSize)}
                  fill={
                    isOwned
                      ? glowColor + '28'
                      : node.isNPC
                      ? '#ffffff10'
                      : color + '14'
                  }
                  stroke={
                    isOwned
                      ? glowColor
                      : isSelected
                      ? color
                      : color + '55'
                  }
                  strokeWidth={isSelected ? 1.5 : 0.8}
                />

                {/* Tier icon */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={node.tier === 5 ? 14 : node.tier === 4 ? 11 : 9}
                  y={node.tier >= 4 ? -2 : 0}
                  style={{ userSelect: 'none' }}
                >
                  {icon}
                </text>

                {/* Income label for owned nodes */}
                {isOwned && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={8}
                    fontSize={6}
                    fill={glowColor}
                    fontWeight="bold"
                    style={{ userSelect: 'none' }}
                  >
                    +{node.cubesPerHour}
                  </text>
                )}

                {/* NPC indicator */}
                {node.isNPC && !isOwned && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={8}
                    fontSize={5}
                    fill="#666"
                    style={{ userSelect: 'none' }}
                  >
                    NPC
                  </text>
                )}

                {/* Type badge */}
                {node.type !== 'standard' && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={-10}
                    fontSize={5}
                    style={{ userSelect: 'none' }}
                  >
                    {node.type === 'boost' ? '⚡' :
                     node.type === 'contested' ? '⚔️' :
                     node.type === 'dark' ? '🌙' :
                     node.type === 'event' ? '🎯' : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-xl p-2 border border-white/10">
          {([1, 2, 3, 4, 5] as NodeTier[]).map(tier => (
            <div key={tier} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-[8px] text-slate-400">
                {TIER_ICONS[tier]} T{tier} · {NODE_CONFIG.cubesPerHour[tier]}/hr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-40"
            onClick={() => setSelectedNode(null)}
          />
          <NodePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onAttack={handleAttack}
            onCollect={handleCollect}
            pendingCubes={getPendingCubes(selectedNode)}
            walletAddress={walletAddress}
            onBuyShield={onBuyShield}
          />
        </>
      )}

      {pendingAttackNode && blobs && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-40"
            onClick={() => { setPendingAttackNode(null); setSelectedAttackBlobId(null); }}
          />
          <BlobSelectorSheet
            node={pendingAttackNode}
            blobs={blobs}
            nodes={nodes}
            walletAddress={walletAddress}
            selectedBlobId={selectedAttackBlobId}
            onSelect={setSelectedAttackBlobId}
            onConfirm={confirmAttack}
            onCancel={() => { setPendingAttackNode(null); setSelectedAttackBlobId(null); }}
            calcPower={calcBlobPower}
            attackCooldowns={attackCooldowns}
          />
        </>
      )}
    </div>
  );
}
