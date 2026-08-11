/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Personality, Zone, Quest, PersonalityType, BlobUpgrades, EvolutionStage,
  TraitId, Trait, ExpeditionEventType, ExpeditionEvent, BlobMood,
  NetworkNode, NodeTier, NodeType, Blob, UpgradeBranchId,
  ArenaFighter, ArenaLogEntry, ArenaDuelResult,
} from './types.js';

export const P: Record<PersonalityType, Personality> = {
  happy: {
    name: 'Happy',
    emoji: '😊',
    bonus: '+20% XP from all expeditions',
    glow: '#00aaff',
    c1: '#4dd8ff',
    c2: '#0066ee',
    c3: '#003acc',
    blush: 'rgba(255,120,180,0.7)',
  },
  sleepy: {
    name: 'Sleepy',
    emoji: '😴',
    bonus: 'Energy regens 30% faster',
    glow: '#aa44ff',
    c1: '#cc99ff',
    c2: '#7733dd',
    c3: '#4400aa',
    blush: 'rgba(200,150,255,0.6)',
  },
  lucky: {
    name: 'Lucky',
    emoji: '🍀',
    bonus: '+15% cube reward on all zones',
    glow: '#00ff88',
    c1: '#66ffaa',
    c2: '#00cc66',
    c3: '#008840',
    blush: 'rgba(100,255,150,0.5)',
  },
  chaotic: {
    name: 'Chaotic',
    emoji: '⚡',
    bonus: '30% chance for ×1.5 cube jackpot',
    glow: '#ff44aa',
    c1: '#ff88cc',
    c2: '#ee2288',
    c3: '#aa0055',
    blush: 'rgba(255,100,200,0.7)',
  },
  cosmic: {
    name: 'Cosmic',
    emoji: '🌌',
    bonus: '+25% all rewards at Lv.10+',
    glow: '#8844ff',
    c1: '#aa66ff',
    c2: '#6622dd',
    c3: '#330088',
    blush: 'rgba(180,100,255,0.5)',
  },
};

export const PKEYS = Object.keys(P) as PersonalityType[];

export const ZONES: Zone[] = [
  {
    id: 'fields',
    tier: 1,
    icon: '🌱',
    name: 'Genesis Fields',
    sub: 'Calm starter plains',
    cost: 10,
    reward: [20, 50],
    xp: 12,
    unlockLv: 1,
    dur: 3 * 60,
    color: '#0088ff',
  },
  {
    id: 'cave',
    tier: 2,
    icon: '💠',
    name: 'Stablecoin Shores',
    sub: 'Glowing crystal caverns',
    cost: 15,
    reward: [60, 110],
    xp: 25,
    unlockLv: 4,
    dur: 6 * 60,
    color: '#4400ff',
  },
  {
    id: 'forest',
    tier: 3,
    icon: '🌲',
    name: 'Mempool Thicket',
    sub: 'Digital neon wilderness',
    cost: 20,
    reward: [100, 170],
    xp: 42,
    unlockLv: 7,
    dur: 12 * 60,
    color: '#9900cc',
  },
  {
    id: 'volcano',
    tier: 4,
    icon: '🌋',
    name: 'Block Foundry',
    sub: 'Scorching magma circuits',
    cost: 25,
    reward: [170, 280],
    xp: 65,
    unlockLv: 11,
    dur: 20 * 60,
    color: '#cc3300',
  },
  {
    id: 'void',
    tier: 5,
    icon: '🌌',
    name: 'Terminal Block',
    sub: 'Glitch dimension, high risk',
    cost: 30,
    reward: [270, 430],
    xp: 95,
    unlockLv: 15,
    dur: 40 * 60,
    color: '#ff6600',
  },
  {
    id: 'chain',
    tier: 6,
    icon: '⛓️',
    name: 'Base Chain Core',
    sub: 'The heart of Base — legendary',
    cost: 35,
    reward: [400, 700],
    xp: 140,
    unlockLv: 19,
    dur: 90 * 60,
    color: '#ccaa00',
  },
];

export const QUEST_CFG: Quest[] = [
  {
    id: 'exp',
    color: '#0088ff',
    icon: '🗺️',
    name: 'Complete 1 expedition',
    desc: 'Finish any zone expedition',
    target: 1,
    cubes: 50,
    xp: 50,
  },
  {
    id: 'cubes',
    color: '#6600ff',
    icon: '💠',
    name: 'Collect 100 Cubes',
    desc: 'Earn cubes from expeditions',
    target: 100,
    cubes: 50,
    xp: 40,
  },
  {
    id: 'taps',
    color: '#38bdf8',
    icon: '👆',
    name: 'Tap your Blob 5 times',
    desc: 'Interact with your selected blob',
    target: 5,
    cubes: 25,
    xp: 25,
  },
];

export const XP4LV = (lv: number): number => lv * 60;
export const EREGEN = 5 * 60 * 1000;

export interface BlobStats {
  power: number;
  speed: number;
  luck: number;
}

export function getBlobStats(personality: PersonalityType, level: number): BlobStats {
  const base = {
    happy: { power: 12, speed: 12, luck: 10 },
    sleepy: { power: 16, speed: 6, luck: 12 },
    lucky: { power: 8, speed: 10, luck: 18 },
    chaotic: { power: 14, speed: 14, luck: 6 },
    cosmic: { power: 13, speed: 13, luck: 13 },
  }[personality] || { power: 10, speed: 10, luck: 10 };

  const mult = {
    happy: { power: 3.2, speed: 3.2, luck: 2.5 },
    sleepy: { power: 4.8, speed: 1.5, luck: 2.8 },
    lucky: { power: 2.0, speed: 2.8, luck: 5.2 },
    chaotic: { power: 4.5, speed: 4.5, luck: 1.5 },
    cosmic: { power: 4.0, speed: 4.0, luck: 4.0 },
  }[personality] || { power: 3, speed: 3, luck: 3 };

  const growth = level - 1;

  return {
    power: Math.floor(base.power + growth * mult.power),
    speed: Math.floor(base.speed + growth * mult.speed),
    luck: Math.floor(base.luck + growth * mult.luck),
  };
}

export interface UpgradeBranch {
  id: UpgradeBranchId;
  icon: string;
  name: string;
  desc: string;
  color: string;
  /** mining — влияет на экспедиции, combat — на Power (ноды, арена) */
  kind: 'mining' | 'combat';
  // For each level (index 0 = level 1):
  levels: {
    cost: number;       // cost in cubes
    unlockLv: number;   // required blob level
    effect: string;     // text description of the effect
    value: number;      // numeric value of the effect (multiplier or percentage)
  }[];
}

export const UPGRADES: UpgradeBranch[] = [
  {
    id: 'speed',
    icon: '⚡',
    name: 'Speed',
    desc: 'Reduces expedition time',
    color: '#2a78d6',
    kind: 'mining',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '-8% time',  value: 0.92 },
      { cost: 120,  unlockLv: 4,  effect: '-15% time', value: 0.85 },
      { cost: 280,  unlockLv: 7,  effect: '-22% time', value: 0.78 },
      { cost: 600,  unlockLv: 11, effect: '-32% time', value: 0.68 },
      { cost: 1200, unlockLv: 15, effect: '-45% time', value: 0.55 },
    ],
  },
  {
    // id остаётся 'harvest': он записан в сохранениях игроков,
    // переименование обнулило бы уже купленные уровни.
    id: 'harvest',
    icon: '⛏️',
    name: 'Extraction',
    desc: 'More cubes per expedition',
    color: '#1baf7a',
    kind: 'mining',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+10% cubes', value: 1.10 },
      { cost: 120,  unlockLv: 4,  effect: '+22% cubes', value: 1.22 },
      { cost: 280,  unlockLv: 7,  effect: '+38% cubes', value: 1.38 },
      { cost: 600,  unlockLv: 11, effect: '+55% cubes', value: 1.55 },
      { cost: 1200, unlockLv: 15, effect: '+75% cubes', value: 1.75 },
    ],
  },
  {
    id: 'fortune',
    icon: '🍀',
    name: 'Fortune',
    desc: 'Bonus event chance',
    color: '#eda100',
    kind: 'mining',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+3% bonus chance',  value: 0.03 },
      { cost: 120,  unlockLv: 4,  effect: '+8% bonus chance',  value: 0.08 },
      { cost: 280,  unlockLv: 7,  effect: '+13% bonus chance', value: 0.13 },
      { cost: 600,  unlockLv: 11, effect: '+20% bonus chance', value: 0.20 },
      { cost: 1200, unlockLv: 15, effect: '+30% bonus chance', value: 0.30 },
    ],
  },
  {
    id: 'insight',
    icon: '📚',
    name: 'Insight',
    desc: 'More XP per expedition',
    color: '#7c5cff',
    kind: 'mining',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+10% XP', value: 1.10 },
      { cost: 120,  unlockLv: 4,  effect: '+20% XP', value: 1.20 },
      { cost: 280,  unlockLv: 7,  effect: '+32% XP', value: 1.32 },
      { cost: 600,  unlockLv: 11, effect: '+48% XP', value: 1.48 },
      { cost: 1200, unlockLv: 15, effect: '+65% XP', value: 1.65 },
    ],
  },
  {
    id: 'vigor',
    icon: '💢',
    name: 'Vigor',
    desc: 'Raw Power for nodes & arena',
    color: '#e0457b',
    kind: 'combat',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+8% Power',  value: 1.08 },
      { cost: 120,  unlockLv: 4,  effect: '+16% Power', value: 1.16 },
      { cost: 280,  unlockLv: 7,  effect: '+26% Power', value: 1.26 },
      { cost: 600,  unlockLv: 11, effect: '+38% Power', value: 1.38 },
      { cost: 1200, unlockLv: 15, effect: '+52% Power', value: 1.52 },
    ],
  },
  {
    id: 'guard',
    icon: '🛡️',
    name: 'Guard',
    desc: 'Defends nodes you hold',
    color: '#3d9bd6',
    kind: 'combat',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+10% defense', value: 1.10 },
      { cost: 120,  unlockLv: 4,  effect: '+20% defense', value: 1.20 },
      { cost: 280,  unlockLv: 7,  effect: '+34% defense', value: 1.34 },
      { cost: 600,  unlockLv: 11, effect: '+50% defense', value: 1.50 },
      { cost: 1200, unlockLv: 15, effect: '+70% defense', value: 1.70 },
    ],
  },
  {
    id: 'ferocity',
    icon: '🔥',
    name: 'Ferocity',
    desc: 'Stronger when attacking',
    color: '#ff7a2f',
    kind: 'combat',
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+10% attack', value: 1.10 },
      { cost: 120,  unlockLv: 4,  effect: '+20% attack', value: 1.20 },
      { cost: 280,  unlockLv: 7,  effect: '+34% attack', value: 1.34 },
      { cost: 600,  unlockLv: 11, effect: '+50% attack', value: 1.50 },
      { cost: 1200, unlockLv: 15, effect: '+70% attack', value: 1.70 },
    ],
  },
];

/**
 * Ветки старых блобов, у которых поле branches ещё не заполнено.
 * Сохраняет уже вложенные кубы: у них остаётся классическая тройка.
 */
export const DEFAULT_BRANCHES: UpgradeBranchId[] = ['speed', 'harvest', 'fortune'];

/** Сколько веток выпадает новому блобу */
export const BRANCHES_PER_BLOB = 3;

/** Ветки блоба с обратной совместимостью: нет поля — классическая тройка. */
export function getBlobBranches(blob: { branches?: UpgradeBranchId[] } | null | undefined): UpgradeBranchId[] {
  const list = blob?.branches;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_BRANCHES;
  // Отфильтровываем мусор, чтобы битое сохранение не роняло экран апгрейдов
  const valid = list.filter((id) => UPGRADES.some((u) => u.id === id));
  return valid.length > 0 ? valid : DEFAULT_BRANCHES;
}

/**
 * Ролл набора веток для нового блоба: гарантированно хотя бы одна
 * добывающая и одна боевая, чтобы блоб не оказался бесполезен в одном
 * из режимов. Остальные добираются случайно из общего пула.
 */
export function rollBlobBranches(): UpgradeBranchId[] {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const mining = UPGRADES.filter((u) => u.kind === 'mining').map((u) => u.id);
  const combat = UPGRADES.filter((u) => u.kind === 'combat').map((u) => u.id);

  const chosen: UpgradeBranchId[] = [pick(mining), pick(combat)];

  const rest = UPGRADES
    .map((u) => u.id)
    .filter((id) => !chosen.includes(id));

  while (chosen.length < BRANCHES_PER_BLOB && rest.length > 0) {
    const idx = Math.floor(Math.random() * rest.length);
    chosen.push(rest[idx]);
    rest.splice(idx, 1);
  }

  // Держим порядок как в UPGRADES, чтобы UI не прыгал между рендерами
  return UPGRADES.map((u) => u.id).filter((id) => chosen.includes(id));
}

// Returns evolution stage by level
export function getEvolutionStage(level: number): EvolutionStage {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  if (level >= 5)  return 1;
  return 0;
}

// How many upgrade slots are available (branches that can be developed)
// Stage 0: 1 branch up to Lv.3, Stage 1: 2 branches up to Lv.3, Stage 2+: all 3 branches
export function getUpgradeSlots(level: number): number {
  if (level >= 10) return 3;
  if (level >= 5)  return 2;
  return 1;
}

// Check if upgrade can be purchased
export function canUpgrade(
  branchId: UpgradeBranchId,
  currentLevel: number, // current upgrade level (0 = not purchased)
  blobLevel: number,
  blobUpgrades: BlobUpgrades,
  cubes: number,
  evolutionStage: EvolutionStage,
  // Ветки конкретного блоба. По умолчанию классическая тройка —
  // это же значение получают старые блобы без поля branches.
  availableBranches: UpgradeBranchId[] = DEFAULT_BRANCHES
): { allowed: boolean; reason?: string } {
  // Блобу выпал свой набор веток: качать чужую нельзя.
  // Эта же проверка дублируется на сервере — она защитная, не косметическая.
  if (!availableBranches.includes(branchId))
    return { allowed: false, reason: 'This Blob has no such branch' };

  if (currentLevel >= 5) return { allowed: false, reason: 'Max level' };

  const branch = UPGRADES.find(u => u.id === branchId);
  if (!branch) return { allowed: false, reason: 'Unknown branch' };
  const nextLevel = branch.levels[currentLevel]; // next level to purchase
  if (!nextLevel) return { allowed: false, reason: 'Max level' };

  if (blobLevel < nextLevel.unlockLv)
    return { allowed: false, reason: `Need Blob Lv.${nextLevel.unlockLv}` };

  if (cubes < nextLevel.cost)
    return { allowed: false, reason: `Need ${nextLevel.cost} 💠` };

  // Slots check — on Stage 0 no more than 1 branch can be upgraded
  const slots = getUpgradeSlots(blobLevel);
  const activeBranches = availableBranches
    .filter(b => b !== branchId && (blobUpgrades[b] ?? 0) > 0).length;

  // If this branch is not yet started and active branches already equal slots
  if ((blobUpgrades[branchId] ?? 0) === 0 && activeBranches >= slots)
    return { allowed: false, reason: `Evolve to unlock more branches` };

  return { allowed: true };
}

/**
 * Значение эффекта ветки на её текущем уровне.
 * Ищет ветку по id, а не по индексу в UPGRADES — иначе добавление
 * новых веток молча ломало бы расчёт старых.
 */
export function getUpgradeValue(
  id: UpgradeBranchId,
  level: number | undefined,
  fallback: number
): number {
  const lvl = level ?? 0;
  if (lvl <= 0) return fallback;
  const branch = UPGRADES.find(u => u.id === id);
  if (!branch) return fallback;
  const entry = branch.levels[Math.min(lvl, branch.levels.length) - 1];
  return entry ? entry.value : fallback;
}

// Apply upgrades to the expedition result
export function applyUpgrades(
  baseReward: number,
  baseDuration: number,
  baseBonusChance: number,
  upgrades: BlobUpgrades
): { reward: number; duration: number; bonusChance: number; xpMult: number } {
  const harvestMult = getUpgradeValue('harvest', upgrades.harvest, 1);
  const speedMult = getUpgradeValue('speed', upgrades.speed, 1);
  const insightMult = getUpgradeValue('insight', upgrades.insight, 1);

  return {
    reward: Math.round(baseReward * harvestMult),
    duration: Math.round(baseDuration * speedMult),
    bonusChance: Math.min(0.95, baseBonusChance),
    xpMult: insightMult,
  };
}

export const EVOLUTION_NAMES = ['Base Blob', 'Glow Form', 'Crystal Form', 'Ascended Form'];
export const EVOLUTION_EMOJIS = ['🟦', '✨', '💎', '👑'];

// ─── TRAITS DATA ──────────────────────────────────────────

export const TRAITS: Record<TraitId, Trait> = {
  quick_learner: {
    id: 'quick_learner',
    name: 'Quick Learner',
    description: '+15% XP from all sources',
    icon: '📚',
  },
  cube_magnet: {
    id: 'cube_magnet',
    name: 'Cube Magnet',
    description: '+10% cubes from all expeditions',
    icon: '🧲',
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: '+25% rewards in long expeditions (40+ min)',
    icon: '🦉',
  },
  fortunes_child: {
    id: 'fortunes_child',
    name: "Fortune's Child",
    description: 'Lucky personality bonus ×2',
    icon: '🌟',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    description: 'Chaotic jackpot chance: 40% instead of 30%',
    icon: '🔥',
  },
  ancient: {
    id: 'ancient',
    name: 'Ancient',
    description: '+5% to all upgrade effects',
    icon: '⚗️',
  },
};

export const TRAIT_KEYS = Object.keys(TRAITS) as TraitId[];

// ─── MOOD DATA ────────────────────────────────────────────

export const MOOD_CONFIG = {
  // Power multipliers based on mood level
  powerMultipliers: {
    0: 0.80,  // Sad
    1: 0.90,  // Tired
    2: 1.00,  // Neutral
    3: 1.15,  // Happy
  },
  // How many hours without feeding until mood drops
  decayHours: 12,
  // Cost of feeding in cubes based on blob level
  feedCost: (level: number) => Math.floor(level * 50),
  // Emoji per level
  emoji: { 0: '😢', 1: '😴', 2: '😐', 3: '😊' } as Record<number, string>,
  // Names
  names: { 0: 'Sad', 1: 'Tired', 2: 'Neutral', 3: 'Happy' } as Record<number, string>,
};

// ─── EXPEDITION EVENTS DATA ───────────────────────────────

export const EXPEDITION_EVENTS: Record<ExpeditionEventType, ExpeditionEvent> = {
  normal: {
    type: 'normal',
    title: 'Safe Return',
    description: 'Your blob returned safely.',
    icon: '✅',
    cubeMultiplier: 1.0,
    xpMultiplier: 1.0,
    bonusItem: null,
  },
  rich_vein: {
    type: 'rich_vein',
    title: 'Rich Data Vein!',
    description: 'Found a dense cluster of data cubes!',
    icon: '💎',
    cubeMultiplier: 1.5,
    xpMultiplier: 1.0,
    bonusItem: null,
  },
  data_storm: {
    type: 'data_storm',
    title: 'Data Storm',
    description: 'A glitch storm scattered some cubes — but your blob learned from the chaos.',
    icon: '🌩️',
    // Смягчено: было 0.7 кубов без компенсации, что ощущалось как чистое
    // наказание. Теперь это обмен — меньше кубов, зато больше опыта.
    cubeMultiplier: 0.85,
    xpMultiplier: 1.3,
    bonusItem: null,
  },
  blob_charm: {
    type: 'blob_charm',
    title: 'Mysterious Find!',
    description: 'Your blob found a Blob Charm — next expedition +100% cubes!',
    icon: '🎁',
    cubeMultiplier: 1.0,
    xpMultiplier: 1.0,
    bonusItem: 'blob_charm',
  },
  awakening: {
    type: 'awakening',
    title: 'Blob Awakening!',
    description: 'Your blob had a revelation — double XP!',
    icon: '🔮',
    cubeMultiplier: 1.0,
    xpMultiplier: 2.0,
    bonusItem: null,
  },
  jackpot: {
    type: 'jackpot',
    title: '⚡ JACKPOT!',
    description: 'Massive data surge — triple cubes and bonus rewards!',
    icon: '👑',
    cubeMultiplier: 3.0,
    xpMultiplier: 1.5,
    bonusItem: null,
  },
};

// Event chances (sum = 100)
export const EVENT_WEIGHTS: Record<ExpeditionEventType, number> = {
  normal:     40,
  rich_vein:  25,
  data_storm: 12,
  blob_charm: 11,
  awakening:   8,
  jackpot:     4,
};

// ─── NETWORK MAP CONFIG ───────────────────────────────────

export const NODE_CONFIG = {
  // Cubes per hour by tier
  cubesPerHour: { 1: 10, 2: 25, 3: 60, 4: 150, 5: 500 } as Record<number, number>,
  // Required blob level for attacking
  minBlobLevel: { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 } as Record<number, number>,
  // Tier colors
  tierColors: {
    1: '#0088ff',
    2: '#6600ff',
    3: '#9900cc',
    4: '#cc3300',
    5: '#ccaa00',
  } as Record<number, string>,
  // Tier icons
  tierIcons: {
    1: '🌱', 2: '🔮', 3: '🌌', 4: '⛓️', 5: '👑',
  } as Record<number, string>,
  // Max nodes per wallet = number of blobs x 2
  maxNodesPerBlob: 2,
  // Accumulation up to 24 hours
  maxAccumulationHours: 24,
  // Cooldown after defeat (minutes)
  defeatCooldownHours: 0.05, // 3 seconds / 30 seconds
  // Cooldown after capture (minutes)
  captureCooldownMinutes: 1,
  // Fortify bonus per 24h of holding
  fortifyBonusPerDay: 10,
  // Max fortify bonus
  maxFortifyBonus: 50,
};

// ─── DEFAULT VALUES for new fields ──────────────────────

export const DEFAULT_BLOB_MOOD: BlobMood = {
  level: 2,         // Neutral by default
  lastFed: Date.now(),
  winsToday: 0,
  lossesToday: 0,
};

export const DEFAULT_NEW_BLOB_FIELDS = {
  mood: DEFAULT_BLOB_MOOD,
  trait: null,
  isRadiant: false,
  totalExpeditions: 0,
  totalCubesEarned: 0,
  nodesHeld: [],
};

export const DEFAULT_GAMESTATE_NEW_FIELDS = {
  blobCharms: 0,
  lastExpeditionEvent: null,
  lastFusionTime: 0,
  totalCubesAllTime: 0,
  totalExpeditionsAllTime: 0,
  arenaRegisteredBlobId: null,
  arenaSquadIds: [],
  arenaBadges: [],
  lastArenaProcessedWeek: null,
  lastArenaRank: null,
  lastArenaRewardClaimed: false,
  hasSeenWelcome: false,
};

// ─── LEVEL LORE MILESTONES ────────────────────────────────
export const LEVEL_LORE: Record<number, { level: number; title: string; text: string }> = {
  3: {
    level: 3,
    title: 'First Signal',
    text: "Your Blob twitches. For a split second, its eyes flicker with a pattern that isn't quite random — like it's listening to something deep in the network. \"...still just static,\" you tell yourself. Probably.",
  },
  5: {
    level: 5,
    title: 'Glow Awakens',
    text: "A thin ring of light begins circling your Blob — steady, deliberate, like a heartbeat made visible. Explorers call this the first real sign that a Blob has started absorbing more than raw energy. It's absorbing pattern.",
  },
  8: {
    level: 8,
    title: 'Deeper Current',
    text: "Your Blob has been quiet lately — not sluggish, just... focused. Sometimes at night it drifts toward the edge of its enclosure, facing the same direction, like something out there is calling it home. Or calling it back.",
  },
  10: {
    level: 10,
    title: 'Crystal Threshold',
    text: "Crystalline particles now orbit your Blob, never quite touching it. Nobody's figured out what they're made of — some say compressed data, others say something stranger. Whatever they are, your Blob wears them like it's earned them.",
  },
  20: {
    level: 20,
    title: 'Ascended',
    text: "The glow turns gold. For a moment, your Blob doesn't look like a Blob at all — it looks like it's remembering something. Something from before the network, before the chain, before any of this had a name. Whatever it is, it's fully awake now. And it's not going back to sleep.",
  },
};

// ─── COMBAT & NODE POWER FORMULAS ────────────────────────


export function calcBlobPower(blob: Blob): number {
  const moodMultipliers = [0.8, 0.9, 1.0, 1.15];
  const moodMult = moodMultipliers[blob.mood?.level ?? 2];

  const basePower =
    blob.level * 10 +
    (blob.upgrades?.speed   ?? 0) * 8 +
    (blob.upgrades?.harvest ?? 0) * 5 +
    (blob.upgrades?.fortune ?? 0) * 6 +
    (blob.upgrades?.insight ?? 0) * 5;

  // Vigor — единственная ветка, дающая Power множителем: это делает
  // «боевого» блоба заметно сильнее в захвате нод и будущей арене.
  const vigorMult = getUpgradeValue('vigor', blob.upgrades?.vigor, 1);

  // Trait bonus
  let traitMult = 1;
  if (blob.trait === 'ancient') traitMult = 1.05;
  if (blob.trait === 'berserker') traitMult = 1.08;

  return Math.round(basePower * moodMult * traitMult * vigorMult);
}

/** Сила блоба в роли атакующего (Power × Ferocity). */
export function calcAttackPower(blob: Blob): number {
  return Math.round(calcBlobPower(blob) * getUpgradeValue('ferocity', blob.upgrades?.ferocity, 1));
}

/** Сила блоба в роли защитника ноды (Power × Guard). */
export function calcDefensePower(blob: Blob): number {
  return Math.round(calcBlobPower(blob) * getUpgradeValue('guard', blob.upgrades?.guard, 1));
}

/**
 * Клиентский прогноз исхода атаки. Должен считать защиту так же, как
 * сервер в api/claim.ts (fortifyBonus × guardMult), иначе UI будет
 * обещать победу там, где сервер её не даст.
 * Авторитет всё равно за сервером — это только подсказка в интерфейсе.
 */
export function canAttackNode(
  blobPower: number,
  node: NetworkNode,
): boolean {
  if (!node.owner && !node.isNPC) return true; // empty node
  const defenderPower = node.isNPC ? node.npcPower : node.blobPower;
  const effectiveDefense =
    defenderPower * (1 + (node.fortifyBonus || 0) / 100) * (node.guardMult || 1);
  return blobPower > effectiveDefense * 0.8;
}

// ─── ARENA ────────────────────────────────────────────────
// Полный дизайн — в ARENA.md. Бой считает ТОЛЬКО сервер (api/claim.ts);
// эти функции живут здесь, чтобы клиент мог показывать те же числа в UI.

export const ARENA_CONFIG = {
  /** Ровно столько блобов в отряде */
  squadSize: 3,
  /** Боёв в сутки; не накапливаются */
  dailyMatches: 5,
  /** Первые N матчей — калибровка: высокий K и подбор по уровню */
  calibrationMatches: 5,
  startingMmr: 1000,
  /** Пол рейтинга после калибровки */
  mmrFloor: 800,
  kBase: 24,
  kCalibration: 60,
  /** Разгром весит больше, чем победа 2:1 */
  kSweep: 28,
  kNarrow: 20,
  /** Победа над ботом даёт половину прироста, поражение не отнимает ничего */
  botMmrFactor: 0.5,
  /** Окно подбора по MMR и шаг расширения, если никого нет */
  mmrWindow: 100,
  mmrWindowStep: 150,
  mmrWindowMax: 400,
  /** Окно подбора по среднему уровню отряда во время калибровки */
  levelWindow: 3,
  /** Жёсткий предел ударов в дуэли: два танка с Guard 5 иначе зациклятся */
  maxTurnsPerDuel: 20,
  hpMult: 3,
  atkMult: 0.4,
  critMult: 1.6,
  /** Кубы за матч по счёту */
  rewards: {
    '3:0': 100,
    '2:1': 50,
    '1:2': 25,
    '0:3': 0,
  } as Record<string, number>,
} as const;

/**
 * Замораживает боевые характеристики блоба.
 *
 * Настроение (mood) здесь намеренно не участвует: кормление в игре не
 * реализовано и вводить его не планируется (см. ARENA.md §13).
 */
export function buildArenaFighter(blob: Blob): ArenaFighter {
  const stats = getBlobStats(blob.personality, blob.level);
  return {
    blobId: blob.id,
    personality: blob.personality,
    level: blob.level,
    hp: Math.max(1, Math.round(calcDefensePower(blob) * ARENA_CONFIG.hpMult)),
    atk: Math.max(1, Math.round(calcAttackPower(blob) * ARENA_CONFIG.atkMult)),
    initiative: stats.speed,
    critChance: Math.min(0.40, stats.luck * 0.003),
    doubleChance: Math.min(0.35, stats.speed * 0.004),
  };
}

/**
 * Одна дуэль. `rng` передаётся снаружи, чтобы сервер мог считать бой
 * детерминированно и сохранить лог — клиент лог только проигрывает.
 */
function resolveDuel(
  duel: number,
  player: ArenaFighter,
  enemy: ArenaFighter,
  rng: () => number,
  log: ArenaLogEntry[],
): boolean {
  let hpPlayer = player.hp;
  let hpEnemy = enemy.hp;

  // Инициатива решает, кто бьёт первым; при равенстве — игрок
  let playerTurn = player.initiative >= enemy.initiative;

  for (let turn = 0; turn < ARENA_CONFIG.maxTurnsPerDuel; turn++) {
    const attacker = playerTurn ? player : enemy;
    const crit = rng() < attacker.critChance;
    const double = rng() < attacker.doubleChance;

    const swings = double ? 2 : 1;
    let damage = 0;
    for (let s = 0; s < swings; s++) {
      const variance = 0.85 + rng() * 0.30;
      damage += attacker.atk * variance * (crit ? ARENA_CONFIG.critMult : 1);
    }
    damage = Math.max(1, Math.round(damage));

    if (playerTurn) {
      hpEnemy = Math.max(0, hpEnemy - damage);
    } else {
      hpPlayer = Math.max(0, hpPlayer - damage);
    }

    log.push({
      duel,
      byPlayer: playerTurn,
      damage,
      crit,
      double,
      hpLeftPlayer: hpPlayer,
      hpLeftEnemy: hpEnemy,
    });

    if (hpPlayer <= 0 || hpEnemy <= 0) break;
    playerTurn = !playerTurn;
  }

  // Кап по ударам: побеждает тот, у кого больше осталось в процентах
  if (hpPlayer > 0 && hpEnemy > 0) {
    return hpPlayer / player.hp >= hpEnemy / enemy.hp;
  }
  return hpEnemy <= 0;
}

/** Матч = три дуэли по слотам. Возвращает исходы и полный лог. */
export function resolveArenaMatch(
  playerSquad: ArenaFighter[],
  enemySquad: ArenaFighter[],
  rng: () => number = Math.random,
): { duels: ArenaDuelResult[]; log: ArenaLogEntry[]; playerWins: number } {
  const duels: ArenaDuelResult[] = [];
  const log: ArenaLogEntry[] = [];
  let playerWins = 0;

  for (let i = 0; i < ARENA_CONFIG.squadSize; i++) {
    const p = playerSquad[i];
    const e = enemySquad[i];
    if (!p || !e) continue;
    const won = resolveDuel(i, p, e, rng, log);
    if (won) playerWins++;
    duels.push({ duel: i, playerWon: won });
  }

  return { duels, log, playerWins };
}

/** Elo с поправками на разгром, калибровку и бота. */
export function calcMmrDelta(opts: {
  playerMmr: number;
  opponentMmr: number;
  playerWins: number;
  isCalibrating: boolean;
  isBot: boolean;
}): number {
  const { playerMmr, opponentMmr, playerWins, isCalibrating, isBot } = opts;
  const won = playerWins >= 2;

  // Поражение боту не отнимает рейтинг — бот появляется не по вине игрока
  if (isBot && !won) return 0;

  const expected = 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
  const actual = won ? 1 : 0;

  let k = isCalibrating
    ? ARENA_CONFIG.kCalibration
    : playerWins === 3 || playerWins === 0
    ? ARENA_CONFIG.kSweep
    : ARENA_CONFIG.kNarrow;

  if (isBot) k *= ARENA_CONFIG.botMmrFactor;

  return Math.round(k * (actual - expected));
}

export function arenaScoreLabel(playerWins: number): string {
  return `${playerWins}:${ARENA_CONFIG.squadSize - playerWins}`;
}

export function arenaRewardFor(playerWins: number): number {
  return ARENA_CONFIG.rewards[arenaScoreLabel(playerWins)] ?? 0;
}
