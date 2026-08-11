/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Серверная логика арены. Дизайн — в ARENA.md, правила — в AGENTS.md §8-9.
 *
 * Главный инвариант: клиент присылает только НАМЕРЕНИЕ (состав отряда или
 * «проведи бой»). Соперника выбирает сервер, бой считает сервер, лог и
 * рейтинг генерируются здесь. Клиент не может прислать результат, счёт,
 * соперника или сид RNG.
 */

import { Firestore } from 'firebase-admin/firestore';
import { createDefaultSave, isValidFullState, repairSaveState } from './claim.js';
import {
  ARENA_CONFIG,
  buildArenaFighter,
  resolveArenaMatch,
  calcMmrDelta,
  arenaScoreLabel,
  arenaRewardFor,
  getBlobStats,
  PKEYS,
} from '../src/data.js';
import type {
  ArenaFighter,
  ArenaSquad,
  ArenaMatchResult,
  PersonalityType,
} from '../src/types.js';

const SQUADS = 'arena_squads';
const MATCHES = 'arena_matches';

/** Номер сезона от фиксированной точки: понедельник, 00:00 UTC. */
const SEASON_EPOCH = Date.UTC(2026, 0, 5); // 5 января 2026 — понедельник

// Сезоны временно заморожены на 1 — сезонных наград ещё нет.
// Когда будут готовы сезонные награды за топ, вернуть дату-based расчёт:
// новый SEASON_EPOCH = дата реального старта сезонов, и увеличить шаг
// (например SEASON_LENGTH_MS = 14 или 30 дней вместо недели).
export function currentSeason(_now: number): number {
  return 1;
}

/** Начало следующих UTC-суток — считает только сервер. */
function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/**
 * Отряд с уже применённым дневным сбросом и переходом сезона.
 * Ничего не пишет — только приводит прочитанные данные к «сейчас».
 */
function normalizeSquad(squad: any, now: number): ArenaSquad {
  const season = currentSeason(now);
  const s: ArenaSquad = {
    wallet: String(squad.wallet || ''),
    playerName: String(squad.playerName || 'Trainer'),
    fighters: Array.isArray(squad.fighters) ? squad.fighters : [],
    mmr: Number(squad.mmr ?? ARENA_CONFIG.startingMmr),
    wins: Number(squad.wins || 0),
    losses: Number(squad.losses || 0),
    season: Number(squad.season || season),
    matchesUsedToday: Number(squad.matchesUsedToday || 0),
    dailyResetAt: Number(squad.dailyResetAt || 0),
    matchesPlayed: Number(squad.matchesPlayed || 0),
    registeredAt: Number(squad.registeredAt || now),
  };

  // Сутки прошли — попытки обновились. Неизрасходованные не копятся.
  if (now >= s.dailyResetAt) {
    s.matchesUsedToday = 0;
    s.dailyResetAt = nextUtcMidnight(now);
  }

  // Новый сезон — мягкий сброс рейтинга, статистика с нуля
  if (s.season !== season) {
    s.mmr = Math.round(
      ARENA_CONFIG.startingMmr + (s.mmr - ARENA_CONFIG.startingMmr) * 0.5,
    );
    s.season = season;
    s.wins = 0;
    s.losses = 0;
    s.matchesPlayed = 0;
  }

  return s;
}

/**
 * Регистрация отряда. Снимок характеристик считается ИЗ САХРАНЕНИЯ в
 * Firestore, а не из тела запроса — иначе можно прислать блоба Lv.99.
 */
export async function arenaRegister(
  db: Firestore,
  syncId: string,
  walletAddress: string,
  blobIds: unknown,
) {
  if (!Array.isArray(blobIds) || blobIds.length !== ARENA_CONFIG.squadSize) {
    throw new Error(`Squad must contain exactly ${ARENA_CONFIG.squadSize} blobs`);
  }
  const ids = blobIds.map((v) => String(v));
  if (new Set(ids).size !== ids.length) {
    throw new Error('Squad blobs must be different');
  }

  const wallet = walletAddress.toLowerCase();
  const saveRef = db.collection('saves').doc(syncId);
  const squadRef = db.collection(SQUADS).doc(wallet);

  return db.runTransaction(async (tx) => {
    const saveSnap = await tx.get(saveRef);
    let state: Record<string, any>;
    if (!saveSnap.exists) {
      state = createDefaultSave();
      tx.set(saveRef, state);
    } else {
      const data = saveSnap.data()!;
      if (!isValidFullState(data)) {
        console.error(`[arenaRegister] Corrupt or incomplete save for syncId: ${syncId}. Repairing.`);
        state = repairSaveState(data);
        tx.set(saveRef, state, { merge: true });
      } else {
        state = data;
      }
    }

    const now = Date.now();
    if (state.lastUpdated && now - state.lastUpdated < 1000) {
      throw new Error('Too many requests, slow down');
    }

    const blobs: any[] = state.blobs || [];
    const fighters: ArenaFighter[] = [];
    for (const id of ids) {
      const blob = blobs.find((b: any) => b.id === id);
      // Блоб должен реально принадлежать этому сохранению
      if (!blob) throw new Error(`Blob ${id} not found in your collection`);
      fighters.push(buildArenaFighter(blob));
    }

    const existingSnap = await tx.get(squadRef);
    const base = existingSnap.exists
      ? normalizeSquad(existingSnap.data(), now)
      : null;

    const squad: ArenaSquad = {
      wallet,
      playerName: String(state.playerName || 'Trainer'),
      fighters,
      // Перерегистрация не сбрасывает рейтинг и калибровку: иначе можно
      // было бы фармить высокий K, переставляя блобов.
      mmr: base?.mmr ?? ARENA_CONFIG.startingMmr,
      wins: base?.wins ?? 0,
      losses: base?.losses ?? 0,
      season: currentSeason(now),
      matchesUsedToday: base?.matchesUsedToday ?? 0,
      dailyResetAt: base?.dailyResetAt ?? nextUtcMidnight(now),
      matchesPlayed: base?.matchesPlayed ?? 0,
      registeredAt: base?.registeredAt ?? now,
    };

    tx.set(squadRef, squad);
    tx.update(saveRef, {
      arenaSquadIds: ids,
      rev: (state.rev || 0) + 1,
      lastUpdated: now,
    });

    return { ...state, arenaSquadIds: ids, rev: (state.rev || 0) + 1, squad };
  });
}

/** Средний уровень отряда — по нему идёт подбор во время калибровки. */
function avgLevel(fighters: ArenaFighter[]): number {
  if (!fighters.length) return 1;
  return fighters.reduce((a, f) => a + f.level, 0) / fighters.length;
}

/**
 * Бот под уровень отряда игрока. Помечается в интерфейсе как ⬡ Rogue Node —
 * игрок всегда видит, что это не человек (ARENA.md §5).
 */
function makeBot(playerFighters: ArenaFighter[], seed: number) {
  const lvl = Math.max(1, Math.round(avgLevel(playerFighters)));
  const fighters: ArenaFighter[] = [];

  for (let i = 0; i < ARENA_CONFIG.squadSize; i++) {
    const personality = PKEYS[(seed + i) % PKEYS.length] as PersonalityType;
    const stats = getBlobStats(personality, lvl);
    // Держим бота чуть слабее среднего игрока того же уровня: он затычка
    // на случай пустого пула, а не источник страданий.
    const basePower = lvl * 10;
    fighters.push({
      blobId: `bot${i}`,
      personality,
      level: lvl,
      hp: Math.max(1, Math.round(basePower * ARENA_CONFIG.hpMult * 0.95)),
      atk: Math.max(1, Math.round(basePower * ARENA_CONFIG.atkMult * 0.95)),
      initiative: stats.speed,
      critChance: Math.min(0.4, stats.luck * 0.003),
      doubleChance: Math.min(0.35, stats.speed * 0.004),
    });
  }

  return {
    wallet: null as string | null,
    name: `Rogue Node #${100 + (seed % 900)}`,
    mmr: 0,
    fighters,
    isBot: true as const,
  };
}

/**
 * Подбор соперника. Выбирает СЕРВЕР — иначе игрок нашёл бы себе
 * самый слабый отряд в базе.
 */
async function pickOpponent(
  db: Firestore,
  me: ArenaSquad,
  now: number,
): Promise<{
  wallet: string | null;
  name: string;
  mmr: number;
  fighters: ArenaFighter[];
  isBot: boolean;
}> {
  const season = currentSeason(now);
  const isCalibrating = me.matchesPlayed < ARENA_CONFIG.calibrationMatches;

  // Пул читается целиком по сезону: коллекция маленькая, а составной
  // индекс под каждый вариант окна плодить не хочется.
  const snap = await db.collection(SQUADS).where('season', '==', season).get();

  const candidates = snap.docs
    .map((d) => normalizeSquad(d.data(), now))
    .filter((s) => s.wallet !== me.wallet && s.fighters.length === ARENA_CONFIG.squadSize);

  if (candidates.length > 0) {
    if (isCalibrating) {
      // Калибровка: подбор по среднему уровню отряда. Пока рейтинг пустой,
      // уровень — единственный честный ориентир (ARENA.md §4).
      const myLvl = avgLevel(me.fighters);
      const near = candidates.filter(
        (c) => Math.abs(avgLevel(c.fighters) - myLvl) <= ARENA_CONFIG.levelWindow,
      );
      const pool = near.length > 0 ? near : candidates;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { wallet: pick.wallet, name: pick.playerName, mmr: pick.mmr, fighters: pick.fighters, isBot: false };
    }

    for (
      let window = ARENA_CONFIG.mmrWindow;
      window <= ARENA_CONFIG.mmrWindowMax;
      window += ARENA_CONFIG.mmrWindowStep
    ) {
      const near = candidates.filter((c) => Math.abs(c.mmr - me.mmr) <= window);
      if (near.length > 0) {
        const pick = near[Math.floor(Math.random() * near.length)];
        return { wallet: pick.wallet, name: pick.playerName, mmr: pick.mmr, fighters: pick.fighters, isBot: false };
      }
    }
  }

  const bot = makeBot(me.fighters, Math.floor(Math.random() * 1000));
  return { ...bot, mmr: me.mmr };
}

/**
 * Один бой. Списание попытки, расчёт, запись результата и начисление кубов —
 * в ОДНОЙ транзакции: иначе клиент мог бы оборвать соединение при поражении
 * и переиграть бой.
 */
export async function arenaFight(
  db: Firestore,
  syncId: string,
  walletAddress: string,
): Promise<ArenaMatchResult & { state: any }> {
  const wallet = walletAddress.toLowerCase();
  const squadRef = db.collection(SQUADS).doc(wallet);
  const saveRef = db.collection('saves').doc(syncId);
  const now = Date.now();

  // Соперник читается до транзакции: Firestore не разрешает запросы
  // по коллекции внутри неё. На честность это не влияет — выбор всё
  // равно делает сервер, а результат фиксируется транзакцией.
  const squadPre = await squadRef.get();
  if (!squadPre.exists) throw new Error('Register a squad first');
  const opponent = await pickOpponent(db, normalizeSquad(squadPre.data(), now), now);

  return db.runTransaction(async (tx) => {
    const [squadSnap, saveSnap] = await Promise.all([tx.get(squadRef), tx.get(saveRef)]);
    if (!squadSnap.exists) throw new Error('Register a squad first');
    let state: Record<string, any>;
    if (!saveSnap.exists) {
      state = createDefaultSave();
      tx.set(saveRef, state);
    } else {
      const data = saveSnap.data()!;
      if (!isValidFullState(data)) {
        console.error(`[arenaFight] Corrupt or incomplete save for syncId: ${syncId}. Repairing.`);
        state = repairSaveState(data);
        tx.set(saveRef, state, { merge: true });
      } else {
        state = data;
      }
    }
    if (state.lastUpdated && now - state.lastUpdated < 1000) {
      throw new Error('Too many requests, slow down');
    }

    const squad = normalizeSquad(squadSnap.data(), now);
    if (squad.fighters.length !== ARENA_CONFIG.squadSize) {
      throw new Error('Register a squad first');
    }

    // Лимит проверяется здесь же, внутри транзакции: два параллельных
    // запроса не смогут выбить шестой бой.
    if (squad.matchesUsedToday >= ARENA_CONFIG.dailyMatches) {
      throw new Error('No battles left today');
    }

    const isCalibrating = squad.matchesPlayed < ARENA_CONFIG.calibrationMatches;

    const { duels, log, playerWins } = resolveArenaMatch(squad.fighters, opponent.fighters);
    const playerWon = playerWins >= 2;

    let delta = calcMmrDelta({
      playerMmr: squad.mmr,
      opponentMmr: opponent.mmr,
      playerWins,
      isCalibrating,
      isBot: opponent.isBot,
    });

    let mmrAfter = squad.mmr + delta;
    // Пол рейтинга действует только после калибровки — она обязана
    // иметь право опустить отряд ниже порога.
    if (!isCalibrating) mmrAfter = Math.max(ARENA_CONFIG.mmrFloor, mmrAfter);
    delta = mmrAfter - squad.mmr;

    const cubesEarned = arenaRewardFor(playerWins);
    const matchId = `${wallet}_${now}`;

    tx.update(squadRef, {
      mmr: mmrAfter,
      wins: squad.wins + (playerWon ? 1 : 0),
      losses: squad.losses + (playerWon ? 0 : 1),
      season: squad.season,
      matchesUsedToday: squad.matchesUsedToday + 1,
      dailyResetAt: squad.dailyResetAt,
      matchesPlayed: squad.matchesPlayed + 1,
    });

    tx.set(db.collection(MATCHES).doc(matchId), {
      matchId,
      season: squad.season,
      playerWallet: wallet,
      playerName: squad.playerName,
      opponentWallet: opponent.wallet,
      opponentName: opponent.name,
      isBot: opponent.isBot,
      score: arenaScoreLabel(playerWins),
      playerWon,
      mmrBefore: squad.mmr,
      mmrAfter,
      mmrDelta: delta,
      cubesEarned,
      duels,
      log,
      playerFighters: squad.fighters,
      opponentFighters: opponent.fighters,
      playedAt: now,
    });

    // Кубы начисляются в этой же транзакции, баланс читается из saves
    const newCubes = Number(state.cubes || 0) + cubesEarned;
    tx.update(saveRef, {
      cubes: newCubes,
      totalCubesAllTime: Number(state.totalCubesAllTime || 0) + cubesEarned,
      rev: (state.rev || 0) + 1,
      lastUpdated: now,
    });

    return {
      matchId,
      opponentName: opponent.name,
      opponentWallet: opponent.wallet,
      isBot: opponent.isBot,
      duels,
      score: arenaScoreLabel(playerWins),
      playerWon,
      mmrBefore: squad.mmr,
      mmrAfter,
      mmrDelta: delta,
      cubesEarned,
      log,
      playedAt: now,
      opponentFighters: opponent.fighters,
      state: {
        ...state,
        cubes: newCubes,
        totalCubesAllTime: Number(state.totalCubesAllTime || 0) + cubesEarned,
        rev: (state.rev || 0) + 1,
      },
    };
  });
}
