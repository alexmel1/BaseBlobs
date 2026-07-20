import { useState, useEffect } from 'react';
import {
  collection, doc, setDoc,
  query, orderBy, limit, onSnapshot, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ArenaEntry {
  walletAddress: string;
  playerName: string;
  weeklyScore: number;
  weekKey: string; // format "2026-W29"
  updatedAt: number;
}

export interface ArenaReward {
  rank: number;
  blobReward: number; // $BLOB tokens (future)
  cubeReward: number;
  label: string;
}

// Current week key
export function getCurrentWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Remaining time until the end of the week
export function msUntilWeekEnd(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    0, 0, 0, 0
  ));
  return nextMonday.getTime() - now.getTime();
}

export const ARENA_REWARDS: ArenaReward[] = [
  { rank: 1,  cubeReward: 5000,  blobReward: 500,  label: '🥇 1st Place' },
  { rank: 2,  cubeReward: 3000,  blobReward: 300,  label: '🥈 2nd Place' },
  { rank: 3,  cubeReward: 2000,  blobReward: 200,  label: '🥉 3rd Place' },
  { rank: 4,  cubeReward: 1000,  blobReward: 100,  label: '4th Place' },
  { rank: 5,  cubeReward: 1000,  blobReward: 100,  label: '5th Place' },
  { rank: 6,  cubeReward: 500,   blobReward: 50,   label: '6th-10th' },
  { rank: 7,  cubeReward: 500,   blobReward: 50,   label: '6th-10th' },
  { rank: 8,  cubeReward: 500,   blobReward: 50,   label: '6th-10th' },
  { rank: 9,  cubeReward: 500,   blobReward: 50,   label: '6th-10th' },
  { rank: 10, cubeReward: 500,   blobReward: 50,   label: '6th-10th' },
];

export function useArena(
  walletAddress: string | null,
  currentScore: number,
  playerName: string,
) {
  const weekKey = getCurrentWeekKey();
  const [entries, setEntries] = useState<ArenaEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastWeekResults] = useState<ArenaEntry[]>([]);

  // Update your weekly score
  useEffect(() => {
    if (!walletAddress || walletAddress.length < 10) return;

    const ref = doc(db, 'arena', `${weekKey}_${walletAddress.toLowerCase()}`);
    setDoc(ref, {
      walletAddress,
      playerName: playerName || 'Trainer',
      weeklyScore: currentScore,
      weekKey,
      updatedAt: Date.now(),
    }, { merge: true }).catch(console.warn);
  }, [walletAddress, currentScore, playerName, weekKey]);

  // Subscribe to top-50 of current week
  useEffect(() => {
    const q = query(
      collection(db, 'arena'),
      where('weekKey', '==', weekKey),
      orderBy('weeklyScore', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => d.data() as ArenaEntry);
      setEntries(data);

      if (walletAddress) {
        const rank = data.findIndex(e =>
          e.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        setMyRank(rank >= 0 ? rank + 1 : null);
      }
      setIsLoading(false);
    }, err => {
      console.warn('Arena error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [walletAddress, weekKey]);

  const myEntry = entries.find(
    e => e.walletAddress.toLowerCase() === (walletAddress ?? '').toLowerCase()
  );

  return {
    entries,
    myRank,
    myEntry,
    isLoading,
    weekKey,
    msUntilEnd: msUntilWeekEnd(),
    rewards: ARENA_REWARDS,
    lastWeekResults,
  };
}
