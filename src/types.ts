/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PersonalityType = 'happy' | 'sleepy' | 'lucky' | 'chaotic' | 'cosmic';

export interface Personality {
  name: string;
  emoji: string;
  bonus: string;
  glow: string;
  c1: string;
  c2: string;
  c3: string;
  blush: string;
}

export interface Zone {
  id: string;
  tier: number;
  icon: string;
  name: string;
  sub: string;
  cost: number;
  reward: [number, number];
  xp: number;
  unlockLv: number;
  dur: number; // in seconds
  color: string;
}

export interface Quest {
  id: 'exp' | 'cubes' | 'sends' | 'taps';
  color: string;
  icon: string;
  name: string;
  desc: string;
  target: number;
  cubes: number;
  xp: number;
}

/**
 * Все существующие ветки апгрейдов.
 * Добыча: speed / harvest / fortune / insight
 * Бой:  vigor / guard / ferocity — влияют на Power (ноды, в будущем арена)
 */
export type UpgradeBranchId =
  | 'speed'
  | 'harvest'   // отображается как Extraction; id не меняем — он в сохранениях
  | 'fortune'
  | 'insight'
  | 'vigor'
  | 'guard'
  | 'ferocity';

/**
 * Уровни веток (0–5). Частичный тип: у блоба есть только те ветки,
 * которые ему выпали при призыве (см. Blob.branches).
 */
export type BlobUpgrades = Partial<Record<UpgradeBranchId, number>>;

export type EvolutionStage = 0 | 1 | 2 | 3;
// 0 = Base (Lv.1–4), 1 = Glow (Lv.5–9), 2 = Crystal (Lv.10–19), 3 = Ascended (Lv.20)

export interface Blob {
  id: string;
  personality: PersonalityType;
  level: number;
  xp: number;
  upgrades: BlobUpgrades; // NEW FIELD
  /**
   * Набор из 3 веток, доступных именно этому блобу. Роллится сервером
   * при призыве. Старые блобы без поля считаются как классическая тройка
   * speed/harvest/fortune (см. DEFAULT_BRANCHES).
   */
  branches?: UpgradeBranchId[];
  // New fields:
  mood: BlobMood;
  trait: TraitId | null;
  isRadiant: boolean;
  totalExpeditions: number;
  totalCubesEarned: number;
  nodesHeld: string[];
}

export interface ActiveExpedition {
  blobId?: string; // fallback
  blobIds: string[];
  zoneId: string;
  name: string;
  reward: [number, number];
  xp: number;
  duration: number; // in seconds
  endTime: number; // timestamp
}

export interface GameState {
  playerName: string;
  cubes: number;
  energy: number;
  energyMax: number;
  lastEnergyTime: number;
  expeditionsToday: number;
  cubesCollectedToday: number;
  sendsToday: number;
  tapsToday?: number;
  questDone: {
    exp: boolean;
    cubes: boolean;
    sends: boolean;
    taps?: boolean;
  };
  questClaimed?: {
    exp: boolean;
    cubes: boolean;
    sends: boolean;
    taps?: boolean;
  };
  questsReset: number;
  blobs: Blob[];
  selectedId: string;
  expPickId: string; // fallback
  expPickIds?: string[];
  nextId: number;
  activeExpedition: ActiveExpedition | null;
  activeExpeditions?: ActiveExpedition[];
  lastUpdated?: number;
  rev?: number;
  verifiedTxHashes?: string[];
  blobCharms: number;
  lastExpeditionEvent: ExpeditionEvent | null;
  lastFusionTime: number;
  totalCubesAllTime: number;
  totalExpeditionsAllTime: number;
  hasOGBadge: boolean;
  ogBadgePurchasedAt: number | null;
  initialized: boolean;
  // Weekly Arena
  /** @deprecated одиночный боец от прошлой идеи арены. Не использовать — см. arenaSquadIds */
  arenaRegisteredBlobId?: string | null;
  /** Отряд для арены: ровно 3 id блобов, порядок = порядок слотов */
  arenaSquadIds?: string[];
  lastArenaProcessedWeek?: string | null;
  lastArenaRank?: number | null;
  lastArenaRewardClaimed?: boolean;
  /** Значки сезонов арены, полученные игроком */
  arenaBadges?: ArenaBadge[];
}

// ─── ARENA ────────────────────────────────────────────────

/** Награда за сезон: значок с номером сезона и достигнутым рангом */
export interface ArenaBadge {
  season: number;
  /** champion = 1 место, elite = 2-3, veteran = 4-10 */
  tier: 'champion' | 'elite' | 'veteran';
  rank: number;
  awardedAt: number;
}

/** Замороженные боевые характеристики блоба на момент регистрации отряда */
export interface ArenaFighter {
  blobId: string;
  personality: PersonalityType;
  level: number;
  hp: number;
  atk: number;
  initiative: number;
  critChance: number;
  doubleChance: number;
}

/** Снимок отряда в коллекции arena_squads */
export interface ArenaSquad {
  wallet: string;
  playerName: string;
  fighters: ArenaFighter[];
  mmr: number;
  wins: number;
  losses: number;
  season: number;
  /** Сколько боёв проведено сегодня (лимит ARENA_CONFIG.dailyMatches) */
  matchesUsedToday: number;
  /** Когда счётчик боёв сбросится — считает сервер */
  dailyResetAt: number;
  /** Матчей в калибровке: пока < calibrationMatches, рейтинг нестабилен */
  matchesPlayed: number;
  registeredAt: number;
}

/** Одна запись в логе боя — клиент только проигрывает её */
export interface ArenaLogEntry {
  /** Номер дуэли: 0, 1 или 2 */
  duel: number;
  /** true = бил игрок, false = бил соперник */
  byPlayer: boolean;
  damage: number;
  crit: boolean;
  double: boolean;
  /** HP после удара */
  hpLeftPlayer: number;
  hpLeftEnemy: number;
}

export interface ArenaDuelResult {
  duel: number;
  playerWon: boolean;
}

/** Результат матча, каким его отдаёт сервер */
export interface ArenaMatchResult {
  matchId: string;
  opponentName: string;
  opponentWallet: string | null;
  isBot: boolean;
  duels: ArenaDuelResult[];
  score: string;
  playerWon: boolean;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  cubesEarned: number;
  log: ArenaLogEntry[];
  playedAt: number;
  opponentFighters: ArenaFighter[];
}

// ─── MOOD SYSTEM ──────────────────────────────────────────

export type MoodLevel = 0 | 1 | 2 | 3;
// 0 = 😢 Sad      (-20% power, refuses to attack)
// 1 = 😴 Tired    (-10% power)
// 2 = 😐 Neutral  (no changes)
// 3 = 😊 Happy    (+15% power)

export interface BlobMood {
  level: MoodLevel;
  lastFed: number;       // timestamp of the last feeding
  winsToday: number;     // attack victories today
  lossesToday: number;   // attack defeats today
}

// ─── TRAITS (Fusion only) ─────────────────────────

export type TraitId =
  | 'quick_learner'   // +15% XP always
  | 'cube_magnet'     // +10% cubes always
  | 'night_owl'       // +25% in long expeditions (40+ min)
  | 'fortunes_child'  // Lucky bonus x2
  | 'berserker'       // Chaotic jackpot: 40% instead of 30%
  | 'ancient';        // +5% to each upgrade

export interface Trait {
  id: TraitId;
  name: string;
  description: string;
  icon: string;
}

// ─── NETWORK MAP ──────────────────────────────────────────

export type NodeTier = 1 | 2 | 3 | 4 | 5;
// 1 = Sector (🌱), 2 = Hub (🔮), 3 = Core (🌌), 4 = Genesis (⛓️), 5 = Base Core (👑)

export type NodeType = 'standard' | 'boost' | 'contested' | 'dark' | 'event';

export interface NetworkNode {
  id: string;              // unique id: "node_001"
  tier: NodeTier;
  type: NodeType;
  name: string;
  // Position on hexagonal grid
  col: number;
  row: number;
  // Owner
  owner: string | null;    // wallet address or null
  ownerName: string | null;
  blobId: string | null;
  blobPersonality: string | null;
  blobPower: number;       // cached power of the guarding blob
  // Economy
  cubesPerHour: number;
  capturedAt: number | null; // timestamp
  lastCollected: number | null;
  // Defense
  fortifyBonus: number;    // 0-50, +10% for every 24h of holding
  /**
   * Множитель защиты от ветки Guard блоба-защитника (1 = нет ветки).
   * Пишется сервером при захвате; старые ноды без поля считаются как 1.
   */
  guardMult?: number;
  // NPC
  isNPC: boolean;
  npcPower: number;        // NPC power if isNPC=true
  // Special properties
  boostType: 'xp' | 'fortune' | 'speed' | null; // for boost nodes
  isEventNode: boolean;    // gives $BLOB instead of cubes
}

// ─── FUSION ───────────────────────────────────────────────

export interface FusionResult {
  success: boolean;
  newLevel: number;
  newPersonality: string;
  trait: TraitId | null;   // null if unlucky with trait (50% chance)
  isRadiant: boolean;      // true if rare personality is rolled
  cubeCost: number;
}

// ─── EXPEDITION EVENTS ────────────────────────────────────

export type ExpeditionEventType =
  | 'normal'        // 40% — normal return
  | 'rich_vein'     // 25% — +50% cubes
  | 'data_storm'    // 15% — -30% cubes
  | 'blob_charm'    // 10% — receive Blob Charm item
  | 'awakening'     // 7%  — double XP
  | 'jackpot';      // 3%  — x3 cubes + bonus

export interface ExpeditionEvent {
  type: ExpeditionEventType;
  title: string;
  description: string;
  icon: string;
  cubeMultiplier: number;   // 1.0 = no changes, 1.5 = +50% etc.
  xpMultiplier: number;
  bonusItem: 'blob_charm' | null;
}

// ─── EXTENSION OF EXISTING INTERFACES ──────────────────

// Add to Blob:
export interface BlobExtended {
  mood: BlobMood;
  trait: TraitId | null;   // via Fusion only
  isRadiant: boolean;      // rare personality
  totalExpeditions: number; // for leaderboard
  totalCubesEarned: number; // for leaderboard
  nodesHeld: string[];     // IDs of nodes held by this blob
}

// Add to GameState:
export interface GameStateExtended {
  // Consumables inventory
  blobCharms: number;
  // Last expedition event (shown to player)
  lastExpeditionEvent: ExpeditionEvent | null;
  // Fusion cooldown
  lastFusionTime: number;
  // Total cubes earned of all time (for leaderboard)
  totalCubesAllTime: number;
  // Total expeditions of all time (for leaderboard)
  totalExpeditionsAllTime: number;
}
