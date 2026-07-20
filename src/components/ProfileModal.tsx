import React from 'react';
import { Blob } from '../types';
import { TRAITS } from '../data';

interface ProfileModalProps {
  playerName: string;
  walletAddress: string | null;
  blobs: Blob[];
  cubes: number;
  totalCubesAllTime: number;
  totalExpeditionsAllTime: number;
  hasOGBadge: boolean;
  ogBadgePurchasedAt: number | null;
  leaderboardRank: number | null;
  leaderboardScore: number;
  nodesHeld: number;
  incomePerHour: number;
  onClose: () => void;
}

const PERSONALITY_COLORS: Record<string, string> = {
  happy: '#00aaff', sleepy: '#aa44ff', lucky: '#00ff88',
  chaotic: '#ff44aa', cosmic: '#8844ff', radiant: '#ffcc00',
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProfileModal({
  playerName, walletAddress, blobs, cubes, totalCubesAllTime,
  totalExpeditionsAllTime, hasOGBadge, ogBadgePurchasedAt,
  leaderboardRank, leaderboardScore, nodesHeld, incomePerHour, onClose,
}: ProfileModalProps) {
  const topBlob = blobs.reduce((top, b) => b.level > top.level ? b : top, blobs[0]);
  const totalLevels = blobs.reduce((s, b) => s + b.level, 0);
  const evolvedBlobs = blobs.filter(b => b.level >= 5).length;
  const radiantBlobs = blobs.filter(b => b.isRadiant).length;
  const blobsWithTraits = blobs.filter(b => b.trait).length;
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'Not connected';

  const stats = [
    { label: 'Total Blobs', value: blobs.length, icon: '🐣' },
    { label: 'Highest Level', value: topBlob?.level ?? 0, icon: '⭐' },
    { label: 'Total Levels', value: totalLevels, icon: '📈' },
    { label: 'Evolved (Lv.5+)', value: evolvedBlobs, icon: '✨' },
    { label: 'Radiant Blobs', value: radiantBlobs, icon: '✦' },
    { label: 'Blobs with Traits', value: blobsWithTraits, icon: '🧬' },
    { label: 'Nodes Held', value: nodesHeld, icon: '🌐' },
    { label: 'Network Income', value: `${incomePerHour}/hr`, icon: '💠' },
    { label: 'Expeditions', value: fmtNum(totalExpeditionsAllTime), icon: '🗺️' },
    { label: 'Cubes Earned', value: fmtNum(totalCubesAllTime), icon: '💠' },
    { label: 'Current Cubes', value: fmtNum(cubes), icon: '💎' },
    { label: 'Leaderboard', value: leaderboardRank ? `#${leaderboardRank}` : '—', icon: '🏆' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full bg-[#08102a] border-t border-white/10 rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">

        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/15 flex items-center justify-center text-2xl flex-shrink-0">
              🟦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-white font-bold text-base">{playerName || 'Trainer'}</h2>
                {hasOGBadge && <span className="text-yellow-400 text-sm" title="OG Badge">🏅</span>}
              </div>
              <p className="text-slate-400 text-xs mt-0.5">{shortAddr}</p>
              {leaderboardRank && (
                <p className="text-blue-400 text-[10px] mt-0.5 font-semibold">
                  #{leaderboardRank} · {leaderboardScore.toLocaleString()} pts
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* OG Badge detail */}
        {hasOGBadge && ogBadgePurchasedAt && (
          <div className="flex items-center gap-2 bg-yellow-900/15 border border-yellow-500/25 rounded-xl p-3 mb-4">
            <span className="text-xl">🏅</span>
            <div>
              <p className="text-yellow-300 text-xs font-semibold">OG Badge Holder</p>
              <p className="text-slate-400 text-[10px]">Since {fmtDate(ogBadgePurchasedAt)}</p>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">Statistics</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {stats.map(s => (
            <div key={s.label} className="bg-white/4 border border-white/7 rounded-xl p-3">
              <div className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">
                {s.icon} {s.label}
              </div>
              <div className="text-white font-bold text-sm">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Blob roster */}
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">My Blobs</p>
        <div className="flex flex-col gap-2">
          {blobs.map(blob => {
            const color = PERSONALITY_COLORS[blob.personality] ?? '#0088ff';
            const moodEmoji = ['😢', '😴', '😐', '😊'][blob.mood?.level ?? 2];
            return (
              <div
                key={blob.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/7 bg-white/3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '22', border: `1px solid ${color}55` }}
                >
                  <span className="text-sm">🟦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white text-xs font-semibold capitalize">{blob.personality}</span>
                    <span className="text-slate-400 text-[10px]">Lv.{blob.level}</span>
                    <span className="text-[10px]">{moodEmoji}</span>
                    {blob.isRadiant && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        ✦ Radiant
                      </span>
                    )}
                    {blob.trait && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {TRAITS[blob.trait].icon} {TRAITS[blob.trait].name}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[9px] mt-0.5">
                    S{blob.upgrades.speed} H{blob.upgrades.harvest} F{blob.upgrades.fortune}
                    {' · '}{blob.totalExpeditions ?? 0} exp
                  </div>
                </div>
                <div style={{ color }} className="text-[10px] font-bold flex-shrink-0">
                  {blob.level >= 20 ? '👑' : blob.level >= 10 ? '💎' : blob.level >= 5 ? '✨' : '🟦'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
