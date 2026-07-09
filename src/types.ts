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

export interface BlobUpgrades {
  speed: number;   // 0–5
  harvest: number; // 0–5
  fortune: number; // 0–5
}

export type EvolutionStage = 0 | 1 | 2 | 3;
// 0 = Base (Lv.1–4), 1 = Glow (Lv.5–9), 2 = Crystal (Lv.10–19), 3 = Ascended (Lv.20)

export interface Blob {
  id: string;
  personality: PersonalityType;
  level: number;
  xp: number;
  upgrades: BlobUpgrades; // НОВОЕ ПОЛЕ
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
  verifiedTxHashes?: string[];
}
