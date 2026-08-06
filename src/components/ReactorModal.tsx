/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Atom, Users, Coins, TrendingUp, Gift,
  CheckCircle2, AlertTriangle, ExternalLink, Loader2, Wallet, Sparkles,
} from 'lucide-react';
import type { ReactorPhase, UnclaimedReward } from '../hooks/useReactor';
import { ReactorCoreCanvas } from './ReactorCoreCanvas';
import { playTapSound } from '../utils/audio';

interface ReactorModalProps {
  phase: ReactorPhase | null;
  eventId?: number | null;
  target: number;
  totalContributed: number;
  totalReward: number;
  contributorsCount: number;
  progressPercent: number;
  synthesizingProgress: number;
  msUntilClaimEnd: number;
  myContribution: number;
  estimatedReward: number;
  myAllocation: number;
  myClaimed: boolean;
  cubes: number;
  isClaiming: boolean;
  claimError: string | null;
  claimTxHash: string | null;
  walletAddress: string | null;
  firestoreError?: string | null;
  unclaimedRewards?: UnclaimedReward[];
  onContribute: (amount: number) => Promise<boolean>;
  onClaim: () => Promise<boolean>;
  onClaimArchive?: (reward: UnclaimedReward) => Promise<boolean>;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

/** Флаг доступности реактора. Когда false — показываем анонс USDC Reward Pool */
export const REACTOR_LIVE = false;

/** Палитра под фазу: ядро, акценты и тексты берут цвет отсюда */
const PHASE_THEME: Record<string, { color: string; label: string; sub: string }> = {
  collecting:   { color: '#00aaff', label: 'Collecting',    sub: 'Feed the core with Cubes' },
  synthesizing: { color: '#a855f7', label: 'Synthesizing',  sub: 'Calculating allocations' },
  claimable:    { color: '#10b981', label: 'Claim Open',    sub: 'Your USDC is ready' },
  closed:       { color: '#64748b', label: 'Closed',        sub: 'Next event incoming' },
  inactive:     { color: '#475569', label: 'Offline',       sub: 'No active event' },
};

/** Компактная плитка статистики */
function StatTile({
  icon, label, value, accent, mono = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex-1 bg-white/[0.04] border border-white/8 rounded-2xl px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase tracking-[0.12em] font-bold mb-1">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`font-black text-[15px] leading-tight truncate ${mono ? 'font-mono' : ''}`}
        style={{ color: accent || '#ffffff' }}
      >
        {value}
      </div>
    </div>
  );
}

export function ReactorModal({
  phase, eventId, target, totalContributed, totalReward, contributorsCount,
  progressPercent, synthesizingProgress, msUntilClaimEnd,
  myContribution, estimatedReward, myAllocation, myClaimed,
  cubes, isClaiming, claimError, claimTxHash,
  walletAddress, firestoreError, unclaimedRewards, onContribute, onClaim, onClaimArchive,
}: ReactorModalProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [justContributed, setJustContributed] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  // Инкремент триггерит вспышку ядра на canvas
  const [flashKey, setFlashKey] = useState(0);

  const handleContribute = async (amount: number) => {
    if (!amount || amount <= 0 || amount > cubes || contributing) return;
    setContributing(true);
    playTapSound();
    const ok = await onContribute(amount);
    if (ok) {
      // Кубы уже списаны сервером, и новый баланс приехал в GameState
      // через onServerCubes в useReactor — локально ничего не вычитаем
      setJustContributed(true);
      setFlashKey((k) => k + 1);
      setCustomAmount('');
      setTimeout(() => setJustContributed(false), 3000);
    }
    setContributing(false);
  };

  const handleClaim = async () => {
    playTapSound();
    const ok = await onClaim();
    if (ok) setJustClaimed(true);
  };

  const isInactive = !phase || phase === 'inactive';
  const theme = PHASE_THEME[phase || 'inactive'] || PHASE_THEME.inactive;

  // Ядро показывает прогресс сбора, а в synthesizing — прогресс синтеза
  const coreProgress =
    phase === 'synthesizing' ? synthesizingProgress :
    phase === 'claimable' || phase === 'closed' ? 100 :
    progressPercent;

  const sharePercent = totalContributed > 0 && myContribution > 0
    ? (myContribution / totalContributed) * 100
    : 0;

  if (!REACTOR_LIVE) {
    return (
      <div className="flex flex-col flex-1 animate-fade-in p-4 pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center border bg-blue-500/15 border-blue-500/40"
              style={{ boxShadow: '0 0 20px rgba(59,130,246,0.25)' }}
            >
              <Atom className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight tracking-tight font-display">
                USDC Reward Pool
              </h2>
              <p className="text-blue-400 text-[11px] font-bold mt-0.5 uppercase tracking-wider font-mono">
                Coming Soon
              </p>
            </div>
          </div>
        </div>

        {/* Core Canvas (Visual backdrop decoration) */}
        <div className="relative mb-4">
          <div
            className="relative w-full h-52 overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(6,10,31,0.5), #04081a)' }}
          >
            <ReactorCoreCanvas
              progress={100}
              color="#00aaff"
              flashKey={0}
              spinning={true}
            />

            {/* Badge overlay */}
            <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold text-blue-300 bg-[#04081a]/80 border border-blue-500/30 backdrop-blur-md shadow-lg font-mono">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Preparing Season 1
              </span>
            </div>
          </div>
        </div>

        {/* Announcement Box */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 text-center mb-4">
          <h3 className="text-white font-black text-base sm:text-lg mb-2 font-display">
            USDC Reward Pool — Coming Soon
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
            Keep collecting Cubes — a season with real USDC rewards is on the way. Cubes you hold now will count toward it.
          </p>

          {/* Current player Cubes counter */}
          <div className="inline-flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2.5 text-amber-300 font-mono font-bold text-sm shadow-inner">
            <span>Your Cubes:</span>
            <span className="text-amber-400 text-base font-black">{cubes.toLocaleString()} 💠</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-in">
          <div className="p-4 pb-6">

            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                  style={{
                    background: `${theme.color}18`,
                    borderColor: `${theme.color}44`,
                    boxShadow: `0 0 20px ${theme.color}22`,
                  }}
                >
                  <Atom className="w-6 h-6" style={{ color: theme.color }} />
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight tracking-tight font-display">
                    The Blob Reactor
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {theme.sub}
                  </p>
                </div>
              </div>
            </div>

            {/* Фаза + счётчики */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                  phase === 'collecting' ? 'animate-pulse' : ''
                }`}
                style={{
                  color: theme.color,
                  borderColor: `${theme.color}55`,
                  background: `${theme.color}14`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: theme.color, boxShadow: `0 0 8px ${theme.color}` }}
                />
                {theme.label}
              </span>
              {!isInactive && typeof eventId === 'number' && eventId > 0 && (
                <span className="text-slate-500 text-[11px] font-mono">
                  Event #{eventId}
                </span>
              )}
            </div>

            {/* Unclaimed Rewards Banner */}
            {unclaimedRewards && unclaimedRewards.length > 0 && (
              <div className="mb-4 space-y-2">
                {unclaimedRewards.map((reward) => (
                  <div
                    key={reward.eventId}
                    className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-white font-bold leading-tight">
                          У тебя есть незаклейменная награда за Season {reward.eventId} — {reward.allocationTokens} USDC
                        </p>
                        <p className="text-emerald-400/70 text-[10px] mt-0.5 font-mono">
                          Available to claim on Base L2
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={isClaiming || !walletAddress}
                      onClick={() => onClaimArchive && onClaimArchive(reward)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-md font-mono"
                    >
                      Claim {reward.allocationTokens} USDC
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Firestore error warning */}
            {firestoreError && (
              <div className="mb-4 bg-red-950/40 border border-red-500/30 text-red-300 rounded-2xl p-3 text-xs leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Connection issue:
                </p>
                <p className="mb-2">{firestoreError}</p>
                <p className="text-slate-400 text-[10px]">
                  If you see "Missing or insufficient permissions", check your Firebase Security Rules.
                </p>
              </div>
            )}

            {/* ⚛ Живое ядро */}
            <div className="relative mb-4">
              <div
                className="relative w-full h-52 overflow-hidden rounded-3xl border border-white/8"
                style={{ background: 'radial-gradient(circle at 50% 45%, rgba(6,10,31,0.4), #04081a)' }}
              >
                <ReactorCoreCanvas
                  progress={coreProgress}
                  color={theme.color}
                  flashKey={flashKey}
                  spinning={phase === 'synthesizing'}
                />

                {/* Плашка «зарядка» поверх ядра */}
                <div className="absolute bottom-2.5 inset-x-0 text-center pointer-events-none">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md"
                    style={{
                      color: theme.color,
                      background: 'rgba(4,8,26,0.55)',
                      border: `1px solid ${theme.color}44`,
                      boxShadow: `0 0 16px ${theme.color}22`,
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {phase === 'synthesizing'
                      ? `${Math.min(100, Math.round(synthesizingProgress))}% synthesized`
                      : `${totalContributed.toLocaleString()} / ${target.toLocaleString()} Cubes`}
                  </span>
                </div>
              </div>
            </div>

            {/* Неактивный стейт */}
            {isInactive && (
              <div className="text-center py-4">
                <p className="text-slate-300 text-sm font-semibold">No active Reactor Event</p>
                <p className="text-slate-500 text-xs mt-1">Check back soon for the next event!</p>
              </div>
            )}

            {/* ── COLLECTING ── */}
            {phase === 'collecting' && (
              <>
                {/* Мои цифры */}
                <div className="flex gap-2 mb-4">
                  <StatTile
                    icon={<Users className="w-3 h-3" />}
                    label="Contributors"
                    value={contributorsCount.toLocaleString()}
                    accent="#94a3b8"
                  />
                  <StatTile
                    icon={<TrendingUp className="w-3 h-3" />}
                    label="Pool"
                    value={`${totalReward.toLocaleString()} USDC`}
                    accent={theme.color}
                  />
                </div>
                <div className="flex gap-2 mb-4">
                  <StatTile
                    icon={<Coins className="w-3 h-3" />}
                    label="Your contribution"
                    value={`${myContribution.toLocaleString()} 💠`}
                  />
                  <StatTile
                    icon={<TrendingUp className="w-3 h-3" />}
                    label="Est. reward"
                    value={estimatedReward > 0 ? `${estimatedReward.toLocaleString()} ⬡` : '—'}
                    accent="#34d399"
                  />
                </div>

                {/* Вклад */}
                {walletAddress ? (
                  <>
                    <p className="text-white text-sm font-bold mb-2 flex items-center justify-between">
                      <span>Contribute Cubes</span>
                      <span className="text-slate-500 text-xs font-normal font-mono">
                        Available: {cubes.toLocaleString()} 💠
                      </span>
                    </p>

                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {QUICK_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          disabled={cubes < amt || contributing}
                          onClick={() => handleContribute(amt)}
                          className="py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-blue-900/30 hover:border-blue-500/40 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-mono"
                        >
                          {amt >= 1000 ? `${amt / 1000}K` : amt}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 mb-3">
                      <input
                        type="number"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Custom amount"
                        className="flex-1 bg-white/6 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 outline-none focus:border-blue-500/50 font-mono"
                      />
                      <button
                        disabled={!customAmount || Number(customAmount) <= 0 || Number(customAmount) > cubes || contributing}
                        onClick={() => handleContribute(Number(customAmount))}
                        className="px-5 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 cursor-pointer border"
                        style={{
                          background: `linear-gradient(90deg, ${theme.color}cc, ${theme.color})`,
                          borderColor: `${theme.color}66`,
                          boxShadow: `0 4px 16px ${theme.color}33`,
                        }}
                      >
                        {contributing ? (
                          <Loader2 className="w-4 h-4 animate-spin inline" />
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>

                    {justContributed && (
                      <div className="text-emerald-400 text-xs text-center py-1 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Contributed! Your share is growing.
                      </div>
                    )}

                    <p className="text-slate-600 text-[10px] text-center mt-2">
                      More Cubes = larger share of the {totalReward.toLocaleString()} USDC pool
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-sm">
                    <Wallet className="w-4 h-4" />
                    Connect your wallet to contribute
                  </div>
                )}
              </>
            )}

            {/* ── SYNTHESIZING ── */}
            {phase === 'synthesizing' && (
              <div className="text-center py-2">
                <p className="text-slate-300 text-sm font-semibold">
                  Calculating allocations for all contributors.
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Claim window opens in ~6 hours.
                </p>
                {myContribution > 0 && (
                  <div className="mt-4 bg-white/[0.04] border border-white/8 rounded-2xl p-3">
                    <p className="text-slate-400 text-xs">Your contribution</p>
                    <p className="text-white font-black text-lg font-mono">
                      {myContribution.toLocaleString()} 💠
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── CLAIMABLE ── */}
            {phase === 'claimable' && (
              <div>
                {myAllocation > 0 ? (
                  myClaimed || justClaimed ? (
                    <div className="text-center py-6">
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                        style={{ background: `${theme.color}18`, border: `1px solid ${theme.color}44` }}
                      >
                        <CheckCircle2 className="w-8 h-8" style={{ color: theme.color }} />
                      </div>
                      <p className="text-emerald-400 font-black text-lg">Claimed!</p>
                      <p className="text-slate-400 text-xs mt-2">
                        {myAllocation.toLocaleString()} USDC sent to your wallet.
                      </p>
                      {claimTxHash && (
                        <a
                          href={`https://basescan.org/tx/${claimTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 text-xs mt-3 inline-flex items-center gap-1 underline"
                        >
                          View on Basescan <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      <div
                        className="rounded-2xl p-4 mb-4 text-center border"
                        style={{ background: `${theme.color}10`, borderColor: `${theme.color}33` }}
                      >
                        <p className="text-slate-400 text-xs mb-1">Your allocation</p>
                        <p className="text-white font-black text-4xl font-mono">
                          {myAllocation.toLocaleString()}
                        </p>
                        <p className="text-lg font-black mt-1" style={{ color: theme.color }}>
                          USDC
                        </p>
                        <p className="text-slate-500 text-[10px] mt-2">
                          Based on your {myContribution.toLocaleString()} Cube contribution
                          {sharePercent > 0 && ` · ${sharePercent.toFixed(2)}% share`}
                        </p>
                      </div>

                      <button
                        disabled={isClaiming || !walletAddress}
                        onClick={handleClaim}
                        className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border"
                        style={{
                          background: isClaiming ? '#1e293b' : 'linear-gradient(90deg, #059669, #10b981)',
                          borderColor: '#34d39966',
                          boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                        }}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Confirming transaction…
                          </>
                        ) : (
                          <>
                            <Gift className="w-5 h-5" />
                            Claim {myAllocation.toLocaleString()} USDC
                          </>
                        )}
                      </button>

                      {claimError && (
                        <p className="text-red-400 text-xs text-center mt-3">{claimError}</p>
                      )}

                      <p className="text-slate-500 text-[10px] text-center mt-3">
                        Tokens are sent to your wallet on Base. Requires gas (ETH).
                      </p>
                    </>
                  )
                ) : (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-3 bg-white/5 border border-white/10 flex items-center justify-center opacity-60">
                      <Coins className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-300 text-sm">No allocation for this wallet.</p>
                    <p className="text-slate-500 text-xs mt-1">
                      You didn't contribute to this Reactor Event.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── CLOSED ── */}
            {phase === 'closed' && (
              <div className="text-center py-6">
                <p className="text-slate-300 text-sm font-semibold">Reactor Event Closed</p>
                <p className="text-slate-500 text-xs mt-1">The next event is being prepared.</p>
              </div>
            )}

          </div>
    </div>
  );
}
