/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DEV-ONLY стенд для визуала реактора.
 *
 * Рендерит ReactorModal на синтетических данных: кошелёк, Firestore и /api/*
 * не задействованы вообще, поэтому окна подписи в деве не появляются.
 * main.tsx монтирует этот компонент только при import.meta.env.DEV
 * и ?reactorPreview=1 — в прод-бандл он не попадает.
 */

import { useState } from 'react';
import { ReactorModal } from './ReactorModal';
import type { ReactorPhase } from '../hooks/useReactor';

const PHASES: ReactorPhase[] = [
  'inactive', 'collecting', 'synthesizing', 'claimable', 'closed',
];

const TARGET = 500_000;
const TOTAL_REWARD = 250_000;
const CLAIM_WINDOW_MS = 2 * 86_400_000 + 5 * 3_600_000;

export function ReactorPreview() {
  const [phase, setPhase] = useState<ReactorPhase>('collecting');
  const [totalContributed, setTotalContributed] = useState(180_000);
  const [myContribution, setMyContribution] = useState(12_000);
  const [cubes, setCubes] = useState(50_000);
  const [synthProgress, setSynthProgress] = useState(45);
  const [hasWallet, setHasWallet] = useState(true);
  const [myClaimed, setMyClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [withError, setWithError] = useState(false);
  const [open, setOpen] = useState(true);

  const progressPercent = Math.min(100, (totalContributed / TARGET) * 100);
  const share = totalContributed > 0 ? myContribution / totalContributed : 0;
  const myReward = Math.floor(TOTAL_REWARD * share);

  /** Вклад считается локально: ни подписи, ни запроса к серверу. */
  const handleContribute = async (amount: number) => {
    if (!amount || amount <= 0 || amount > cubes) return false;
    setCubes((c) => c - amount);
    setMyContribution((m) => m + amount);
    setTotalContributed((t) => t + amount);
    return true;
  };

  /** Имитация клейма — задержка вместо транзакции в Base. */
  const handleClaim = async () => {
    setIsClaiming(true);
    await new Promise((r) => setTimeout(r, 900));
    setIsClaiming(false);
    setMyClaimed(true);
    return true;
  };

  const toggleCls = (on: boolean) =>
    `px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
      on
        ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
        : 'bg-white/5 border-white/10 text-slate-400'
    }`;

  return (
    <div className="min-h-screen bg-[#04081a] text-white">
      {/* Панель управления стендом */}
      <div className="fixed top-0 inset-x-0 z-[60] bg-[#080d24]/95 backdrop-blur border-b border-white/10 px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-amber-400">
            Reactor preview · dev
          </span>
          <span className="text-[10px] text-slate-500">
            без кошелька и Firestore
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {PHASES.map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={toggleCls(phase === p)}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">progress</span>
            <input
              type="range"
              min={0}
              max={TARGET}
              step={1000}
              value={totalContributed}
              onChange={(e) => setTotalContributed(Number(e.target.value))}
              className="w-28 accent-blue-500"
            />
            <span className="font-mono text-slate-300 w-10">
              {Math.round(progressPercent)}%
            </span>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-slate-400">synth</span>
            <input
              type="range"
              min={0}
              max={100}
              value={synthProgress}
              onChange={(e) => setSynthProgress(Number(e.target.value))}
              className="w-24 accent-purple-500"
            />
            <span className="font-mono text-slate-300 w-8">{synthProgress}%</span>
          </label>

          <button onClick={() => setHasWallet((v) => !v)} className={toggleCls(hasWallet)}>
            wallet
          </button>
          <button onClick={() => setMyClaimed((v) => !v)} className={toggleCls(myClaimed)}>
            claimed
          </button>
          <button onClick={() => setWithError((v) => !v)} className={toggleCls(withError)}>
            error
          </button>
          <button
            onClick={() => setCubes(50_000)}
            className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11px] text-slate-400 cursor-pointer"
          >
            reset cubes
          </button>
        </div>
      </div>

      {open ? (
        <ReactorModal
          phase={phase}
          eventId={7}
          target={TARGET}
          totalContributed={totalContributed}
          totalReward={TOTAL_REWARD}
          contributorsCount={342}
          progressPercent={progressPercent}
          synthesizingProgress={synthProgress}
          msUntilClaimEnd={CLAIM_WINDOW_MS}
          myContribution={myContribution}
          estimatedReward={myReward}
          myAllocation={myReward}
          myClaimed={myClaimed}
          cubes={cubes}
          isClaiming={isClaiming}
          claimError={withError ? 'Insufficient ETH for gas (preview)' : null}
          claimTxHash={myClaimed ? '0xpreview0000000000000000000000000000000000000000000000000000000000' : null}
          walletAddress={hasWallet ? '0x1234567890AbCdEf1234567890aBcDeF12345678' : null}
          firestoreError={withError ? 'Missing or insufficient permissions (preview)' : null}
          onContribute={handleContribute}
          onClaim={handleClaim}
          onClose={() => setOpen(false)}
        />
      ) : (
        <div className="pt-32 flex justify-center">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600/80 border border-blue-400/40 text-sm font-bold cursor-pointer"
          >
            Открыть реактор снова
          </button>
        </div>
      )}
    </div>
  );
}
