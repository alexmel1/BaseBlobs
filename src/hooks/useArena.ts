/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Клиентская часть арены. Дизайн — в ARENA.md.
 *
 * Хук НИЧЕГО не считает: бой, рейтинг, соперника и награду определяет сервер
 * (api/arena.ts). Здесь только чтение состояния из Firestore и два намерения —
 * зарегистрировать отряд и провести бой.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchWithSession } from '../lib/wallet';
import { ARENA_CONFIG } from '../data';
import type { ArenaSquad, ArenaMatchResult, GameState } from '../types';

/** Тот же расчёт сезона, что на сервере (api/arena.ts) — только для отображения. */
const SEASON_EPOCH = Date.UTC(2026, 0, 5);
const WEEK_MS = 7 * 86400_000;

export function currentSeason(now: number): number {
  return Math.max(1, Math.floor((now - SEASON_EPOCH) / WEEK_MS) + 1);
}

export function seasonEndsAt(now: number): number {
  return SEASON_EPOCH + currentSeason(now) * WEEK_MS;
}

export interface ArenaMatchRecord {
  matchId: string;
  opponentName: string;
  isBot: boolean;
  score: string;
  playerWon: boolean;
  mmrDelta: number;
  cubesEarned: number;
  playedAt: number;
}

export interface LeaderboardRow {
  wallet: string;
  playerName: string;
  mmr: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

interface UseArenaOpts {
  walletAddress: string | null;
  syncId: string | null;
  /** Применить обновлённый стейт с сервера (кубы начисляет он же) */
  onServerState?: (state: GameState) => void;
}

export function useArena({ walletAddress, syncId, onServerState }: UseArenaOpts) {
  const [squad, setSquad] = useState<ArenaSquad | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<ArenaMatchRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [isFighting, setIsFighting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ArenaMatchResult | null>(null);

  const addr = walletAddress ? walletAddress.toLowerCase() : null;
  const onServerStateRef = useRef(onServerState);
  onServerStateRef.current = onServerState;

  // ── Свой отряд: живая подписка ──
  useEffect(() => {
    if (!addr) {
      setSquad(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = onSnapshot(
      doc(db, 'arena_squads', addr),
      (snap) => {
        setSquad(snap.exists() ? (snap.data() as ArenaSquad) : null);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Arena squad subscription failed:', err);
        setError(`Arena subscription error: ${err.message || String(err)}`);
        setIsLoading(false);
      },
    );
    return unsub;
  }, [addr]);

  // ── Лента своих матчей ──
  const refreshMatches = useCallback(async () => {
    if (!addr) {
      setMatches([]);
      return;
    }
    try {
      const q = query(
        collection(db, 'arena_matches'),
        where('playerWallet', '==', addr),
        orderBy('playedAt', 'desc'),
        limit(10),
      );
      const snap = await getDocs(q);
      setMatches(snap.docs.map((d) => d.data() as ArenaMatchRecord));
    } catch (err) {
      // Индекс может быть ещё не создан — не роняем экран из-за ленты
      console.warn('Arena matches fetch failed:', err);
    }
  }, [addr]);

  useEffect(() => {
    refreshMatches();
  }, [refreshMatches]);

  // ── Лидерборд ──
  const refreshLeaderboard = useCallback(async () => {
    try {
      const season = currentSeason(Date.now());
      const q = query(
        collection(db, 'arena_squads'),
        where('season', '==', season),
        orderBy('mmr', 'desc'),
        limit(100),
      );
      const snap = await getDocs(q);
      setLeaderboard(
        snap.docs
          .map((d) => d.data() as LeaderboardRow & { matchesPlayed?: number })
          // Отряды в калибровке не показываем: рейтинг ещё не устоялся
          .filter((r) => (r.matchesPlayed ?? 0) >= ARENA_CONFIG.calibrationMatches)
          .map((r) => ({
            wallet: r.wallet,
            playerName: r.playerName,
            mmr: r.mmr,
            wins: r.wins,
            losses: r.losses,
            matchesPlayed: r.matchesPlayed ?? 0,
          })),
      );
    } catch (err) {
      console.warn('Arena leaderboard fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // ── Регистрация отряда ──
  const registerSquad = useCallback(
    async (blobIds: string[]): Promise<boolean> => {
      if (!addr || !syncId) {
        setError('Connect your wallet first');
        return false;
      }
      if (blobIds.length !== ARENA_CONFIG.squadSize) {
        setError(`Pick exactly ${ARENA_CONFIG.squadSize} blobs`);
        return false;
      }

      setIsRegistering(true);
      setError(null);
      try {
        const res = await fetchWithSession('/api/claim', {
          type: 'arena_register',
          syncId,
          walletAddress: addr,
          blobIds,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error(data?.error || 'Failed to register squad');
        }
        if (data.squad) {
          setSquad(data.squad);
        }
        if (onServerStateRef.current) onServerStateRef.current(data);
        return true;
      } catch (err: any) {
        setError(err?.message || 'Failed to register squad');
        return false;
      } finally {
        setIsRegistering(false);
      }
    },
    [addr, syncId],
  );

  // ── Бой ──
  const fight = useCallback(async (): Promise<ArenaMatchResult | null> => {
    if (!addr || !syncId) {
      setError('Connect your wallet first');
      return null;
    }
    setIsFighting(true);
    setError(null);
    try {
      const res = await fetchWithSession('/api/claim', {
        type: 'arena_fight',
        syncId,
        walletAddress: addr,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Battle failed');
      }

      setLastResult(data as ArenaMatchResult);
      // Кубы уже начислены сервером — забираем готовый стейт
      if (data.state && onServerStateRef.current) onServerStateRef.current(data.state);
      refreshMatches();
      refreshLeaderboard();
      return data as ArenaMatchResult;
    } catch (err: any) {
      setError(err?.message || 'Battle failed');
      return null;
    } finally {
      setIsFighting(false);
    }
  }, [addr, syncId, refreshMatches, refreshLeaderboard]);

  // ── Производные значения для UI ──
  const now = Date.now();
  const season = currentSeason(now);
  const isRegistered = !!squad && squad.fighters?.length === ARENA_CONFIG.squadSize;

  // Сутки могли пройти с момента чтения документа — считаем как сервер
  const dayElapsed = squad ? now >= (squad.dailyResetAt || 0) : false;
  const matchesUsedToday = !squad || dayElapsed ? 0 : squad.matchesUsedToday || 0;
  const battlesLeft = Math.max(0, ARENA_CONFIG.dailyMatches - matchesUsedToday);

  const matchesPlayed = squad?.matchesPlayed ?? 0;
  const isCalibrating = isRegistered && matchesPlayed < ARENA_CONFIG.calibrationMatches;

  const myRank = (() => {
    if (!addr || isCalibrating) return null;
    const idx = leaderboard.findIndex((r) => r.wallet === addr);
    return idx >= 0 ? idx + 1 : null;
  })();

  return {
    squad,
    isLoading,
    isRegistered,
    isCalibrating,
    matchesPlayed,
    battlesLeft,
    dailyResetAt: squad?.dailyResetAt ?? 0,
    season,
    seasonEndsAt: seasonEndsAt(now),
    matches,
    leaderboard,
    myRank,
    isFighting,
    isRegistering,
    error,
    lastResult,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
    registerSquad,
    fight,
    refreshLeaderboard,
  };
}
