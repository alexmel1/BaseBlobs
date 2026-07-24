/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Personality, Zone, Quest, PersonalityType, BlobUpgrades, EvolutionStage,
  TraitId, Trait, ExpeditionEventType, ExpeditionEvent, BlobMood,
  NetworkNode, NodeTier, NodeType,
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
    name: 'Base Fields',
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
    name: 'Cube Cave',
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
    name: 'Signal Forest',
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
    name: 'Neon Volcano',
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
    name: 'Void Network',
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
  id: 'speed' | 'harvest' | 'fortune';
  icon: string;
  name: string;
  desc: string;
  color: string;
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
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '-8% time',  value: 0.92 },
      { cost: 120,  unlockLv: 4,  effect: '-15% time', value: 0.85 },
      { cost: 280,  unlockLv: 7,  effect: '-22% time', value: 0.78 },
      { cost: 600,  unlockLv: 11, effect: '-32% time', value: 0.68 },
      { cost: 1200, unlockLv: 15, effect: '-45% time', value: 0.55 },
    ],
  },
  {
    id: 'harvest',
    icon: '💰',
    name: 'Harvest',
    desc: 'More cubes per expedition',
    color: '#1baf7a',
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
    levels: [
      { cost: 50,   unlockLv: 1,  effect: '+5% bonus chance',  value: 0.05 },
      { cost: 120,  unlockLv: 4,  effect: '+12% bonus chance', value: 0.12 },
      { cost: 280,  unlockLv: 7,  effect: '+20% bonus chance', value: 0.20 },
      { cost: 600,  unlockLv: 11, effect: '+30% bonus chance', value: 0.30 },
      { cost: 1200, unlockLv: 15, effect: '+45% bonus chance', value: 0.45 },
    ],
  },
];

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
  branchId: 'speed' | 'harvest' | 'fortune',
  currentLevel: number, // current upgrade level (0 = not purchased)
  blobLevel: number,
  blobUpgrades: BlobUpgrades,
  cubes: number,
  evolutionStage: EvolutionStage
): { allowed: boolean; reason?: string } {
  if (currentLevel >= 5) return { allowed: false, reason: 'Max level' };

  const branch = UPGRADES.find(u => u.id === branchId)!;
  const nextLevel = branch.levels[currentLevel]; // next level to purchase

  if (blobLevel < nextLevel.unlockLv)
    return { allowed: false, reason: `Need Blob Lv.${nextLevel.unlockLv}` };

  if (cubes < nextLevel.cost)
    return { allowed: false, reason: `Need ${nextLevel.cost} 💠` };

  // Slots check — on Stage 0 no more than 1 branch can be upgraded
  const slots = getUpgradeSlots(blobLevel);
  const activeBranches = (['speed', 'harvest', 'fortune'] as const)
    .filter(b => b !== branchId && blobUpgrades[b] > 0).length;

  // If this branch is not yet started and active branches already equal slots
  if (blobUpgrades[branchId] === 0 && activeBranches >= slots)
    return { allowed: false, reason: `Evolve to unlock more branches` };

  return { allowed: true };
}

// Apply upgrades to the expedition result
export function applyUpgrades(
  baseReward: number,
  baseDuration: number,
  baseBonusChance: number,
  upgrades: BlobUpgrades
): { reward: number; duration: number; bonusChance: number } {
  const harvestMult = upgrades.harvest > 0
    ? UPGRADES[1].levels[upgrades.harvest - 1].value : 1;
  const speedMult = upgrades.speed > 0
    ? UPGRADES[0].levels[upgrades.speed - 1].value : 1;
  const fortuneBonus = upgrades.fortune > 0
    ? UPGRADES[2].levels[upgrades.fortune - 1].value : 0;

  return {
    reward: Math.round(baseReward * harvestMult),
    duration: Math.round(baseDuration * speedMult),
    bonusChance: Math.min(0.95, baseBonusChance + fortuneBonus),
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
    description: 'A glitch storm scattered some cubes.',
    icon: '🌩️',
    cubeMultiplier: 0.7,
    xpMultiplier: 1.0,
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
  data_storm: 15,
  blob_charm: 10,
  awakening:   7,
  jackpot:     3,
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

// ─── FUSION CONFIG ────────────────────────────────────────

export const FUSION_CONFIG = {
  // Cost = (Lv.A + Lv.B) x 500
  costPerLevel: 500,
  // Chance to obtain a trait (50%)
  traitChance: 0.5,
  // Chance for a rare Radiant personality when fusing two identical personalities (15%)
  radiantChance: 0.15,
  // Cooldown between fusions (hours)
  cooldownHours: 24,
  // New level = Highest + floor(Lowest / 3)
  calcNewLevel: (lvA: number, lvB: number): number => {
    const high = Math.max(lvA, lvB);
    const low = Math.min(lvA, lvB);
    return Math.min(20, high + Math.floor(low / 3));
  },
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
  lastArenaProcessedWeek: null,
  lastArenaRank: null,
  lastArenaRewardClaimed: false,
};
