/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Экран арены. Дизайн — в ARENA.md §9.
 *
 * Компонент полностью prop-driven: ничего не считает и не ходит в сеть сам.
 * Бой, рейтинг и награды приходят с сервера через useArena.
 */

import React, { useState } from 'react';
import {
  Swords, Trophy, Shield, Users, Clock, AlertTriangle,
  Loader2, Check, ChevronRight, Crown,
} from 'lucide-react';
import { P, ARENA_CONFIG, EVOLUTION_EMOJIS, getEvolutionStage, buildArenaFighter } from '../data';
import type { Blob, ArenaSquad, ArenaMatchResult } from '../types';
import type { ArenaMatchRecord, LeaderboardRow } from '../hooks/useArena';
import { BlobCanvas } from './BlobCanvas';
import { ArenaReplayModal } from './ArenaReplayModal';
import { playTapSound } from '../utils/audio';

interface ArenaScreenProps {
  blobs: Blob[];
  squad: ArenaSquad | null;
  isRegistered: boolean;
  isCalibrating: boolean;
  matchesPlayed: number;
  battlesLeft: number;
  dailyResetAt: number;
  season: number;
  seasonEndsAt: number;
  matches: ArenaMatchRecord[];
  leaderboard: LeaderboardRow[];
  myRank: number | null;
  walletAddress: string | null;
  isFighting: boolean;
  isRegistering: boolean;
  error: string | null;
  lastResult: ArenaMatchResult | null;
  onRegister: (blobIds: string[]) => Promise<boolean>;
  onFight: () => Promise<ArenaMatchResult | null>;
  onClearError: () => void;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'soon';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function shortWallet(w: string): string {
  return w.length > 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

const ACCENT = '#f43f5e';

export function ArenaScreen(props: ArenaScreenProps) {
  const {
    blobs, squad, isRegistered, isCalibrating, matchesPlayed, battlesLeft,
    dailyResetAt, season, seasonEndsAt, matches, leaderboard, myRank,
    walletAddress, isFighting, isRegistering, error, lastResult,
    onRegister, onFight, onClearError,
  } = props;

  const [tab, setTab] = useState<'squad' | 'leaderboard'>('squad');
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [replayResult, setReplayResult] = useState<ArenaMatchResult | null>(null);

  const hasEnoughBlobs = blobs.length >= ARENA_CONFIG.squadSize;

  const beginEdit = () => {
    playTapSound();
    setPicked(squad?.fighters?.map((f) => f.blobId) ?? []);
    setEditing(true);
    onClearError();
  };

  const togglePick = (id: string) => {
    playTapSound();
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= ARENA_CONFIG.squadSize) return prev;
      return [...prev, id];
    });
  };

  const confirmSquad = async () => {
    const ok = await onRegister(picked);
    if (ok) setEditing(false);
  };

  const handleFight = async () => {
    playTapSound();
    const res = await onFight();
    if (res) {
      setReplayResult(res);
    }
  };

  // ── Пустое состояние: блобов не хватает ──
  if (!hasEnoughBlobs) {
    return (
      <div className="flex flex-col flex-1 animate-fade-in p-4">
        <ArenaHeader season={season} seasonEndsAt={seasonEndsAt} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
            style={{ background: `${ACCENT}18`, borderColor: `${ACCENT}44` }}
          >
            <Swords className="w-8 h-8" style={{ color: ACCENT }} />
          </div>
          <h3 className="text-white font-black text-base">Squad of {ARENA_CONFIG.squadSize} required</h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed max-w-[260px]">
            The Arena runs on teams of {ARENA_CONFIG.squadSize}. You have {blobs.length}
            {blobs.length === 1 ? ' Blob' : ' Blobs'} — summon{' '}
            {ARENA_CONFIG.squadSize - blobs.length} more to enter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-in p-4 pb-6">
      <ArenaHeader season={season} seasonEndsAt={seasonEndsAt} />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3">
        {(['squad', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { playTapSound(); setTab(t); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              tab === t
                ? 'text-white'
                : 'bg-white/5 text-slate-400 border-white/8 hover:bg-white/10'
            }`}
            style={tab === t ? { background: `${ACCENT}22`, borderColor: `${ACCENT}66` } : undefined}
          >
            {t === 'squad' ? '⚔️ Squad' : '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 bg-red-950/40 border border-red-500/30 text-red-300 rounded-2xl p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={onClearError} className="text-red-400 hover:text-white cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {tab === 'leaderboard' ? (
        <LeaderboardList rows={leaderboard} myWallet={walletAddress} />
      ) : editing ? (
        <SquadEditor
          blobs={blobs}
          picked={picked}
          isRegistering={isRegistering}
          onToggle={togglePick}
          onCancel={() => setEditing(false)}
          onConfirm={confirmSquad}
        />
      ) : (
        <>
          {/* Rating + rank */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/[0.04] border border-white/8 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase tracking-[0.12em] font-bold mb-1">
                <Swords className="w-3 h-3" /> Rating
              </div>
              <div className="text-white font-black text-[15px] font-mono">
                {isRegistered ? squad!.mmr : '—'}
              </div>
            </div>
            <div className="bg-white/[0.04] border border-white/8 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase tracking-[0.12em] font-bold mb-1">
                <Trophy className="w-3 h-3" /> Rank
              </div>
              <div className="font-black text-[15px] font-mono" style={{ color: ACCENT }}>
                {isCalibrating
                  ? `Calib ${matchesPlayed}/${ARENA_CONFIG.calibrationMatches}`
                  : myRank
                  ? `#${myRank}`
                  : '—'}
              </div>
            </div>
          </div>

          {isRegistered && (
            <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-slate-400">
              <span className="text-emerald-400 font-bold">{squad!.wins}W</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400 font-bold">{squad!.losses}L</span>
              {isCalibrating && (
                <span className="ml-auto text-amber-400/90 text-[9px]">
                  Rating unstable during calibration
                </span>
              )}
            </div>
          )}

          {/* Squad card */}
          <SquadCard squad={squad} blobs={blobs} onEdit={beginEdit} isRegistered={isRegistered} />

          {/* Battles left + FIGHT */}
          <div className="mt-3 bg-[#080d24]/80 border border-white/8 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase tracking-[0.12em] font-bold">
                <Clock className="w-3 h-3" /> Battles today
              </div>
              <div className="text-slate-500 text-[9px] font-mono">
                {battlesLeft > 0
                  ? `resets in ${fmtCountdown(dailyResetAt - Date.now())}`
                  : `next in ${fmtCountdown(dailyResetAt - Date.now())}`}
              </div>
            </div>

            {/* Dots read faster than a number */}
            <div className="flex items-center gap-1.5 mb-3">
              {Array.from({ length: ARENA_CONFIG.dailyMatches }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full transition-all"
                  style={{
                    background: i < battlesLeft ? ACCENT : 'rgba(255,255,255,0.10)',
                    boxShadow: i < battlesLeft ? `0 0 8px ${ACCENT}66` : undefined,
                  }}
                />
              ))}
              <span className="text-white text-[10px] font-mono font-black ml-1">
                {battlesLeft}/{ARENA_CONFIG.dailyMatches}
              </span>
            </div>

            <button
              onClick={handleFight}
              disabled={!isRegistered || battlesLeft <= 0 || isFighting}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 border"
              style={{
                background:
                  !isRegistered || battlesLeft <= 0
                    ? '#1e293b'
                    : `linear-gradient(90deg, ${ACCENT}cc, ${ACCENT})`,
                borderColor: `${ACCENT}66`,
                boxShadow: battlesLeft > 0 && isRegistered ? `0 4px 16px ${ACCENT}33` : undefined,
              }}
            >
              {isFighting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving battle…
                </>
              ) : !isRegistered ? (
                'Register a squad first'
              ) : battlesLeft <= 0 ? (
                'No battles left today'
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  FIGHT
                </>
              )}
            </button>
          </div>

          {lastResult && (
            <LastBattleCard
              result={lastResult}
              onReplay={(res) => setReplayResult(res)}
            />
          )}

          {matches.length > 0 && (
            <div className="mt-3">
              <div className="text-slate-500 text-[9px] uppercase tracking-[0.12em] font-bold mb-1.5">
                Recent battles
              </div>
              <div className="flex flex-col gap-1.5">
                {matches.map((m) => (
                  <div
                    key={m.matchId}
                    className="flex items-center gap-2 bg-white/[0.03] border border-white/6 rounded-xl px-2.5 py-2"
                  >
                    <span className="text-xs">{m.playerWon ? '✅' : '❌'}</span>
                    <span className="text-white text-[11px] font-mono font-bold w-7">{m.score}</span>
                    <span className="text-slate-400 text-[10px] flex-1 truncate">
                      {m.isBot ? '⬡ ' : ''}{m.opponentName}
                    </span>
                    <span className="text-emerald-400/90 text-[10px] font-mono">
                      +{m.cubesEarned}
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold w-8 text-right"
                      style={{ color: m.mmrDelta >= 0 ? '#34d399' : '#fb7185' }}
                    >
                      {m.mmrDelta > 0 ? '+' : ''}{m.mmrDelta}
                    </span>
                    {lastResult && lastResult.matchId === m.matchId && (
                      <button
                        onClick={() => {
                          playTapSound();
                          setReplayResult(lastResult);
                        }}
                        className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer ml-1"
                        title="Replay battle"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {replayResult && (
        <ArenaReplayModal
          squad={squad}
          result={replayResult}
          onClose={() => setReplayResult(null)}
        />
      )}
    </div>
  );
}

function ArenaHeader({ season, seasonEndsAt }: { season: number; seasonEndsAt: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center border flex-shrink-0"
        style={{ background: `${ACCENT}18`, borderColor: `${ACCENT}44`, boxShadow: `0 0 20px ${ACCENT}22` }}
      >
        <Swords className="w-6 h-6" style={{ color: ACCENT }} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-white font-black text-lg leading-tight tracking-tight font-display">
          Arena
        </h2>
        <p className="text-slate-400 text-xs mt-0.5">
          Season {season} · ends in {fmtCountdown(seasonEndsAt - Date.now())}
        </p>
      </div>
    </div>
  );
}

function SquadCard({
  squad, blobs, onEdit, isRegistered,
}: {
  squad: ArenaSquad | null;
  blobs: Blob[];
  onEdit: () => void;
  isRegistered: boolean;
}) {
  return (
    <div className="bg-[#080d24]/80 border border-white/8 rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 text-slate-400 text-[9px] uppercase tracking-[0.12em] font-bold">
          <Users className="w-3 h-3" /> Your squad
        </div>
        <button
          onClick={onEdit}
          className="text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors hover:bg-white/5"
          style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
        >
          {isRegistered ? 'Edit' : 'Pick squad'}
        </button>
      </div>

      {!isRegistered ? (
        <p className="text-slate-500 text-[11px] py-3 text-center">
          No squad registered yet.
        </p>
      ) : (
        <div className="flex gap-2">
          {squad!.fighters.map((f, i) => {
            const bp = P[f.personality] || P.happy;
            // Блоб мог вырасти после регистрации — арена бьётся снимком
            const live = blobs.find((b) => b.id === f.blobId);
            const stale = live ? live.level !== f.level : false;
            return (
              <div
                key={f.blobId}
                className="flex-1 rounded-xl border p-2 flex flex-col items-center relative"
                style={{ background: `${bp.glow}0f`, borderColor: `${bp.glow}33` }}
              >
                <span className="absolute top-1 left-1.5 text-[8px] font-black text-slate-500 font-mono">
                  {i + 1}
                </span>
                {stale && (
                  <span
                    className="absolute top-1 right-1.5 text-[8px]"
                    title="This Blob leveled up — re-register to refresh its snapshot"
                  >
                    ⟳
                  </span>
                )}
                <BlobCanvas personality={f.personality} size={38} animate={false} />
                <div className="text-slate-300 text-[9px] font-bold mt-1 truncate max-w-full">
                  {bp.name}
                </div>
                <div className="text-slate-500 text-[8px] font-mono">Lv.{f.level}</div>
                <div className="flex items-center gap-1 mt-1 text-[8px] font-mono">
                  <span className="text-sky-400">{f.hp}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-rose-400">{f.atk}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isRegistered && (
        <p className="text-slate-600 text-[8.5px] font-mono mt-2 text-center leading-relaxed">
          Snapshot frozen at registration · <span className="text-sky-400">HP</span> · <span className="text-rose-400">ATK</span>
        </p>
      )}
    </div>
  );
}

function SquadEditor({
  blobs, picked, isRegistering, onToggle, onCancel, onConfirm,
}: {
  blobs: Blob[];
  picked: string[];
  isRegistering: boolean;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ready = picked.length === ARENA_CONFIG.squadSize;

  return (
    <div className="bg-[#080d24]/80 border border-white/8 rounded-2xl p-3.5">
      <div className="text-white text-xs font-bold mb-1">
        Pick {ARENA_CONFIG.squadSize} Blobs
      </div>
      <p className="text-slate-500 text-[10px] mb-3 leading-relaxed">
        Tap order sets the slots — slot 1 fights slot 1. Blobs stay free for
        expeditions and nodes.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {blobs.map((blob) => {
          const bp = P[blob.personality] || P.happy;
          const slot = picked.indexOf(blob.id);
          const isPicked = slot >= 0;
          const preview = buildArenaFighter(blob);
          return (
            <button
              key={blob.id}
              onClick={() => onToggle(blob.id)}
              className="rounded-xl border p-2 flex flex-col items-center relative cursor-pointer transition-all active:scale-95"
              style={{
                background: isPicked ? `${bp.glow}1a` : 'rgba(255,255,255,0.03)',
                borderColor: isPicked ? `${bp.glow}77` : 'rgba(255,255,255,0.08)',
              }}
            >
              {isPicked && (
                <span
                  className="absolute top-1 left-1.5 w-4 h-4 rounded-full text-[8px] font-black text-white flex items-center justify-center"
                  style={{ background: ACCENT }}
                >
                  {slot + 1}
                </span>
              )}
              <span className="absolute top-1 right-1.5 text-[8px]">
                {EVOLUTION_EMOJIS[getEvolutionStage(blob.level)]}
              </span>
              <BlobCanvas personality={blob.personality} size={40} animate={isPicked} />
              <div className="text-slate-300 text-[9px] font-bold mt-1 truncate max-w-full">
                {bp.name}
              </div>
              <div className="text-slate-500 text-[8px] font-mono">Lv.{blob.level}</div>
              <div className="flex items-center gap-1 mt-0.5 text-[8px] font-mono">
                <span className="text-sky-400">{preview.hp}</span>
                <span className="text-slate-600">·</span>
                <span className="text-rose-400">{preview.atk}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold cursor-pointer hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!ready || isRegistering}
          className="flex-1 py-2.5 rounded-xl text-white text-xs font-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-1.5 border"
          style={{
            background: ready ? `linear-gradient(90deg, ${ACCENT}cc, ${ACCENT})` : '#1e293b',
            borderColor: `${ACCENT}66`,
          }}
        >
          {isRegistering ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          ) : (
            <><Check className="w-3.5 h-3.5" /> Confirm ({picked.length}/{ARENA_CONFIG.squadSize})</>
          )}
        </button>
      </div>
    </div>
  );
}

function LastBattleCard({
  result,
  onReplay,
}: {
  result: ArenaMatchResult;
  onReplay?: (res: ArenaMatchResult) => void;
}) {
  return (
    <div
      className="mt-3 rounded-2xl border p-3.5"
      style={{
        background: result.playerWon ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.07)',
        borderColor: result.playerWon ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-black uppercase tracking-wider"
          style={{ color: result.playerWon ? '#34d399' : '#fb7185' }}
        >
          {result.playerWon ? 'Victory' : 'Defeat'} · {result.score}
        </span>
        <div className="flex items-center gap-2">
          {onReplay && (
            <button
              onClick={() => {
                playTapSound();
                onReplay(result);
              }}
              className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
            >
              ▶ Replay battle
            </button>
          )}
          <span className="text-slate-400 text-[10px] font-mono truncate max-w-[120px]">
            vs {result.isBot ? '⬡ ' : ''}{result.opponentName}
          </span>
        </div>
      </div>

      {/* Duel-by-duel breakdown */}
      <div className="flex gap-1.5 mb-2.5">
        {result.duels.map((d) => (
          <div
            key={d.duel}
            className="flex-1 rounded-lg py-1.5 text-center text-[10px] font-mono font-bold border"
            style={{
              background: d.playerWon ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
              borderColor: d.playerWon ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)',
              color: d.playerWon ? '#34d399' : '#fb7185',
            }}
          >
            {d.playerWon ? 'WIN' : 'LOSS'}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="text-emerald-400">+{result.cubesEarned} 💠</span>
        <span style={{ color: result.mmrDelta >= 0 ? '#34d399' : '#fb7185' }}>
          {result.mmrDelta > 0 ? '+' : ''}{result.mmrDelta} MMR
        </span>
        <span className="text-slate-500 ml-auto">{result.mmrAfter} total</span>
      </div>
    </div>
  );
}

function LeaderboardList({ rows, myWallet }: { rows: LeaderboardRow[]; myWallet: string | null }) {
  const me = myWallet ? myWallet.toLowerCase() : null;
  const myIdx = me ? rows.findIndex((r) => r.wallet === me) : -1;

  if (rows.length === 0) {
    return (
      <div className="bg-[#080d24]/80 border border-white/8 rounded-2xl p-6 text-center">
        <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400 text-xs font-semibold">No ranked squads yet</p>
        <p className="text-slate-500 text-[10px] mt-1">
          Finish calibration to appear on the board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => {
        const isMe = me === r.wallet;
        return (
          <div
            key={r.wallet}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 border"
            style={{
              background: isMe ? `${ACCENT}14` : 'rgba(255,255,255,0.03)',
              borderColor: isMe ? `${ACCENT}55` : 'rgba(255,255,255,0.06)',
            }}
          >
            <span
              className="text-[11px] font-mono font-black w-7 text-center flex-shrink-0"
              style={{ color: i === 0 ? '#fbbf24' : i < 3 ? '#cbd5e1' : '#64748b' }}
            >
              {i === 0 ? '👑' : `#${i + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[11px] font-bold truncate">
                {r.playerName || 'Trainer'}
                {isMe && <span className="text-[9px] ml-1" style={{ color: ACCENT }}>you</span>}
              </div>
              <div className="text-slate-500 text-[9px] font-mono">{shortWallet(r.wallet)}</div>
            </div>
            <div className="text-[9px] font-mono text-slate-400 flex-shrink-0">
              <span className="text-emerald-400">{r.wins}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{r.losses}</span>
            </div>
            <span className="text-white text-[12px] font-mono font-black w-11 text-right flex-shrink-0">
              {r.mmr}
            </span>
          </div>
        );
      })}

      {me && myIdx < 0 && (
        <p className="text-slate-500 text-[10px] text-center mt-2 font-mono">
          You are not in the top 100 yet.
        </p>
      )}
    </div>
  );
}
