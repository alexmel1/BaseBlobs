import { useState, useEffect } from 'react';
import {
  collection, doc, setDoc,
  query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Blob } from '../types';

export interface LeaderboardEntry {
  walletAddress: string;
  playerName: string;
  score: number;
  totalLevel: number;
  totalExpeditions: number;
  topBlobLevel: number;
  updatedAt: number;
}

// Score formula
export function calcScore(blobs: Blob[], totalExpeditionsAllTime: number): number {
  const sumLevels = blobs.reduce((s, b) => s + b.level, 0);
  const sumUpgrades = blobs.reduce((s, b) =>
    s + b.upgrades.speed + b.upgrades.harvest + b.upgrades.fortune, 0);
  const evolutions = blobs.filter(b => b.level >= 5).length;

  return (sumLevels * 10)
    + (sumUpgrades * 25)
    + (evolutions * 50)
    + (totalExpeditionsAllTime * 2);
}

export function useLeaderboard(
  walletAddress: string | null,
  playerName: string,
  blobs: Blob[],
  totalExpeditionsAllTime: number,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Update your score when data changes
  useEffect(() => {
    if (!walletAddress || walletAddress.length < 10) return;

    const score = calcScore(blobs, totalExpeditionsAllTime);
    const topBlobLevel = Math.max(...blobs.map(b => b.level), 0);

    const entry: LeaderboardEntry = {
      walletAddress,
      playerName: playerName || 'Trainer',
      score,
      totalLevel: blobs.reduce((s, b) => s + b.level, 0),
      totalExpeditions: totalExpeditionsAllTime,
      topBlobLevel,
      updatedAt: Date.now(),
    };

    const ref = doc(db, 'leaderboard', walletAddress.toLowerCase());
    setDoc(ref, entry, { merge: true }).catch(console.warn);
  }, [walletAddress, playerName, blobs, totalExpeditionsAllTime]);

  // Subscribe to top-50
  useEffect(() => {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('score', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => d.data() as LeaderboardEntry);
      setEntries(data);

      if (walletAddress) {
        const rank = data.findIndex(e =>
          e.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        setMyRank(rank >= 0 ? rank + 1 : null);
      }

      setIsLoading(false);
    }, err => {
      console.warn('Leaderboard error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [walletAddress]);

  const myScore = walletAddress
    ? calcScore(blobs, totalExpeditionsAllTime)
    : 0;

  return { entries, myRank, myScore, isLoading };
}
