import React from 'react';
import { LeaderboardEntry } from '../hooks/useLeaderboard';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  myRank: number | null;
  myScore: number;
  isLoading: boolean;
  walletAddress: string | null;
  playerName: string;
  blobs: any[];
  totalExpeditionsAllTime: number;
  onClose: () => void;
}

export function LeaderboardModal({
  entries, myRank, myScore, isLoading,
  walletAddress, playerName, blobs, totalExpeditionsAllTime, onClose,
}: LeaderboardModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full bg-[#08102a] border-t border-white/10 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">🏆 Leaderboard</h2>
            <p className="text-slate-400 text-xs mt-0.5">All-time rankings</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* My card */}
        {walletAddress && (
          <div className="bg-blue-600/15 border border-blue-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-white text-xs font-semibold">{playerName || 'You'}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">
                {blobs.length} blobs · {totalExpeditionsAllTime} expeditions
              </p>
            </div>
            <div className="text-right">
              <p className="text-blue-300 font-bold text-sm">{myScore.toLocaleString()} pts</p>
              {myRank && (
                <p className="text-slate-400 text-[10px]">#{myRank} of {entries.length}</p>
              )}
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="text-slate-500 text-xs text-center py-8 animate-pulse">
            Loading leaderboard…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-slate-500 text-xs text-center py-8">
            No players yet — be the first! 🏆
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entries.slice(0, 50).map((entry, i) => {
              const isMe = entry.walletAddress.toLowerCase() === (walletAddress ?? '').toLowerCase();
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

              return (
                <div
                  key={entry.walletAddress}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    isMe
                      ? 'border-blue-500/40 bg-blue-600/12'
                      : 'border-white/6 bg-white/3'
                  }`}
                >
                  <span className="text-sm w-6 text-center flex-shrink-0">
                    {medal ?? <span className="text-slate-500 text-xs">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
                      {entry.playerName}
                    </p>
                    <p className="text-slate-500 text-[9px]">
                      Lv.{entry.totalLevel} total · {entry.totalExpeditions} exp
                    </p>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${isMe ? 'text-blue-300' : 'text-slate-300'}`}>
                    {entry.score.toLocaleString()}
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
