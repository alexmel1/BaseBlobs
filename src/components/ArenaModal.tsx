import React from 'react';
import { ArenaEntry, ARENA_REWARDS } from '../hooks/useArena';

interface ArenaModalProps {
  entries: ArenaEntry[];
  myRank: number | null;
  myEntry: ArenaEntry | undefined;
  weekKey: string;
  msUntilEnd: number;
  isLoading: boolean;
  walletAddress: string | null;
  onClose: () => void;
}

function fmtCountdown(ms: number): string {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function ArenaModal({
  entries, myRank, myEntry, weekKey, msUntilEnd,
  isLoading, walletAddress, onClose,
}: ArenaModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full bg-[#08102a] border-t border-white/10 rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">⚔️ Weekly Arena</h2>
            <p className="text-slate-400 text-xs mt-0.5">{weekKey}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Timer */}
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-purple-300 text-xs font-semibold">Resets in</p>
            <p className="text-white font-bold text-lg">{fmtCountdown(msUntilEnd)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Your rank</p>
            <p className="text-purple-300 font-bold text-lg">
              {myRank ? `#${myRank}` : '—'}
            </p>
          </div>
        </div>

        {/* Rewards table */}
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">Rewards</p>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {ARENA_REWARDS.slice(0, 5).map(r => (
            <div
              key={r.rank}
              className={`p-2.5 rounded-xl border ${
                myRank === r.rank
                  ? 'border-purple-400/50 bg-purple-900/20'
                  : 'border-white/6 bg-white/3'
              }`}
            >
              <p className="text-white text-xs font-semibold">{r.label}</p>
              <p className="text-emerald-400 text-[10px] mt-0.5">💠 {r.cubeReward.toLocaleString()}</p>
              <p className="text-purple-300 text-[10px]">+ {r.blobReward} $BLOB (soon)</p>
            </div>
          ))}
          <div className="p-2.5 rounded-xl border border-white/6 bg-white/3">
            <p className="text-white text-xs font-semibold">6th–10th</p>
            <p className="text-emerald-400 text-[10px] mt-0.5">💠 500</p>
            <p className="text-purple-300 text-[10px]">+ 50 $BLOB (soon)</p>
          </div>
        </div>

        {/* My entry */}
        {myEntry && (
          <div className="bg-blue-600/12 border border-blue-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-white text-xs font-semibold">{myEntry.playerName}</p>
              <p className="text-slate-400 text-[10px]">Your weekly score</p>
            </div>
            <p className="text-blue-300 font-bold text-sm">
              {myEntry.weeklyScore.toLocaleString()} pts
            </p>
          </div>
        )}

        {/* Top list */}
        <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">
          Top Players This Week
        </p>
        {isLoading ? (
          <div className="text-slate-500 text-xs text-center py-6 animate-pulse">
            Loading arena…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-slate-500 text-xs text-center py-6">
            No players yet — be the first! ⚔️
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entries.slice(0, 20).map((entry, i) => {
              const isMe = entry.walletAddress.toLowerCase() === (walletAddress ?? '').toLowerCase();
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              const reward = ARENA_REWARDS[i];

              return (
                <div
                  key={entry.walletAddress}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    isMe
                      ? 'border-blue-500/40 bg-blue-600/12'
                      : 'border-white/6 bg-white/3'
                  }`}
                >
                  <span className="text-sm w-5 text-center flex-shrink-0">
                    {medal ?? <span className="text-slate-500 text-xs">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                      {entry.playerName}
                    </p>
                    {reward && (
                      <p className="text-[9px] text-emerald-400/70">
                        Prize: 💠 {reward.cubeReward}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${isMe ? 'text-blue-300' : 'text-slate-300'}`}>
                    {entry.weeklyScore.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
