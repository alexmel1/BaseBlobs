/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Swords, Trophy, FastForward, RotateCcw, X, Shield, Sparkles } from 'lucide-react';
import { P } from '../data';
import type { ArenaSquad, ArenaMatchResult, ArenaFighter, ArenaLogEntry } from '../types';
import { BlobCanvas } from './BlobCanvas';
import { playHitSound, playTapSound } from '../utils/audio';

interface ArenaReplayModalProps {
  squad: ArenaSquad | null;
  result: ArenaMatchResult;
  onClose: () => void;
}

const ACCENT = '#f43f5e';

export const ArenaReplayModal: React.FC<ArenaReplayModalProps> = ({ squad, result, onClose }) => {
  const [currentDuel, setCurrentDuel] = useState<number>(0);
  const [currentLogIndex, setCurrentLogIndex] = useState<number>(0);
  const [phase, setPhase] = useState<'playing' | 'duel_transition' | 'finished'>('playing');

  // Player fighters and enemy fighters per duel (0, 1, 2)
  const playerFighters: ArenaFighter[] = squad?.fighters || [];
  const enemyFighters: ArenaFighter[] = result.opponentFighters || [];

  // Running scores
  const [score, setScore] = useState<{ player: number; enemy: number }>({ player: 0, enemy: 0 });
  const [duelResults, setDuelResults] = useState<(boolean | null)[]>([null, null, null]);

  // Current HP during animation
  const pFighter = playerFighters[currentDuel];
  const eFighter = enemyFighters[currentDuel];

  const maxPlayerHp = pFighter?.hp || 100;
  const maxEnemyHp = eFighter?.hp || 100;

  const [playerHp, setPlayerHp] = useState<number>(maxPlayerHp);
  const [enemyHp, setEnemyHp] = useState<number>(maxEnemyHp);

  // Active hit effect details
  const [activeHit, setActiveHit] = useState<{
    id: number;
    byPlayer: boolean;
    damage: number;
    crit: boolean;
    double: boolean;
  } | null>(null);

  // Attacker animation trigger
  const [attackingSide, setAttackingSide] = useState<'player' | 'enemy' | null>(null);
  const [hitSide, setHitSide] = useState<'player' | 'enemy' | null>(null);

  // Log entries for current duel
  const duelLogs = result.log.filter((l) => l.duel === currentDuel);

  // Reset HP when changing duel
  useEffect(() => {
    if (phase === 'finished') return;
    const pf = playerFighters[currentDuel];
    const ef = enemyFighters[currentDuel];
    if (pf) setPlayerHp(pf.hp);
    if (ef) setEnemyHp(ef.hp);
    setCurrentLogIndex(0);
    setActiveHit(null);
  }, [currentDuel]);

  // Main replay playback interval
  useEffect(() => {
    if (phase !== 'playing') return;

    const timer = setInterval(() => {
      if (currentLogIndex < duelLogs.length) {
        const entry = duelLogs[currentLogIndex];

        // Apply health
        setPlayerHp(entry.hpLeftPlayer);
        setEnemyHp(entry.hpLeftEnemy);

        // Attacker / Hit effects
        const isPlayerAttacking = entry.byPlayer;
        setAttackingSide(isPlayerAttacking ? 'player' : 'enemy');
        setHitSide(isPlayerAttacking ? 'enemy' : 'player');

        setActiveHit({
          id: Date.now(),
          byPlayer: entry.byPlayer,
          damage: entry.damage,
          crit: entry.crit,
          double: entry.double,
        });

        // Audio effect
        playHitSound(entry.crit);

        // Clear hit animation state after brief moment
        setTimeout(() => {
          setAttackingSide(null);
          setHitSide(null);
        }, 180);

        setCurrentLogIndex((prev) => prev + 1);
      } else {
        // Duel complete
        const dRes = result.duels.find((d) => d.duel === currentDuel);
        const pWon = dRes ? dRes.playerWon : playerHp > enemyHp;

        setDuelResults((prev) => {
          const next = [...prev];
          next[currentDuel] = pWon;
          return next;
        });

        setScore((prev) => ({
          player: prev.player + (pWon ? 1 : 0),
          enemy: prev.enemy + (pWon ? 0 : 1),
        }));

        setPhase('duel_transition');

        // Pause before next duel or finishing
        setTimeout(() => {
          if (currentDuel < 2) {
            setCurrentDuel((prev) => prev + 1);
            setPhase('playing');
          } else {
            setPhase('finished');
          }
        }, 750);
      }
    }, 380);

    return () => clearInterval(timer);
  }, [phase, currentDuel, currentLogIndex, duelLogs, result]);

  // Skip animation to immediately see the full result
  const handleSkip = () => {
    playTapSound();

    let pCount = 0;
    let eCount = 0;
    const finalDuelRes: boolean[] = [false, false, false];

    result.duels.forEach((d) => {
      finalDuelRes[d.duel] = d.playerWon;
      if (d.playerWon) pCount++;
      else eCount++;
    });

    setScore({ player: pCount, enemy: eCount });
    setDuelResults(finalDuelRes);
    setPhase('finished');
  };

  // Restart replay from duel 0
  const handleRestart = () => {
    playTapSound();
    setCurrentDuel(0);
    setCurrentLogIndex(0);
    setScore({ player: 0, enemy: 0 });
    setDuelResults([null, null, null]);
    setActiveHit(null);
    setPhase('playing');
  };

  const pPersonality = pFighter?.personality || 'happy';
  const ePersonality = eFighter?.personality || 'happy';

  const pBP = P[pPersonality] || P.happy;
  const eBP = P[ePersonality] || P.happy;

  const playerHpPct = Math.max(0, Math.min(100, (playerHp / maxPlayerHp) * 100));
  const enemyHpPct = Math.max(0, Math.min(100, (enemyHp / maxEnemyHp) * 100));

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 pt-2 sm:pt-4 overflow-y-auto no-scrollbar animate-fade-in">
      <div className="w-full max-w-sm sm:max-w-md bg-[#080d24] border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col relative overflow-hidden shadow-2xl no-scrollbar mt-1 sm:mt-2">
        {/* Ambient background glow */}
        <div
          className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: ACCENT }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: '#38bdf8' }}
        />

        {/* Header bar */}
        <div className="flex items-center justify-between mb-2.5 z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center border"
              style={{ background: `${ACCENT}22`, borderColor: `${ACCENT}55` }}
            >
              <Swords className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="text-white text-xs font-black uppercase tracking-wider font-display">
                Battle Replay
              </div>
              <div className="text-slate-400 text-[10px] font-mono">
                vs {result.isBot ? '⬡ ' : ''}{result.opponentName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {phase !== 'finished' && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold font-mono px-2.5 py-1 rounded-xl border border-white/15 cursor-pointer transition-all active:scale-95"
              >
                <FastForward className="w-3 h-3 text-amber-400" />
                Skip
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Duel slot indicators & score */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-2 mb-2.5 z-10 flex items-center justify-between">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((idx) => {
              const res = duelResults[idx];
              const isCurrent = idx === currentDuel && phase !== 'finished';
              return (
                <div
                  key={idx}
                  className={`px-2 py-0.5 sm:py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-400/15 text-amber-300 animate-pulse'
                      : res === true
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                      : res === false
                      ? 'border-rose-500/50 bg-rose-500/15 text-rose-400'
                      : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  Duel {idx + 1}
                  {res === true && ' ✓'}
                  {res === false && ' ✕'}
                </div>
              );
            })}
          </div>

          <div className="text-white font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-black/40 border border-white/10">
            <span className="text-emerald-400">{score.player}</span>
            <span className="text-slate-600 mx-1">:</span>
            <span className="text-rose-400">{score.enemy}</span>
          </div>
        </div>

        {/* Main Combat Canvas Stage */}
        <div className="relative bg-black/50 border border-white/10 rounded-2xl p-2.5 mb-2.5 z-10 flex flex-col items-center justify-center min-h-[190px] sm:min-h-[210px] overflow-hidden">
          {/* Subtle grid pattern background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />

          {/* Active hit float popup */}
          {activeHit && (
            <div
              key={activeHit.id}
              className={`absolute top-10 z-30 pointer-events-none animate-bounce font-mono font-black text-xs sm:text-sm ${
                activeHit.byPlayer ? 'right-8 sm:right-12' : 'left-8 sm:left-12'
              }`}
            >
              {activeHit.crit ? (
                <div className="bg-amber-500 text-black px-2 py-0.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.8)] border border-yellow-200 animate-pulse scale-105 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> CRIT -{activeHit.damage}!
                </div>
              ) : (
                <div className="bg-rose-500/90 text-white px-2 py-0.5 rounded-lg shadow-md border border-rose-300/40">
                  -{activeHit.damage}
                </div>
              )}
            </div>
          )}

          {/* Arena Stage Fighters */}
          <div className="w-full flex items-center justify-between px-1 gap-2">
            {/* Player Fighter (Left) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px]">
              <div className="text-slate-300 text-[10px] sm:text-[11px] font-bold font-mono truncate max-w-full mb-1">
                {pBP.name} <span className="text-slate-500 text-[9px]">Lv.{pFighter?.level || 1}</span>
              </div>

              {/* Player HP Bar */}
              <div className="w-full bg-slate-900 border border-white/15 rounded-full h-2.5 sm:h-3 p-0.5 mb-1.5 relative overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${playerHpPct}%`,
                    background:
                      playerHpPct > 50
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : playerHpPct > 20
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[7.5px] sm:text-[8px] font-mono font-bold text-white drop-shadow">
                  {playerHp} / {maxPlayerHp}
                </span>
              </div>

              {/* Player Blob Canvas */}
              <div
                className={`transition-all duration-150 ${
                  attackingSide === 'player' ? 'translate-x-5 scale-110' : ''
                } ${hitSide === 'player' ? 'brightness-150 scale-95' : ''}`}
              >
                <BlobCanvas personality={pPersonality} size={76} animate={playerHp > 0} />
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center font-mono">
              <span className="text-slate-600 font-black text-xs">VS</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                Slot {currentDuel + 1}
              </span>
            </div>

            {/* Enemy Fighter (Right) */}
            <div className="flex flex-col items-center flex-1 max-w-[130px]">
              <div className="text-slate-300 text-[10px] sm:text-[11px] font-bold font-mono truncate max-w-full mb-1">
                {eBP.name} <span className="text-slate-500 text-[9px]">Lv.{eFighter?.level || 1}</span>
              </div>

              {/* Enemy HP Bar */}
              <div className="w-full bg-slate-900 border border-white/15 rounded-full h-2.5 sm:h-3 p-0.5 mb-1.5 relative overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${enemyHpPct}%`,
                    background:
                      enemyHpPct > 50
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : enemyHpPct > 20
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[7.5px] sm:text-[8px] font-mono font-bold text-white drop-shadow">
                  {enemyHp} / {maxEnemyHp}
                </span>
              </div>

              {/* Enemy Blob Canvas */}
              <div
                className={`transition-all duration-150 ${
                  attackingSide === 'enemy' ? '-translate-x-5 scale-110' : ''
                } ${hitSide === 'enemy' ? 'brightness-150 scale-95' : ''}`}
              >
                <BlobCanvas personality={ePersonality} size={76} animate={enemyHp > 0} />
              </div>
            </div>
          </div>

          {/* Action Log Commentator Ticker */}
          <div className="mt-2 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/8 rounded-xl px-2.5 py-1 w-full text-center truncate">
            {activeHit ? (
              activeHit.byPlayer ? (
                <span>
                  ⚔️ <strong className="text-emerald-400">{pBP.name}</strong> strikes for{' '}
                  <strong className={activeHit.crit ? 'text-amber-400 font-black' : 'text-white'}>
                    {activeHit.damage} dmg
                  </strong>
                  {activeHit.crit ? ' (CRITICAL!)' : ''}
                </span>
              ) : (
                <span>
                  🛡️ <strong className="text-rose-400">{eBP.name}</strong> strikes for{' '}
                  <strong className={activeHit.crit ? 'text-amber-400 font-black' : 'text-white'}>
                    {activeHit.damage} dmg
                  </strong>
                  {activeHit.crit ? ' (CRITICAL!)' : ''}
                </span>
              )
            ) : phase === 'duel_transition' ? (
              <span className="text-amber-300 font-bold">
                Duel {currentDuel + 1} complete! Next matchup loading…
              </span>
            ) : (
              <span>Preparing duel {currentDuel + 1}…</span>
            )}
          </div>
        </div>

        {/* Final Result Summary Overlay / Modal View */}
        {phase === 'finished' && (
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 z-10 flex flex-col items-center animate-fade-in">
            <div
              className="text-base sm:text-lg font-black font-display uppercase tracking-wider mb-0.5"
              style={{ color: result.playerWon ? '#34d399' : '#fb7185' }}
            >
              {result.playerWon ? '🏆 VICTORY' : '💀 DEFEAT'} · {score.player}:{score.enemy}
            </div>

            <div className="flex items-center gap-3 text-xs font-mono my-1.5 bg-black/30 border border-white/8 rounded-xl px-3 py-1.5 w-full justify-center">
              <span className="text-emerald-400 font-bold">+{result.cubesEarned} 💠</span>
              <span className="text-slate-600">|</span>
              <span style={{ color: result.mmrDelta >= 0 ? '#34d399' : '#fb7185' }}>
                {result.mmrDelta > 0 ? '+' : ''}{result.mmrDelta} MMR
              </span>
              <span className="text-slate-500">({result.mmrAfter} total)</span>
            </div>

            <div className="flex gap-2 w-full mt-1.5">
              <button
                onClick={handleRestart}
                className="flex-1 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold font-mono cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Replay battle
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl text-white text-xs font-black cursor-pointer transition-all active:scale-95 border"
                style={{
                  background: `linear-gradient(90deg, ${ACCENT}cc, ${ACCENT})`,
                  borderColor: `${ACCENT}66`,
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
