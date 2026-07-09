/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Zap,
  Plus,
  Coins,
  Compass,
  Home,
  Layers,
  ShoppingBag,
  ClipboardList,
  ChevronRight,
  Sparkles,
  Lock,
  Edit2,
  X,
  Cpu,
  Radar,
  Database,
  Award,
  Atom,
  Cloud,
  RefreshCw,
  Code,
} from 'lucide-react';

import { GameState, Blob, ActiveExpedition, PersonalityType } from './types';
import { P, PKEYS, ZONES, QUEST_CFG, XP4LV, EREGEN, getBlobStats, getEvolutionStage, EVOLUTION_EMOJIS, EVOLUTION_NAMES, UPGRADES, canUpgrade, getUpgradeSlots, applyUpgrades } from './data';
import { BackgroundCanvas } from './components/BackgroundCanvas';
import { BlobCanvas } from './components/BlobCanvas';
import { PlatformCanvas } from './components/PlatformCanvas';
import { FloatingCubesCanvas } from './components/FloatingCubesCanvas';
import { NameModal } from './components/NameModal';
import { Toast } from './components/Toast';
import { WalletModal } from './components/WalletModal';
import { BlobDexModal } from './components/BlobDexModal';
import { UpgradesScreen } from './components/UpgradesScreen';
import { LevelUpModal } from './components/LevelUpModal';
import { SummonModal } from './components/SummonModal';
import { BuilderHubModal } from './components/BuilderHubModal';
import { playTapSound, playExpeditionCompleteSound, playLevelUpSound } from './utils/audio';
import { saveGameState, loadGameState, isOfflineError, subscribeToGameState } from './lib/syncService';

export function getDefaultState(): GameState {
  return {
    playerName: 'Trainer',
    cubes: 200, // Starts with some starting cubes to let them play
    energy: 100,
    energyMax: 100,
    lastEnergyTime: Date.now(),
    expeditionsToday: 0,
    cubesCollectedToday: 0,
    sendsToday: 0,
    tapsToday: 0,
    questDone: { exp: false, cubes: false, sends: false, taps: false },
    questClaimed: { exp: false, cubes: false, sends: false, taps: false },
    questsReset: Date.now(),
    blobs: [{ id: 'b1', personality: 'happy', level: 1, xp: 0, upgrades: { speed: 0, harvest: 0, fortune: 0 } }],
    selectedId: 'b1',
    expPickId: 'b1',
    expPickIds: ['b1'],
    nextId: 2,
    activeExpedition: null,
    activeExpeditions: [],
    verifiedTxHashes: [],
  };
}

export default function App() {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<string>('home');

  // Name Modal State
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);

  // Wallet Modal State
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [initialConnectType, setInitialConnectType] = useState<'base' | null>(null);

  // BlobDex Gallery State
  const [isBlobDexOpen, setIsBlobDexOpen] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [previewPersonality, setPreviewPersonality] = useState<PersonalityType | null>(null);

  // Summoning Celebration State
  const [isSummonModalOpen, setIsSummonModalOpen] = useState(false);
  const [isBuilderHubOpen, setIsBuilderHubOpen] = useState(false);
  const [directRevealPersonality, setDirectRevealPersonality] = useState<PersonalityType | null>(null);

  // Level Up State
  const [levelUpInfo, setLevelUpInfo] = useState<{
    blobId: string;
    personality: PersonalityType;
    oldLevel: number;
    newLevel: number;
    evolved: boolean;
    oldStage: number;
    newStage: number;
  } | null>(null);

  // Trigger level up sound when modal is shown
  useEffect(() => {
    if (levelUpInfo) {
      playLevelUpSound();
    }
  }, [levelUpInfo]);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');

  // Wallet Connection State
  const [walletAddress, setWalletAddress] = useState<string | null>(() => localStorage.getItem('bb_formatted_wallet'));
  const [rawWalletAddress, setRawWalletAddress] = useState<string | null>(() => localStorage.getItem('bb_raw_wallet'));

  // Sync / Cloud States
  const [syncId, setSyncId] = useState<string | null>(() => {
    const raw = localStorage.getItem('bb_raw_wallet');
    return raw ? `wallet_${raw.toLowerCase()}` : null;
  });
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState<boolean>(false);

  // Live ticker to update countdowns every second without bloating GameState
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Main Game State
  const [state, setState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem('bb_v6');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.blobs && parsed.blobs.length > 0) {
          // Keep structure integrity
          const migratedBlobs = parsed.blobs.map((b: any) => ({
            ...b,
            upgrades: b.upgrades || { speed: 0, harvest: 0, fortune: 0 },
          }));
          return {
            playerName: parsed.playerName || 'Trainer',
            cubes: typeof parsed.cubes === 'number' ? parsed.cubes : 0,
            energy: typeof parsed.energy === 'number' ? parsed.energy : 100,
            energyMax: typeof parsed.energyMax === 'number' ? parsed.energyMax : 100,
            lastEnergyTime: parsed.lastEnergyTime || Date.now(),
            expeditionsToday: parsed.expeditionsToday || 0,
            cubesCollectedToday: parsed.cubesCollectedToday || 0,
            sendsToday: parsed.sendsToday || 0,
            tapsToday: parsed.tapsToday || 0,
            questDone: {
              exp: parsed.questDone?.exp || false,
              cubes: parsed.questDone?.cubes || false,
              sends: parsed.questDone?.sends || false,
              taps: parsed.questDone?.taps || false,
            },
            questClaimed: {
              exp: parsed.questClaimed?.exp || false,
              cubes: parsed.questClaimed?.cubes || false,
              sends: parsed.questClaimed?.sends || false,
              taps: parsed.questClaimed?.taps || false,
            },
            questsReset: parsed.questsReset || Date.now(),
            blobs: migratedBlobs,
            selectedId: parsed.selectedId || parsed.blobs[0].id,
            expPickId: parsed.expPickId || parsed.blobs[0].id,
            expPickIds: parsed.expPickIds || [parsed.expPickId || parsed.blobs[0].id].filter(Boolean),
            nextId: parsed.nextId || parsed.blobs.length + 1,
            activeExpedition: parsed.activeExpedition || null,
            activeExpeditions: parsed.activeExpeditions || (parsed.activeExpedition ? [parsed.activeExpedition] : []),
            verifiedTxHashes: parsed.verifiedTxHashes || [],
          };
        }
      }
    } catch (e) {
      console.error('Failed to load localStorage', e);
    }

    // Default State
    return getDefaultState();
  });

  const stateRef = React.useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const lastReceivedTimestampRef = React.useRef<number | null>(null);

  // Helper to force-overwrite state, ref, and localStorage synchronously
  const syncAndSetState = (newState: GameState) => {
    if (newState.lastUpdated) {
      lastReceivedTimestampRef.current = newState.lastUpdated;
    }
    setState(newState);
    stateRef.current = newState;
    localStorage.setItem('bb_v6', JSON.stringify(newState));
  };

  // Helper to update state and save to local storage
  const updateState = (updater: (prev: GameState) => GameState) => {
    setState((prev) => {
      // Deep copy to prevent state pollution
      const next = updater(JSON.parse(JSON.stringify(prev)));
      next.lastUpdated = Date.now();

      // Compare old blobs and new blobs to check if any blob leveled up
      next.blobs.forEach((nextBlob) => {
        const prevBlob = prev.blobs.find((b) => b.id === nextBlob.id);
        if (prevBlob && nextBlob.level > prevBlob.level) {
          const oldStage = getEvolutionStage(prevBlob.level);
          const newStage = getEvolutionStage(nextBlob.level);
          const evolved = newStage > oldStage;

          setLevelUpInfo({
            blobId: nextBlob.id,
            personality: nextBlob.personality,
            oldLevel: prevBlob.level,
            newLevel: nextBlob.level,
            evolved,
            oldStage,
            newStage,
          });
        }
      });

      localStorage.setItem('bb_v6', JSON.stringify(next));
      return next;
    });
  };

  // ☁️ Cloud Sync hook: Load cloud state once on mount or when syncId is set
  useEffect(() => {
    if (!syncId) {
      setHasLoadedCloud(true);
      return;
    }

    if (hasLoadedCloud) {
      return;
    }

    const loadInitialState = async () => {
      setIsCloudSyncing(true);
      try {
        const cloudState = await loadGameState(syncId);
        if (cloudState) {
          const localLastUpdated = stateRef.current.lastUpdated || 0;
          const remoteLastUpdated = cloudState.lastUpdated || 0;

          if (remoteLastUpdated > localLastUpdated) {
            syncAndSetState(cloudState);
            triggerToast('Cloud save restored! Adventure synced.');
          } else if (localLastUpdated > remoteLastUpdated) {
            // Local is newer, upload to cloud
            await saveGameState(syncId, stateRef.current);
            console.log('Local progress is newer. Updated cloud save.');
          } else {
            console.log('Cloud save is already in sync.');
          }
        } else {
          // Initialize cloud save for first time with local progress
          await saveGameState(syncId, stateRef.current);
          console.log('Created initial cloud save.');
        }
      } catch (e) {
        if (isOfflineError(e)) {
          console.warn('Failed to load cloud save: offline.');
        } else {
          console.error('Failed to load cloud save:', e);
        }
      } finally {
        setHasLoadedCloud(true);
        setIsCloudSyncing(false);
      }
    };

    loadInitialState();
  }, [syncId, hasLoadedCloud]);

  // ☁️ Cloud Sync hook: Safe background auto-save to Firestore (2-second debounce)
  useEffect(() => {
    if (!syncId || !hasLoadedCloud) return;

    const timer = setTimeout(async () => {
      try {
        setIsCloudSyncing(true);
        await saveGameState(syncId, state);
        console.log('Background cloud save updated.');
      } catch (e) {
        if (!isOfflineError(e)) {
          console.error('Cloud auto-save failed:', e);
        }
      } finally {
        setIsCloudSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [state, syncId, hasLoadedCloud]);

  // Toast trigger
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Get active selected Blob
  const getSelectedBlob = (): Blob => {
    return state.blobs.find((b) => b.id === state.selectedId) || state.blobs[0];
  };

  // Get active blob selected for expedition
  const getExpPickBlob = (): Blob => {
    const id = state.expPickId || state.selectedId || state.blobs[0]?.id;
    return state.blobs.find((b) => b.id === id) || state.blobs[0];
  };

  const getExpPickBlobs = (): Blob[] => {
    return [getExpPickBlob()];
  };

  // Main game tick: Runs every second
  useEffect(() => {
    const interval = setInterval(() => {
      updateState((prev) => {
        let changed = false;

        // 1. Energy Regeneration
        if (prev.energy < prev.energyMax) {
          const el = Date.now() - prev.lastEnergyTime;
          const hasSleepy = prev.blobs.some((b) => b.personality === 'sleepy');
          const rate = hasSleepy ? EREGEN * 0.7 : EREGEN;
          const gained = Math.floor(el / rate);
          if (gained > 0) {
            prev.energy = Math.min(prev.energyMax, prev.energy + gained);
            prev.lastEnergyTime = Date.now() - (el % rate);
            changed = true;
          }
        } else {
          prev.lastEnergyTime = Date.now();
        }

        // 2. Daily Quests Reset (after 24 hours)
        if (Date.now() - prev.questsReset > 86400000) {
          prev.expeditionsToday = 0;
          prev.cubesCollectedToday = 0;
          prev.sendsToday = 0;
          prev.tapsToday = 0;
          prev.questDone = { exp: false, cubes: false, sends: false, taps: false };
          prev.questClaimed = { exp: false, cubes: false, sends: false, taps: false };
          prev.questsReset = Date.now();
          changed = true;
        }

        // 3. Active Expeditions list timer completion check
        if (!prev.activeExpeditions) {
          prev.activeExpeditions = [];
        }

        // Migrate legacy activeExpedition if present
        if (prev.activeExpedition) {
          prev.activeExpeditions.push(prev.activeExpedition);
          prev.activeExpedition = null;
          changed = true;
        }

        if (prev.activeExpeditions.length > 0) {
          const currentActiveExps = [...prev.activeExpeditions];
          const remainingExps: ActiveExpedition[] = [];

          for (const exp of currentActiveExps) {
            if (Date.now() >= exp.endTime) {
              changed = true;
              const activeIds = exp.blobIds || (exp.blobId ? [exp.blobId] : []);
              const activeBlobs = prev.blobs.filter((b) => activeIds.includes(b.id));

              const minReward = exp.reward[0];
              const maxReward = exp.reward[1];
              let reward = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
              let xpGain = exp.xp;

              if (activeBlobs.length > 0) {
                const statsList = activeBlobs.map((b) => getBlobStats(b.personality, b.level));
                const totalPower = statsList.reduce((acc, s) => acc + s.power, 0);
                const avgLuck = statsList.reduce((acc, s) => acc + s.luck, 0) / statsList.length;

                const maxHarvestLevel = activeBlobs.reduce((max, b) => Math.max(max, b.upgrades?.harvest || 0), 0);
                const maxFortuneLevel = activeBlobs.reduce((max, b) => Math.max(max, b.upgrades?.fortune || 0), 0);

                // 1. Power Bonus: increases cube rewards by +0.2% per point
                const powerBonus = totalPower * 0.002;
                reward = Math.round(reward * (1 + powerBonus));

                // Apply Harvest and Fortune upgrades
                const fakeUpgrades = { speed: 0, harvest: maxHarvestLevel, fortune: maxFortuneLevel };
                const { reward: upgradedReward, bonusChance } = applyUpgrades(
                  reward,
                  0,
                  0.30, // base chance for chaotic
                  fakeUpgrades
                );
                reward = upgradedReward;

                const fortuneBonus = maxFortuneLevel > 0
                  ? UPGRADES[2].levels[maxFortuneLevel - 1].value : 0;

                // 2. Luck Bonus: (luck * 0.4% + fortune bonus) chance of double cubes (critical success!)
                const luckCritChance = Math.min(0.95, avgLuck * 0.004 + fortuneBonus);
                const isCrit = Math.random() < luckCritChance;
                if (isCrit) {
                  reward = reward * 2;
                  triggerToast('🍀 Luck Critical! DOUBLE CUBES! ×2.0');
                }

                // 3. Static Personality Boosters
                const hasLucky = activeBlobs.some((b) => b.personality === 'lucky');
                const hasCosmicHighLv = activeBlobs.some((b) => b.personality === 'cosmic' && b.level >= 10);
                const hasChaotic = activeBlobs.some((b) => b.personality === 'chaotic');

                if (hasLucky) reward = Math.round(reward * 1.15);
                if (hasCosmicHighLv) reward = Math.round(reward * 1.25);
                if (hasChaotic && Math.random() < bonusChance) {
                  reward = Math.round(reward * 1.5);
                  triggerToast('⚡ Chaotic jackpot! ×1.5!');
                }
              }

              prev.cubes += reward;
              prev.cubesCollectedToday += reward;
              prev.expeditionsToday++;

              activeBlobs.forEach((blob) => {
                let blobXpGain = xpGain;
                if (blob.personality === 'happy') blobXpGain = Math.round(blobXpGain * 1.2);
                blob.xp += blobXpGain;
                // Level up logic
                while (blob.xp >= XP4LV(blob.level) && blob.level < 20) {
                  blob.xp -= XP4LV(blob.level);
                  blob.level++;
                  triggerToast(`🎉 ${P[blob.personality]?.emoji || '👾'} level up to Lv.${blob.level}!`);
                  if ([5, 10, 20].includes(blob.level)) {
                    triggerToast(`✨ Evolution unlocked! Form upgraded!`);
                  }
                }
              });

              // Check quest completions
              if (!prev.questDone.exp && prev.expeditionsToday >= 1) {
                prev.questDone.exp = true;
                triggerToast('📋 Mission Completed! Open Quests to claim reward! 💠');
              }

              if (!prev.questDone.cubes && prev.cubesCollectedToday >= 100) {
                prev.questDone.cubes = true;
                triggerToast('📋 Mission Completed! Open Quests to claim reward! 💠');
              }

              triggerToast(`✅ Expedition ${exp.name} Done! +${reward} 💠 and +${xpGain} XP!`);
            } else {
              remainingExps.push(exp);
            }
          }

          if (changed) {
            prev.activeExpeditions = remainingExps;
          }
        }

        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Play audio cue when an expedition completes successfully
  const prevExpeditionsLengthRef = React.useRef(state.activeExpeditions?.length || 0);
  useEffect(() => {
    const prevLen = prevExpeditionsLengthRef.current;
    const currLen = state.activeExpeditions?.length || 0;
    if (currLen < prevLen) {
      playExpeditionCompleteSound();
    }
    prevExpeditionsLengthRef.current = currLen;
  }, [state.activeExpeditions]);

  // Format Helper: Milliseconds to MM:SS or HH:MM:SS
  const formatMs = (ms: number) => {
    if (ms <= 0) return '00:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}h ${String(m % 60).padStart(2, '0')}m`;
    }
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  // Format Helper: Seconds to duration description
  const formatDuration = (s: number) => {
    if (s >= 3600) return `${Math.round(s / 3600)}h`;
    if (s >= 60) return `${Math.round(s / 60)}m`;
    return `${s}s`;
  };

  // Format Helper: Big numbers
  const formatNumber = (n: number) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
  };

  // Connect Wallet Actions
  const handleConnectWalletType = async (type: 'base', address?: string) => {
    const processConnection = async (addr: string) => {
      const formatted = addr.length > 12 ? (addr.slice(0, 6) + '...' + addr.slice(-4)) : addr;
      setWalletAddress(formatted);
      setRawWalletAddress(addr);
      
      const newSyncId = `wallet_${addr.toLowerCase()}`;
      const currentSyncId = localStorage.getItem('bb_sync_id');
      
      if (syncId !== newSyncId || currentSyncId !== newSyncId) {
        setHasLoadedCloud(false);
        setSyncId(newSyncId);
        localStorage.setItem('bb_sync_id', newSyncId);
        triggerToast('Wallet connected! Loading save...');
      } else {
        // Already loaded/in sync, just ensure state reflects it
        setSyncId(newSyncId);
      }
      
      localStorage.setItem('bb_formatted_wallet', formatted);
      localStorage.setItem('bb_raw_wallet', addr);

      setIsWalletModalOpen(false);
    };

    if (address) {
      await processConnection(address);
      return;
    }

    if (typeof window !== 'undefined') {
      let provider = null;
      const eth = (window as any).ethereum;

      if (eth?.isBaseWallet || eth?.isBase || eth?.isCoinbaseWallet) {
        provider = eth;
      } else if (eth?.providers) {
        provider = eth.providers.find((p: any) => p.isBaseWallet || p.isBase || p.isCoinbaseWallet);
      } else if (eth && !eth.isMetaMask) {
        provider = eth;
      }

      if (provider) {
        try {
          const accounts = await provider.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            await processConnection(accounts[0]);
          }
        } catch (e) {
          console.error(e);
          triggerToast('Failed to connect wallet.');
        }
      } else {
        triggerToast('Please open inside Base App to connect.');
      }
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setRawWalletAddress(null);
    setSyncId(null);
    setHasLoadedCloud(false);
    setIsCloudSyncing(false);

    localStorage.removeItem('bb_formatted_wallet');
    localStorage.removeItem('bb_raw_wallet');
    localStorage.removeItem('bb_sync_id');

    setIsWalletModalOpen(false);
    triggerToast('Wallet disconnected. Game progress preserved locally!');
  };

  // ☁️ Auto-connect wallet on startup if running in an in-app Web3 browser or previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window === 'undefined') return;
      const eth = (window as any).ethereum;
      if (!eth) return;

      try {
        // Check if there are already authorized accounts
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (accounts && accounts[0]) {
          const addr = accounts[0];
          console.log('Auto-detected connected account on mount:', addr);
          await handleConnectWalletType('base', addr);
        } else if (localStorage.getItem('bb_raw_wallet')) {
          // If we had a wallet stored, we can request connection in Web3 browser context
          const isWeb3Browser = eth.isBaseWallet || eth.isBase || eth.isCoinbaseWallet || navigator.userAgent.includes('Coinbase') || navigator.userAgent.includes('Base');
          if (isWeb3Browser) {
            const reqAccounts = await eth.request({ method: 'eth_requestAccounts' });
            if (reqAccounts && reqAccounts[0]) {
              await handleConnectWalletType('base', reqAccounts[0]);
            }
          }
        }
      } catch (e) {
        console.warn('Silent wallet auto-connect failed or was ignored:', e);
      }
    };
    // Give a short delay to ensure wallet injection
    const timer = setTimeout(autoConnect, 800);
    return () => clearTimeout(timer);
  }, []);

  // Action: Open summon modal
  const handleOpenSummonModal = () => {
    if (state.cubes < 1500) {
      triggerToast('Need 1500 💠 to Summon!');
      return;
    }
    setIsSummonModalOpen(true);
  };

  // Action: Execute summoning (called when signature is confirmed in modal)
  const handleExecuteSummon = (): PersonalityType | null => {
    if (state.cubes < 1500) {
      triggerToast('Need 1500 💠 to Summon!');
      return null;
    }

    const randomPersonality = PKEYS[Math.floor(Math.random() * PKEYS.length)];

    updateState((prev) => {
      if (prev.cubes < 1500) return prev;
      prev.cubes -= 1500;
      const newBlob: Blob = {
        id: `b${prev.nextId++}`,
        personality: randomPersonality,
        level: 1,
        xp: 0,
        upgrades: { speed: 0, harvest: 0, fortune: 0 },
      };
      prev.blobs.push(newBlob);
      prev.selectedId = newBlob.id;
      return prev;
    });

    return randomPersonality;
  };

  // Action: Unlock a specific species directly (costs 3000 cubes)
  const handleUnlockSpecies = (personality: PersonalityType) => {
    const alreadyOwned = state.blobs.some((b) => b.personality === personality);
    if (alreadyOwned) {
      triggerToast(`You already own the ${P[personality].name} species!`);
      return;
    }
    if (state.cubes < 3000) {
      triggerToast('Need 3000 💠 to Unlock Species!');
      return;
    }

    updateState((prev) => {
      if (prev.cubes < 3000) return prev;
      prev.cubes -= 3000;
      const newBlob: Blob = {
        id: `b${prev.nextId++}`,
        personality,
        level: 1,
        xp: 0,
        upgrades: { speed: 0, harvest: 0, fortune: 0 },
      };
      prev.blobs.push(newBlob);
      prev.selectedId = newBlob.id;
      setPreviewPersonality(null);
      return prev;
    });

    setDirectRevealPersonality(personality);
    setIsSummonModalOpen(true);
  };

  // Action: Upgrade a specific branch on a blob
  const handleUpgradeBlob = (blobId: string, branch: 'speed' | 'harvest' | 'fortune') => {
    let errorMsg = '';
    updateState((prev) => {
      const blob = prev.blobs.find((b) => b.id === blobId);
      if (!blob) {
        errorMsg = 'Blob not found!';
        return prev;
      }

      // Initialize upgrades object if it doesn't exist
      if (!blob.upgrades) {
        blob.upgrades = { speed: 0, harvest: 0, fortune: 0 };
      }

      const currentLv = blob.upgrades[branch] || 0;
      const branchInfo = UPGRADES.find((up) => up.id === branch);
      if (!branchInfo) {
        errorMsg = 'Upgrade branch not found!';
        return prev;
      }

      const nextLevel = branchInfo.levels[currentLv];
      if (!nextLevel) {
        errorMsg = 'Already fully upgraded!';
        return prev;
      }

      const check = canUpgrade(
        branch,
        currentLv,
        blob.level,
        blob.upgrades || { speed: 0, harvest: 0, fortune: 0 },
        prev.cubes,
        getEvolutionStage(blob.level)
      );
      if (!check.allowed) {
        errorMsg = check.reason || 'Upgrade locked!';
        return prev;
      }

      // Deduct cubes
      prev.cubes -= nextLevel.cost;

      // Increase level of upgrade
      blob.upgrades[branch] = currentLv + 1;

      triggerToast(`✨ Upgraded ${branchInfo.name} to Level ${currentLv + 1}!`);
      return prev;
    });

    if (errorMsg) {
      triggerToast(errorMsg);
    }
  };

  // Action: Buy energy refill from market
  const handleBuyEnergy = (amount: number, price: number) => {
    let errorMsg = '';
    updateState((prev) => {
      if (prev.cubes < price) {
        errorMsg = `Need ${price} 💠 Cubes!`;
        return prev;
      }
      prev.cubes -= price;
      prev.energy = Math.min(prev.energyMax, prev.energy + amount);
      triggerToast(`Refilled +${amount} ⚡ Energy!`);
      return prev;
    });

    if (errorMsg) {
      triggerToast(errorMsg);
    }
  };

  // Action: Start expedition
  const handleStartExpedition = (zoneId: string) => {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) return;

    const pickedBlobs = getExpPickBlobs();
    if (pickedBlobs.length === 0) {
      triggerToast('No blob selected!');
      return;
    }

    const isUnderleveled = pickedBlobs.some((b) => b.level < zone.unlockLv);
    if (isUnderleveled) {
      triggerToast(`All selected blobs must be at least Lv.${zone.unlockLv}!`);
      return;
    }

    // Check if any of the selected blobs are already busy on an expedition
    const isAnyBlobBusy = pickedBlobs.some((b) => {
      return state.activeExpeditions?.some((exp) => exp.blobIds?.includes(b.id) || exp.blobId === b.id);
    });
    if (isAnyBlobBusy) {
      triggerToast('One or more selected blobs are already away on an expedition!');
      return;
    }

    if (state.energy < zone.cost) {
      triggerToast(`Not enough ⚡ energy! Need ${zone.cost}`);
      return;
    }

    updateState((prev) => {
      if (prev.energy < zone.cost) return prev;

      // Start expedition
      prev.energy -= zone.cost;
      prev.lastEnergyTime = Date.now();
      prev.sendsToday++;

      const currentPickedId = prev.expPickId || prev.selectedId || prev.blobs[0]?.id;
      const finalBlob = prev.blobs.find((b) => b.id === currentPickedId) || prev.blobs[0];
      const finalBlobs = [finalBlob];

      const statsList = finalBlobs.map((b) => getBlobStats(b.personality, b.level));
      const avgSpeed = statsList.reduce((acc, s) => acc + s.speed, 0) / statsList.length;
      const speedBonus = Math.min(0.50, avgSpeed * 0.003); // Cap at 50% time reduction
      const baseDuration = Math.round(zone.dur * (1 - speedBonus));

      // Max speed upgrade among them
      const maxSpeedLevel = finalBlobs.reduce((max, b) => Math.max(max, b.upgrades?.speed || 0), 0);
      const fakeUpgrades = { speed: maxSpeedLevel, harvest: 0, fortune: 0 };
      const { duration } = applyUpgrades(0, baseDuration, 0, fakeUpgrades);

      const newExp: ActiveExpedition = {
        blobIds: finalBlobs.map((b) => b.id),
        zoneId,
        name: zone.name,
        reward: zone.reward,
        xp: zone.xp,
        duration: duration,
        endTime: Date.now() + duration * 1000,
      };

      if (!prev.activeExpeditions) {
        prev.activeExpeditions = [];
      }
      prev.activeExpeditions.push(newExp);

      // Auto-select the next idle blob to make it easier to send other idle blobs
      const firstIdle = prev.blobs.find(b => {
        return b.id !== finalBlob.id && !prev.activeExpeditions?.some(exp => exp.blobIds?.includes(b.id) || exp.blobId === b.id);
      });
      if (firstIdle) {
        prev.expPickId = firstIdle.id;
        prev.expPickIds = [firstIdle.id];
      } else {
        prev.expPickId = finalBlob.id;
        prev.expPickIds = [finalBlob.id];
      }

      // Check daily quest: send 2 expeditions
      if (!prev.questDone.sends && prev.sendsToday >= 2) {
        prev.questDone.sends = true;
        triggerToast('📋 Mission Completed! Open Quests to claim reward! 💠');
      }

      triggerToast(`🚀 ${zone.name} started! -${zone.cost} ⚡`);
      return prev;
    });
  };

  // Action: Tap Blob
  const handleTapBlob = () => {
    playTapSound();
    updateState((prev) => {
      prev.tapsToday = (prev.tapsToday || 0) + 1;
      
      const blob = prev.blobs.find((b) => b.id === prev.selectedId);
      if (blob) {
        // Gain small XP for tapping up to 5 times daily
        if ((prev.tapsToday || 0) <= 5) {
          blob.xp += 2;
          while (blob.xp >= XP4LV(blob.level) && blob.level < 20) {
            blob.xp -= XP4LV(blob.level);
            blob.level++;
          }
        }
      }

      // Check quest: Tap your Blob 5 times
      if (!prev.questDone.taps && (prev.tapsToday || 0) >= 5) {
        prev.questDone.taps = true;
        triggerToast('📋 Mission Completed! Open Quests to claim reward! 💠');
      } else {
        const bp = blob ? P[blob.personality] : null;
        triggerToast(`✨ Happy tap! ${(prev.tapsToday || 0)}/5`);
      }

      return prev;
    });
  };

  // Change selected Blob ID
  const handleSelectBlob = (id: string) => {
    updateState((prev) => {
      prev.selectedId = id;
      return prev;
    });
  };

  // Change expedition pick Blob ID
  const handlePickBlobForExp = (id: string) => {
    updateState((prev) => {
      prev.expPickId = id;
      prev.expPickIds = [id];
      return prev;
    });
  };

  // Update trainer name
  const handleSaveName = (newName: string) => {
    updateState((prev) => {
      prev.playerName = newName;
      return prev;
    });
    setIsNameModalOpen(false);
    triggerToast('Trainer name updated!');
  };

  // Action: Claim Quest Reward
  const handleClaimQuestReward = (questId: 'exp' | 'cubes' | 'sends' | 'taps') => {
    let msg = '';
    updateState((prev) => {
      const q = QUEST_CFG.find((qc) => qc.id === questId);
      if (!q) return prev;
      
      if (!prev.questDone[questId]) {
        msg = 'Quest is not completed yet!';
        return prev;
      }
      
      if (prev.questClaimed?.[questId]) {
        msg = 'Reward already claimed!';
        return prev;
      }
      
      if (!prev.questClaimed) {
        prev.questClaimed = { exp: false, cubes: false, sends: false, taps: false };
      }
      
      // Mark as claimed
      prev.questClaimed[questId] = true;
      
      // Award cubes
      prev.cubes += q.cubes;
      
      // Award XP to selected blob
      const activeBlob = prev.blobs.find((b) => b.id === prev.selectedId) || prev.blobs[0];
      if (activeBlob) {
        activeBlob.xp += q.xp;
        
        while (activeBlob.xp >= XP4LV(activeBlob.level) && activeBlob.level < 20) {
          activeBlob.xp -= XP4LV(activeBlob.level);
          activeBlob.level++;
          msg = `🎉 Claimed: +${q.cubes} 💠 & level up! ${P[activeBlob.personality]?.emoji || '👾'} is now Lv.${activeBlob.level}!`;
        }
      }
      
      if (!msg) {
        msg = `🎁 Claimed Quest Reward: +${q.cubes} 💠 and +${q.xp} XP!`;
      }
      
      return prev;
    });
    
    if (msg) {
      triggerToast(msg);
    }
  };

  // Calculated: Sleepy regeneration modifier
  const hasSleepy = state.blobs.some((b) => b.personality === 'sleepy');
  const energyRegenInterval = hasSleepy ? EREGEN * 0.7 : EREGEN;
  const timeToNextEnergy =
    state.energy < state.energyMax
      ? energyRegenInterval - (Date.now() - state.lastEnergyTime)
      : 0;

  const currentSelectedBlob = getSelectedBlob();
  const currentSelectedBlobInfo = P[currentSelectedBlob?.personality] || P.happy;

  const getEvolutionProgress = () => {
    if (!currentSelectedBlob) return 0;
    const lv = currentSelectedBlob.level;
    const xp = currentSelectedBlob.xp;
    const max_xp = XP4LV(lv);
    const xpPct = max_xp > 0 ? xp / max_xp : 0;
    
    if (lv < 5) {
      return (((lv - 1) + xpPct) / 4) * 100;
    } else if (lv < 10) {
      return (((lv - 5) + xpPct) / 5) * 100;
    } else {
      return (Math.min(10, (lv - 10) + xpPct) / 10) * 100;
    }
  };
  const evolutionProgress = getEvolutionProgress();

  // ── 📱 BASE APP RESTRICTION SCREEN ──
  const isBaseApp = typeof window !== 'undefined' && (
    (window as any).ethereum?.isBaseWallet || 
    (window as any).ethereum?.isCoinbaseWallet || 
    (window as any).ethereum?.isBase ||
    (window as any).ethereum?.providers?.some((p: any) => p.isBaseWallet || p.isBase || p.isCoinbaseWallet) ||
    navigator.userAgent.toLowerCase().includes('coinbase') ||
    navigator.userAgent.toLowerCase().includes('base')
  );

  if (!isBaseApp) {
    const appUrl = 'https://baseblobs.vercel.app/';

    return (
      <div id="app" className="w-full max-w-[420px] h-[100dvh] max-h-[100dvh] bg-[#060d22] relative flex flex-col justify-between p-6 shadow-2xl overflow-y-auto no-scrollbar border-x border-white/5 font-sans mx-auto text-white select-none">
        <BackgroundCanvas currentScreen="home" />
        <FloatingCubesCanvas glowColor="#0052ff" className="absolute inset-0 z-0 opacity-60 pointer-events-none" />

        {/* Top Header */}
        <div className="flex flex-col items-center text-center mt-4 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-br from-[#0052ff]/20 to-[#00cfff]/15 rounded-2xl border-2 border-[#00cfff]/40 flex items-center justify-center shadow-lg shadow-[#0052ff]/20 mb-3 relative flex-shrink-0 animate-pulse">
            <BlobCanvas personality="happy" size={40} animate={true} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#00cfff] bg-clip-text text-transparent font-mono uppercase">
            BASE BLOBS
          </h1>
          <p className="text-[#00cfff] text-[8.5px] font-bold tracking-widest uppercase bg-[#0052ff]/10 border border-[#0052ff]/30 rounded-full px-2.5 py-0.5 font-mono mt-1">
            Base App Exclusive
          </p>
        </div>

        {/* Access Instructions Card */}
        <div className="bg-[#0b1026]/95 border border-[#0052ff]/30 rounded-2xl p-5 relative z-10 text-center space-y-4 backdrop-blur-md shadow-2xl my-auto">
          <div className="space-y-1">
            <h3 className="text-sm font-black font-mono tracking-wider uppercase text-white">Play inside Coinbase Wallet</h3>
            <p className="text-[10px] text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              This game is fully optimized for the Coinbase Wallet. Please open it inside the built-in browser!
            </p>
          </div>

          {/* Link Display Panel */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-center space-y-1">
            <span className="text-[8px] uppercase font-mono text-slate-500 tracking-wider">Official URL</span>
            <div className="text-xs font-mono text-[#00cfff] select-all font-bold break-all selection:bg-[#0052ff]/30">
              {appUrl}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(appUrl);
                triggerToast('Link copied!');
              }}
              className="mt-1 text-[8px] font-mono uppercase text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/10 active:scale-95 transition-all"
            >
              Copy Link
            </button>
          </div>

          <div className="space-y-2 text-left text-[9px] text-slate-300 max-w-[275px] mx-auto bg-black/25 p-3 rounded-xl border border-white/5">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#0052ff] flex items-center justify-center text-white font-bold text-[8px] mt-0.5 flex-shrink-0">1</span>
              <p className="flex-1">Open the **Coinbase Wallet App** (Base App) on your phone.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#0052ff] flex items-center justify-center text-white font-bold text-[8px] mt-0.5 flex-shrink-0">2</span>
              <p className="flex-1">Tap the **Browser** icon in the bottom menu.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#0052ff] flex items-center justify-center text-white font-bold text-[8px] mt-0.5 flex-shrink-0">3</span>
              <p className="flex-1">Search for **Base Blobs** or enter the official URL above!</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-center pb-2">
          <p className="text-[7.5px] text-slate-500 font-mono tracking-wide">
            Designed for mobile Base-native environment
          </p>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div id="app" className="w-full max-w-[420px] h-[100dvh] max-h-[100dvh] bg-[#060d22] relative flex flex-col justify-between p-4 shadow-2xl overflow-y-auto no-scrollbar border-x border-white/5 font-sans mx-auto text-white select-none">
        {/* Background Canvas */}
        <BackgroundCanvas currentScreen="home" />
        <FloatingCubesCanvas glowColor="#0052ff" className="absolute inset-0 z-0 opacity-60 pointer-events-none" />

        {/* Center content: Title & Blobs */}
        <div className="flex flex-col items-center justify-center flex-1 text-center py-1 relative z-10 my-auto">
          <div className="w-14 h-14 bg-gradient-to-br from-[#0052ff]/20 to-[#00cfff]/15 rounded-2xl border-2 border-[#00cfff]/40 flex items-center justify-center shadow-lg shadow-[#0052ff]/20 mb-2.5 relative flex-shrink-0">
            <div className="absolute inset-0 bg-[#00cfff]/10 blur-xl rounded-full animate-pulse" />
            <BlobCanvas
              personality="happy"
              size={40}
              animate={true}
            />
          </div>

          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#00cfff] bg-clip-text text-transparent font-mono uppercase mb-0.5">
            BASE BLOBS
          </h1>
          <p className="text-[#00cfff] text-[8.5px] font-bold tracking-widest uppercase bg-[#0052ff]/10 border border-[#0052ff]/30 rounded-full px-2 py-0.2 font-mono mb-2">
            Web3 Idle RPG
          </p>

          <p className="text-slate-400 text-[10px] leading-relaxed max-w-[280px] mb-4">
            Hatch, train, and evolve legendary Blobs on the Base L2 blockchain. Your adventure progress is tied directly to your Web3 identity.
          </p>

          {/* Connect Panel */}
          <div className="bg-[#0b1026]/90 border border-[#0052ff]/30 rounded-2xl p-3 w-full max-w-[310px] space-y-2 backdrop-blur-md shadow-xl">
            <h3 className="text-white text-[9px] font-black tracking-wider uppercase font-mono text-left mb-0.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#00cfff]" /> Connect Wallet to Play
            </h3>

            {/* Base App Option */}
            <button
              onClick={() => {
                setInitialConnectType('base');
                setIsWalletModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 bg-[#0052ff]/10 hover:bg-[#0052ff]/20 border border-[#0052ff]/30 rounded-xl transition-all group cursor-pointer text-left relative overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow">
                  <svg viewBox="0 0 100 100" className="w-3.5 h-3.5 text-[#0052ff] fill-current">
                    <circle cx="50" cy="50" r="40" stroke="#0052ff" strokeWidth="12" fill="none" />
                    <circle cx="50" cy="50" r="15" fill="#0052ff" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-white text-[10.5px] font-bold">Base App / CB Wallet</span>
                    <span className="bg-cyan-500/20 text-[#00cfff] border border-cyan-500/30 text-[6.5px] font-mono font-bold px-0.8 py-0.1 rounded flex items-center gap-0.5">
                      <Zap className="w-1.5 h-1.5 animate-pulse" /> Gasless
                    </span>
                  </div>
                  <span className="text-slate-400 text-[8px] block font-sans">Scan QR from PC or connect on mobile</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors animate-bounce-short" />
            </button>
          </div>
        </div>

        {/* Info footer */}
        <div className="p-2 bg-black/35 border border-white/5 rounded-xl text-center relative z-10 flex flex-col gap-0.5 mt-2 flex-shrink-0">
          <p className="text-[8px] text-slate-400 leading-normal font-medium">
            🔒 **Cross-Device Automatic Syncing**: Your game progress is linked securely to your Web3 wallet address, allowing you to seamlessly play across your phone, PC, and other devices.
          </p>
          <span className="text-[6.5px] text-slate-500 font-mono">
            Secure L2 state connection · BaseBlobs Game
          </span>
        </div>

        {/* Wallet connection modal */}
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => {
            setIsWalletModalOpen(false);
            setInitialConnectType(null);
          }}
          walletAddress={walletAddress || ''}
          onConnect={handleConnectWalletType}
          onDisconnect={handleDisconnectWallet}
          triggerToast={triggerToast}
          initialConnectType={initialConnectType}
        />

        {/* Global Toast component */}
        <Toast message={toastMessage} onClear={() => setToastMessage('')} />
      </div>
    );
  }



  return (
    <div id="app" className="w-full max-w-[420px] h-[100dvh] max-h-[100dvh] bg-[#060d22] relative flex flex-col shadow-2xl overflow-hidden border-x border-white/5 font-sans mx-auto text-white select-none">
      {/* Background canvas based on selected view */}
      <BackgroundCanvas currentScreen={currentScreen} />

      {/* ── TOP WALLET & NETWORK BAR ── */}
      <div className="flex items-center justify-between px-4 py-1 bg-black/45 border-b border-white/5 text-[9px] text-slate-400 font-medium relative z-20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono tracking-wider uppercase text-[7.5px] text-slate-300">Base Chain</span>
          </div>
          <button
            onClick={() => setIsBuilderHubOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/30 active:scale-95 border border-indigo-500/25 rounded-full text-[7px] font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer transition-all font-mono"
          >
            <Code className="w-2 h-2 text-indigo-400" />
            <span>Builder Station 💠</span>
          </button>
        </div>
        <button
          onClick={() => setIsWalletModalOpen(true)}
          className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600/20 active:scale-95 border border-blue-500/25 rounded-full text-[7.5px] font-bold text-[#00cfff] cursor-pointer transition-all font-mono"
        >
          <Wallet className="w-2 h-2 text-[#00cfff]" />
          <span>{walletAddress ? walletAddress : 'Connect Base Wallet'}</span>
        </button>
      </div>

      {/* ── TOPBAR ── */}
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 relative z-10 bg-[#020617]/90 backdrop-blur-md border-b border-white/5">
        {currentScreen === 'home' ? (
          /* Home Screen Title with XP bar under level */
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0052ff]/20 to-[#00cfff]/10 border border-[#00cfff]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {currentSelectedBlob ? (
                <BlobCanvas
                  personality={currentSelectedBlob.personality}
                  size={26}
                  animate={true}
                />
              ) : (
                <span className="text-xs">👾</span>
              )}
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-white text-xs font-black tracking-tight">{state.playerName || 'BaseBlobs'}</span>
                <Edit2 
                  className="w-2.5 h-2.5 text-slate-500 cursor-pointer hover:text-white transition-colors" 
                  onClick={() => setIsNameModalOpen(true)}
                />
              </div>
              {currentSelectedBlob && (
                <div className="flex items-center gap-1 mt-0.5 text-[8px] text-slate-400 font-mono">
                  <span className="font-bold text-[#00cfff]">Lv.{currentSelectedBlob.level}</span>
                  <span className="opacity-45">|</span>
                  {currentSelectedBlob.level >= 20 ? (
                    <span className="text-amber-400 font-extrabold tracking-wide animate-pulse">MAX XP</span>
                  ) : (
                    <span>{currentSelectedBlob.xp}/{XP4LV(currentSelectedBlob.level)} XP</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard Section Headers as shown on screen 2 & 3 */
          <div className="flex items-center gap-1.5">
            <span className="text-sm">
              {currentScreen === 'expeditions' ? '🗺️' : currentScreen === 'upgrades' ? '⚡' : currentScreen === 'shop' ? '🛍️' : '📋'}
            </span>
            <span className="text-white text-xs font-black tracking-tight capitalize">
              {currentScreen}
            </span>
          </div>
        )}

        {/* Dynamic counters for Cubes and Energy */}
        <div className="flex items-center gap-1.5">
          {/* Cubes Counter */}
          <div className="flex items-center gap-1 bg-[#060a1f] border border-white/5 rounded-xl px-2.5 py-0.5 text-[10px]">
            <span className="text-xs leading-none">💠</span>
            <span className="font-extrabold font-mono text-white tracking-wide min-w-[30px] text-right">
              {formatNumber(state.cubes)}
            </span>
          </div>

          {/* Energy Counter (Unified layout prevents crooked columns) */}
          <div
            onClick={() => triggerToast(`⚡ Energy Rate: +1 every ${hasSleepy ? '3.5' : '5'} mins${hasSleepy ? ' (Sleepy Buff! 😴)' : ''}. Max: ${state.energyMax}`)}
            className="flex items-center gap-1 bg-[#060a1f] hover:bg-slate-900 border border-white/5 rounded-xl px-2.5 py-0.5 text-[10px] cursor-pointer transition-colors"
            title="Click to view energy recovery rate!"
          >
            <span className="text-xs leading-none">⚡</span>
            <div className="flex items-center gap-1 font-mono">
              <span className="font-extrabold text-white">
                {state.energy}/{state.energyMax}
              </span>
              {state.energy < state.energyMax && timeToNextEnergy > 0 && (
                <span className="text-[7.5px] text-slate-500 font-bold">
                  ({formatMs(timeToNextEnergy)})
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── APP CONTENT WRAPPER ── */}
      <main className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative z-10">
        
        {/* ══ 1. HOME SCREEN ══ */}
        {currentScreen === 'home' && (
          <div className="flex flex-col flex-1 animate-fade-in">
            {/* The Stage */}
            <div className="relative flex flex-col items-center pt-6 pb-4 flex-shrink-0 min-h-[290px]">
              <FloatingCubesCanvas
                glowColor={previewPersonality ? P[previewPersonality].glow : currentSelectedBlobInfo.glow}
                className="absolute inset-0 z-0"
              />

              {/* Preview Indicator */}
              {previewPersonality && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[9px] font-black tracking-wider px-3 py-1 rounded-full z-20 flex items-center gap-1.5 animate-bounce shadow-lg shadow-amber-500/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-black"></span>
                  </span>
                  <span>PREVIEW: {P[previewPersonality].name.toUpperCase()}</span>
                  <button
                    onClick={() => setPreviewPersonality(null)}
                    className="ml-1 bg-black/20 hover:bg-black/30 text-black px-1.5 py-0.5 rounded font-extrabold text-[8px] cursor-pointer"
                  >
                    Exit
                  </button>
                </div>
              )}
              
              {/* Interactive Tappable Blob Stage */}
              <div 
                className="relative z-10 cursor-pointer active:scale-95 transition-transform hover:brightness-110"
                onClick={previewPersonality ? () => triggerToast(`✨ Playing with preview ${P[previewPersonality].name}!`) : handleTapBlob}
                title={previewPersonality ? "Previewing!" : "Tap your Blob!"}
              >
                {previewPersonality ? (
                  <BlobCanvas
                    personality={previewPersonality}
                    size={210}
                    animate={true}
                  />
                ) : currentSelectedBlob ? (
                  <BlobCanvas
                    personality={currentSelectedBlob.personality}
                    size={210}
                    animate={true}
                    evolutionStage={getEvolutionStage(currentSelectedBlob.level)}
                  />
                ) : null}
              </div>
              
              <div className="relative z-0 mt-[-28px]">
                {previewPersonality ? (
                  <PlatformCanvas personality={previewPersonality} />
                ) : currentSelectedBlob ? (
                  <PlatformCanvas personality={currentSelectedBlob.personality} />
                ) : null}
              </div>
              
              {/* High-Fidelity Segmented Evolution Progress Section (matching PNG) */}
              {currentSelectedBlob && (
                <div className="w-[280px] mt-4 relative z-10 bg-[#060a1f]/92 border border-white/5 rounded-2xl p-3.5 backdrop-blur-md shadow-xl flex flex-col items-center">
                  <div className="text-[#00cfff] text-[10px] font-black uppercase tracking-widest mb-2 text-center">
                    {currentSelectedBlob.level >= 20 ? (
                      "✨ Max Evolution Reached"
                    ) : (
                      `Next evolution at Lv. ${currentSelectedBlob.level < 5 ? 5 : currentSelectedBlob.level < 10 ? 10 : 20}`
                    )}
                  </div>
                  
                  {/* Segmented Indicator Dots (5 cells representing evolution percentage) */}
                  <div className="flex gap-2 items-center w-full justify-center mb-1.5">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const isActive = evolutionProgress >= (idx + 1) * 20;
                      return (
                        <div
                          key={idx}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            isActive 
                              ? 'bg-gradient-to-r from-[#0052ff] to-[#00d2ff] shadow-[0_0_8px_rgba(0,170,255,0.7)]' 
                              : 'bg-white/10 border border-white/5'
                          }`}
                        />
                      );
                    })}
                  </div>
                  
                  <div className="text-[9px] text-slate-400 font-mono text-center leading-normal">
                    {currentSelectedBlob.level >= 20 ? (
                      "Your blob has unlocked final cosmic power!"
                    ) : (
                      `Earn XP to evolve (Form progress: ${Math.round(evolutionProgress)}%)`
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Call To Actions Block (matching Phone 1) */}
            <div className="flex flex-col px-4 mb-3 flex-shrink-0">
              <button
                onClick={() => {
                  setCurrentScreen('expeditions');
                  updateState((prev) => {
                    if (prev.selectedId) {
                      prev.expPickId = prev.selectedId;
                      prev.expPickIds = [prev.selectedId];
                    }
                    return prev;
                  });
                }}
                className="relative overflow-hidden w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#0044ff] via-[#008cff] to-[#00cfff] hover:brightness-110 active:scale-[0.98] text-white transition-all duration-300 shadow-xl shadow-blue-600/25 border border-cyan-400/35 cursor-pointer text-left flex items-center justify-between group"
              >
                {/* Neon accent glow overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(0,255,255,0.25)_0%,transparent_60%)] pointer-events-none group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner transition-transform duration-500 group-hover:rotate-12 group-hover:scale-105">
                    <Compass className="w-5 h-5 text-white animate-spin-slow" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black tracking-widest uppercase text-white drop-shadow-sm">
                      Send on Expedition
                    </span>
                    <span className="text-[8.5px] font-semibold text-cyan-100/80 tracking-wide font-mono mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                      Explore L2 zones & harvest Cubes
                    </span>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-lg bg-black/20 group-hover:bg-black/35 flex items-center justify-center border border-white/5 transition-colors relative z-10">
                  <span className="text-[10px] font-mono font-black text-white group-hover:translate-x-0.5 transition-transform duration-300">
                    →
                  </span>
                </div>
              </button>
            </div>

            {/* Owned Blobs section */}
            <div className="px-4 py-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-300 text-sm font-semibold">My Blobs</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsBlobDexOpen(true)}
                    className="px-2.5 py-1.5 bg-[#00cfff]/10 hover:bg-[#00cfff]/20 border border-[#00cfff]/30 rounded-full text-[#00cfff] text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📖 Gallery</span>
                  </button>
                  <button
                    onClick={handleOpenSummonModal}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-blue-900/60 to-indigo-950/60 hover:from-blue-900/80 hover:to-indigo-950/80 border border-blue-500/30 rounded-full text-slate-300 text-[10px] font-bold active:scale-95 transition-all shadow-md shadow-blue-500/5 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#ffaa00]" />
                    <span>Summon (1500 💠)</span>
                  </button>
                </div>
              </div>

              {/* Horizontal Scroll of Blob cards */}
              <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar px-1">
                {state.blobs.map((blob) => {
                  const bp = P[blob.personality] || P.happy;
                  const isSelected = blob.id === state.selectedId;
                  const isBusy = state.activeExpeditions?.some((exp) => exp.blobIds?.includes(blob.id) || exp.blobId === blob.id) || false;

                  return (
                    <div
                      key={blob.id}
                      onClick={() => handleSelectBlob(blob.id)}
                      className={`flex-shrink-0 w-[90px] rounded-2xl p-2.5 flex flex-col items-center relative border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/15'
                          : 'bg-black/30 hover:bg-black/40'
                      }`}
                      style={{
                        borderColor: isSelected ? bp.glow : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <BlobCanvas personality={blob.personality} size={58} animate={isSelected} evolutionStage={getEvolutionStage(blob.level)} />
                      
                      {/* Active Status Badge */}
                      <span
                        className={`absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                          isBusy
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isBusy ? 'Away' : 'Idle'}
                      </span>

                      <div className="text-slate-200 text-[10px] font-bold mt-2 text-center whitespace-nowrap">
                        {bp.emoji} {bp.name}
                      </div>
                      <div className="text-slate-400 text-[9px] mt-0.5 flex items-center gap-1">
                        <span>Lv. {blob.level}</span>
                        {getEvolutionStage(blob.level) > 0 && (
                          <span className="text-[10px]" title={EVOLUTION_NAMES[getEvolutionStage(blob.level)]}>
                            {EVOLUTION_EMOJIS[getEvolutionStage(blob.level)]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Blob Personality Details Panel */}
            {currentSelectedBlob && (() => {
              const stats = getBlobStats(currentSelectedBlob.personality, currentSelectedBlob.level);
              return (
                <div className="mx-4 mt-2 mb-6 bg-black/40 border border-white/5 rounded-2xl p-3.5 flex flex-col gap-3 backdrop-blur-md">
                  <div className="flex items-center gap-3.5">
                    <span className="text-3xl leading-none">{currentSelectedBlobInfo.emoji}</span>
                    <div className="flex-1">
                      <h4 className="text-white text-xs font-bold">
                        {currentSelectedBlobInfo.name} <span className="text-slate-400 font-normal">(Lv.{currentSelectedBlob.level})</span>
                      </h4>
                      <p className="text-slate-400 text-[10px] mt-1 leading-relaxed font-mono">
                        Bonus: {currentSelectedBlobInfo.bonus}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Stats Grid with Formula details */}
                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2.5">
                    <div className="bg-[#020617]/40 border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                      <span className="text-[7px] text-slate-400 font-mono tracking-wider uppercase">💪 Power</span>
                      <span className="text-xs font-black text-emerald-400 mt-1 font-mono">{stats.power}</span>
                      <span className="text-[7px] text-slate-500 font-mono mt-0.5 text-center leading-none">+{Math.round(stats.power * 0.2 * 10) / 10}% Cubes</span>
                    </div>
                    <div className="bg-[#020617]/40 border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                      <span className="text-[7px] text-slate-400 font-mono tracking-wider uppercase">⚡ Speed</span>
                      <span className="text-xs font-black text-cyan-400 mt-1 font-mono">{stats.speed}</span>
                      <span className="text-[7px] text-slate-500 font-mono mt-0.5 text-center leading-none">-{Math.round(Math.min(50, stats.speed * 0.3) * 10) / 10}% Time</span>
                    </div>
                    <div className="bg-[#020617]/40 border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                      <span className="text-[7px] text-slate-400 font-mono tracking-wider uppercase">🍀 Luck</span>
                      <span className="text-xs font-black text-amber-400 mt-1 font-mono">{stats.luck}</span>
                      <span className="text-[7px] text-slate-500 font-mono mt-0.5 text-center leading-none">+{Math.round(stats.luck * 0.4 * 10) / 10}% Crit</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ 2. EXPEDITIONS SCREEN ══ */}
        {currentScreen === 'expeditions' && (
          <div className="flex flex-col flex-1 p-4 relative z-10">
            <h2 className="text-white text-lg font-bold mb-3 font-display">Expeditions</h2>

            {/* Energy Recovery Info Box */}
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/20 rounded-2xl flex items-center gap-3 shadow-md">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400/25 animate-pulse" />
              </div>
              <div className="flex-1 leading-tight">
                <h4 className="text-white text-[11px] font-black uppercase tracking-wider">Energy Recovery Speed</h4>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  Regenerating <span className="text-emerald-400 font-extrabold">+1 ⚡</span> every <span className="text-white font-bold">{hasSleepy ? '3.5' : '5'} mins</span>.
                  {hasSleepy ? (
                    <span className="text-purple-400 block text-[9px] mt-0.5 font-bold">😴 Sleepy Blob Buff is Active (+30% speed!)</span>
                  ) : (
                    <span className="text-slate-500 block text-[9px] mt-0.5">Tip: Keep a Sleepy Blob to boost recovery speed by 30%!</span>
                  )}
                </p>
              </div>
            </div>

            {/* Active Expeditions List widget */}
            {state.activeExpeditions && state.activeExpeditions.length > 0 ? (
              <div className="flex flex-col gap-2.5 mb-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                {state.activeExpeditions.map((exp, expIdx) => {
                  const timeLeft = Math.max(0, exp.endTime - Date.now());
                  const pct = Math.min(
                    100,
                    ((exp.duration * 1000 - timeLeft) / (exp.duration * 1000)) * 100
                  );
                  return (
                    <div key={expIdx} className="bg-[#060a1f]/92 border border-[#0055ff]/35 rounded-xl p-3 backdrop-blur-md animate-fade-in shadow-lg">
                      <div className="text-[#00aaff] text-[9px] font-bold tracking-wider uppercase mb-1.5 flex items-center justify-between">
                        <span>🟢 Active Expedition #{expIdx + 1}</span>
                        <span className="text-slate-400 font-mono text-[8px]">{exp.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-slate-200 text-[10px] font-medium leading-none">
                            Away: {(() => {
                              const activeIds = exp.blobIds || (exp.blobId ? [exp.blobId] : []);
                              return activeIds.map(id => {
                                const b = state.blobs.find(x => x.id === id);
                                return b ? `${P[b.personality]?.emoji || '👾'} ${P[b.personality]?.name || 'Blob'}` : '👾';
                              }).join(', ');
                            })()}
                          </p>
                        </div>
                        <div className="text-[#00ccff] text-xs font-bold font-mono">
                          {formatMs(timeLeft)}
                        </div>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-sky-300 transition-all duration-1000 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Select Blob scroll area */}
            <div className="mb-4">
              <div className="text-slate-400 text-xs mb-2">Select idle blob to send:</div>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar px-1">
                {state.blobs.map((blob) => {
                  const bp = P[blob.personality] || P.happy;
                  const currentPickedId = state.expPickId || state.selectedId || state.blobs[0]?.id;
                  const isPicked = blob.id === currentPickedId;
                  const isBusy = state.activeExpeditions?.some((exp) => exp.blobIds?.includes(blob.id) || exp.blobId === blob.id) || false;

                  return (
                    <div
                      key={blob.id}
                      onClick={() => !isBusy && handlePickBlobForExp(blob.id)}
                      className={`flex-shrink-0 w-[84px] rounded-xl p-2 flex flex-col items-center relative border cursor-pointer transition-all ${
                        isPicked
                          ? 'bg-blue-600/20 border-blue-500 shadow-md'
                          : 'bg-[#060a1f]/85 border-white/10 hover:bg-black/40'
                      } ${isBusy ? 'opacity-75 cursor-not-allowed' : ''}`}
                      style={{
                        borderColor: isPicked ? bp.glow : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {isPicked && (
                        <span className="absolute top-1.5 left-1.5 text-[8px] font-black w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center border border-white/20 shadow-md">
                          ✓
                        </span>
                      )}
                      <BlobCanvas personality={blob.personality} size={50} animate={isPicked} />
                      <span
                        className={`absolute top-1.5 right-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded-full border ${
                          isBusy
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isBusy ? 'Away' : 'Idle'}
                      </span>
                      <div className="text-slate-200 text-[10px] font-bold mt-1 text-center whitespace-nowrap">
                        {bp.name}
                      </div>
                      <div className="text-slate-400 text-[8px]">Lv. {blob.level}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Zones Grid list */}
            <div className="flex flex-col gap-2.5 pb-6">
              {ZONES.map((zone) => {
                const pickedBlobs = getExpPickBlobs();
                const isAnyBlobBusy = pickedBlobs.some((b) => {
                  return state.activeExpeditions?.some((exp) => exp.blobIds?.includes(b.id) || exp.blobId === b.id);
                });
                const isUnderleveled = pickedBlobs.some((b) => b.level < zone.unlockLv);

                 const tierData = [
                  { 
                    color: '#0088ff', 
                    bgGradient: 'from-[#0088ff]/25 to-[#0088ff]/8', 
                    borderColor: 'border-[#0088ff]/55',
                    glowColor: 'shadow-md shadow-[#0088ff]/25',
                    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
                    tierLabel: 'Tier I'
                  },
                  { 
                    color: '#6600ff', 
                    bgGradient: 'from-[#6600ff]/25 to-[#6600ff]/8', 
                    borderColor: 'border-[#6600ff]/55',
                    glowColor: 'shadow-md shadow-[#6600ff]/25',
                    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
                    tierLabel: 'Tier II'
                  },
                  { 
                    color: '#9900cc', 
                    bgGradient: 'from-[#9900cc]/25 to-[#9900cc]/8', 
                    borderColor: 'border-[#9900cc]/55',
                    glowColor: 'shadow-md shadow-[#9900cc]/25',
                    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/35',
                    tierLabel: 'Tier III'
                  },
                  { 
                    color: '#cc3300', 
                    bgGradient: 'from-[#cc3300]/25 to-[#cc3300]/8', 
                    borderColor: 'border-[#cc3300]/55',
                    glowColor: 'shadow-md shadow-[#cc3300]/25',
                    badge: 'bg-red-500/15 text-red-300 border-red-500/35',
                    tierLabel: 'Tier IV'
                  },
                  { 
                    color: '#ff6600', 
                    bgGradient: 'from-[#ff6600]/25 to-[#ff6600]/8', 
                    borderColor: 'border-[#ff6600]/55',
                    glowColor: 'shadow-md shadow-[#ff6600]/25',
                    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
                    tierLabel: 'Tier V'
                  },
                  { 
                    color: '#ccaa00', 
                    bgGradient: 'from-[#ccaa00]/25 to-[#ccaa00]/8', 
                    borderColor: 'border-[#ccaa00]/55',
                    glowColor: 'shadow-md shadow-[#ccaa00]/25',
                    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
                    tierLabel: 'Tier VI'
                  }
                ][zone.tier - 1] || { 
                  color: '#94a3b8', 
                  bgGradient: 'from-slate-800/40 to-slate-800/15', 
                  borderColor: 'border-slate-700', 
                  glowColor: 'shadow-none',
                  badge: 'bg-slate-500/15 text-slate-300 border-slate-500/35',
                  tierLabel: 'Unknown'
                };

                 return (
                  <div
                    key={zone.id}
                    onClick={() => {
                      if (isUnderleveled) {
                        triggerToast(`Requires level ${zone.unlockLv} blob!`);
                        return;
                      }
                      if (isAnyBlobBusy) {
                        triggerToast('Selected blob(s) are already away on an expedition!');
                        return;
                      }
                      handleStartExpedition(zone.id);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border bg-[#0b0f2a] bg-gradient-to-r ${tierData.bgGradient} ${tierData.borderColor} ${tierData.glowColor} transition-all relative overflow-hidden group ${
                      isUnderleveled ? 'opacity-85 cursor-not-allowed' : 'hover:scale-[1.015] hover:translate-x-0.5 hover:brightness-110 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {/* Color Accent Indicator Strip on Left */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ backgroundColor: tierData.color }}
                    />
                    
                    {/* Zone Emoji with dynamic matching colored ring background */}
                    <div 
                      className="text-xl w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-1 border"
                      style={{ 
                        backgroundColor: `${tierData.color}15`, 
                        borderColor: `${tierData.color}25` 
                      }}
                    >
                      {zone.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-xs font-bold truncate">{zone.name}</span>
                        <span className={`text-[8px] font-mono px-1 py-0.2 rounded border ${tierData.badge}`}>
                          {tierData.tierLabel}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[9px] truncate mt-0.5">{zone.sub}</div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
                      {(() => {
                        let adjustedDuration = zone.dur;
                        let speedPctReduction = 0;
                        if (pickedBlobs && pickedBlobs.length > 0) {
                          const statsList = pickedBlobs.map((b) => getBlobStats(b.personality, b.level));
                          const avgSpeed = statsList.reduce((acc, s) => acc + s.speed, 0) / statsList.length;
                          const speedBonus = Math.min(0.50, avgSpeed * 0.003);
                          adjustedDuration = Math.round(zone.dur * (1 - speedBonus));
                          speedPctReduction = Math.round(speedBonus * 100);
                        }
                        return (
                          <>
                            <div className="text-xs font-bold font-mono text-white flex items-center gap-0.5">
                              <span className="text-[10px]">💠</span> {zone.reward[0]}–{zone.reward[1]}
                            </div>
                            <div className="text-[8px] text-slate-400 font-mono">
                              ⚡ {zone.cost} · ⏱️ {formatDuration(adjustedDuration)}
                              {speedPctReduction > 0 && (
                                <span className="text-emerald-400 ml-1 font-extrabold">(-{speedPctReduction}%)</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                      <div className="text-[8px] text-[#00ccff] font-mono">
                        +{zone.xp} XP
                      </div>
                      {isUnderleveled && (
                        <div className="text-[8px] text-[#ff8800] flex items-center gap-0.5 mt-0.5">
                          <Lock className="w-2 h-2" />
                          <span>Lv.{zone.unlockLv} req</span>
                        </div>
                      )}
                      {isAnyBlobBusy && !isUnderleveled && (
                        <div className="text-[8px] text-slate-400 font-semibold mt-0.5">Away…</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ 3. UPGRADES SCREEN ══ */}
        {currentScreen === 'upgrades' && currentSelectedBlob && (
          <div className="flex flex-col flex-1 p-4">
            {/* Banner info */}
            <div className="bg-black/35 border border-[#ffaa00]/25 rounded-2xl p-4 backdrop-blur-md mb-4">
              <h2 className="text-white text-base font-bold font-display">⚡ Upgrades & Evolution</h2>
              <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                Unlock permanent stat boosts and evolve your Blobs to access advanced passive branches.
              </p>
            </div>

            {/* Horizontal Scroll of Blob selectors */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar flex-shrink-0 border-b border-white/5 px-1">
              {state.blobs.map((blob) => {
                const bp = P[blob.personality] || P.happy;
                const isSelected = blob.id === state.selectedId;
                const evoStage = getEvolutionStage(blob.level);
                return (
                  <div
                    key={blob.id}
                    onClick={() => handleSelectBlob(blob.id)}
                    className={`flex-shrink-0 w-[84px] rounded-xl p-2 flex flex-col items-center relative border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-[#ffaa00]/70 text-white shadow-md shadow-[#ffaa00]/10'
                        : 'bg-[#060a1f]/85 border-white/10 hover:bg-black/40 text-slate-400'
                    }`}
                    style={{
                      borderColor: isSelected ? '#ffaa00' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 left-1.5 text-[8px] font-black w-4 h-4 rounded-full bg-[#ffaa00] text-black flex items-center justify-center border border-white/20 shadow-md">
                        ✓
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
                      Lv.{blob.level}
                    </span>
                    <div className="mt-2.5">
                      <BlobCanvas personality={blob.personality} size={50} animate={isSelected} evolutionStage={evoStage} />
                    </div>
                    <div className="text-slate-200 text-[10px] font-bold mt-1 text-center whitespace-nowrap">
                      {bp.name}
                    </div>
                    <div className="text-slate-500 text-[7px] uppercase tracking-wider font-extrabold mt-0.5 font-mono">
                      {EVOLUTION_NAMES[evoStage].split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Blob Header details */}
            <div className="px-4 py-3 bg-[#0a1130]/40 border border-white/5 rounded-2xl flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center">
                  <BlobCanvas personality={currentSelectedBlob.personality} size={36} animate={true} evolutionStage={getEvolutionStage(currentSelectedBlob.level)} />
                </div>
                <div>
                  <h4 className="text-white text-xs font-bold uppercase tracking-wide">
                    {P[currentSelectedBlob.personality].name} Blob
                  </h4>
                  <p className="text-[#ffaa00] text-[9px] font-semibold mt-0.5 font-mono uppercase tracking-widest">
                    Lv.{currentSelectedBlob.level} {EVOLUTION_NAMES[getEvolutionStage(currentSelectedBlob.level)]}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-slate-400 text-[8px] font-mono">Available Balance</p>
                <p className="text-[#00cfff] text-xs font-black font-mono mt-0.5">
                  💠 {formatNumber(state.cubes)}
                </p>
              </div>
            </div>

            {/* Upgrades content list */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <UpgradesScreen
                selectedBlob={currentSelectedBlob}
                cubes={state.cubes}
                onUpgrade={handleUpgradeBlob}
              />
            </div>
          </div>
        )}

        {/* ══ 4. SHOP SCREEN ══ */}
        {currentScreen === 'shop' && (
          <div style={{ padding: '16px 14px 24px' }} className="space-y-5">

            {/* Banner */}
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,140,0,0.2)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div className="w-11 h-11 rounded-xl bg-[#0052ff]/10 border border-[#0052ff]/25 flex items-center justify-center text-[#00cfff] shadow-md shadow-[#0052ff]/5 flex-shrink-0">
                <Coins className="w-5.5 h-5.5" />
              </div>
              <div>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Cube Market</p>
                <p style={{ color: 'rgba(255,180,80,0.7)', fontSize: 10, marginTop: 3 }}>
                  Spend your 💠 Cubes on summoning & energy refills
                </p>
              </div>
            </div>

            {/* Summon section */}
            <div>
              <p style={{
                color: 'rgba(255,180,80,0.5)',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Summon
              </p>

              {/* Summon card */}
              <div
                onClick={handleOpenSummonModal}
                className="group"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052ff]/15 via-[#00cfff]/20 to-transparent border border-[#00cfff]/35 flex items-center justify-center relative overflow-hidden shadow-lg shadow-[#00cfff]/5 flex-shrink-0 group-hover:border-[#00cfff]/60 transition-colors duration-300">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,207,255,0.15)_0%,transparent_70%)] animate-pulse" />
                  <Atom className="w-6 h-6 text-[#00cfff] animate-spin-slow relative z-10" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Summon Blob</p>
                  <p style={{ color: 'rgba(180,200,255,0.5)', fontSize: 10, marginTop: 3 }}>
                    Random personality · starts at Lv.1
                  </p>
                </div>
                <div style={{
                  background: 'rgba(200,100,0,0.2)',
                  border: '1px solid rgba(255,140,0,0.25)',
                  borderRadius: 8,
                  padding: '5px 12px',
                  color: '#ffaa44',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  1500 💠
                </div>
              </div>
            </div>

            {/* Energy Refill section */}
            <div>
              <p style={{
                color: 'rgba(255,180,80,0.5)',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Energy Recharges
              </p>

              {/* Buy Energy Card */}
              <div
                onClick={() => handleBuyEnergy(50, 500)}
                className="group"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 via-orange-500/20 to-transparent border border-orange-400/35 flex items-center justify-center relative overflow-hidden shadow-lg shadow-orange-500/5 flex-shrink-0 group-hover:border-orange-400/60 transition-colors duration-300">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15)_0%,transparent_70%)] animate-pulse" />
                  <Zap className="w-6 h-6 text-amber-400 fill-amber-400/20 relative z-10 animate-bounce" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Refill +50 Energy</p>
                  <p style={{ color: 'rgba(180,200,255,0.5)', fontSize: 10, marginTop: 3 }}>
                    Instantly adds 50 energy to your pool
                  </p>
                </div>
                <div style={{
                  background: 'rgba(200,100,0,0.2)',
                  border: '1px solid rgba(255,140,0,0.25)',
                  borderRadius: 8,
                  padding: '5px 12px',
                  color: '#ffaa44',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  500 💠
                </div>
              </div>
            </div>

            {/* Energy Info Section */}
            <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl space-y-2">
              <h4 className="text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <span>⚡</span> Passive Energy Regeneration
              </h4>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Your energy regenerates passively in the background over time:
              </p>
              <ul className="text-[10px] text-slate-300 space-y-1 list-disc pl-4 font-medium">
                <li>Standard Rate: <strong className="text-white">+1 ⚡ every 5 minutes</strong> (300 seconds).</li>
                <li>Sleepy Personality Buff: <strong className="text-emerald-400">+30% faster regeneration speed</strong> (+1 ⚡ every 3.5 minutes)!</li>
                <li>Your energy caps at <strong className="text-white">{state.energyMax} ⚡</strong>. Refills from the shop can exceed this up to the max capacity.</li>
              </ul>
              {hasSleepy && (
                <div className="mt-2 text-[9.5px] text-purple-400 font-extrabold bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl">
                  😴 Sleepy Blob Active: Regeneration rate boosted to 3.5 minutes!
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══ 5. QUESTS SCREEN ══ */}
        {currentScreen === 'quests' && (
          <div className="flex flex-col flex-1 p-4">
            <h2 className="text-[#ffdc78] text-lg font-bold font-display mb-1">Daily Quests</h2>
            <div className="bg-black/35 border border-[#c8a03c]/20 rounded-2xl p-4 backdrop-blur-md mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[#ffdc78] text-xs font-bold uppercase tracking-wider">
                  📋 Today's Missions
                </h3>
                <p className="text-amber-500/65 text-[10px] mt-1 font-medium font-mono">
                  Resets in {formatMs(Math.max(0, 86400000 - (Date.now() - state.questsReset)))}
                </p>
              </div>
              <span className="text-4xl opacity-20">📜</span>
            </div>

            {/* Quests Lists */}
            <div className="flex flex-col gap-3 pb-6">
              {QUEST_CFG.map((quest) => {
                const isCompleted = state.questDone[quest.id];
                const isClaimed = state.questClaimed?.[quest.id] || false;
                const currentVal =
                  quest.id === 'exp'
                    ? state.expeditionsToday
                    : quest.id === 'cubes'
                    ? state.cubesCollectedToday
                    : state.tapsToday || 0;

                const progressValue = Math.min(quest.target, currentVal);
                const pct = (progressValue / quest.target) * 100;

                return (
                  <div
                    key={quest.id}
                    className={`bg-black/35 border rounded-2xl p-4 backdrop-blur-sm relative transition-all ${
                      isClaimed
                        ? 'border-emerald-500/10 opacity-75'
                        : isCompleted
                        ? 'border-amber-500/30 shadow-lg shadow-amber-500/5 animate-pulse'
                        : 'border-white/5'
                    }`}
                    style={{ borderLeft: `4px solid ${quest.color}` }}
                  >
                    <div className="flex items-start gap-3.5 mb-2.5">
                      <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-xl">
                        {quest.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-xs font-bold leading-none">
                          {quest.name}
                        </div>
                        <div className="text-slate-400 text-[10px] mt-1.5">{quest.desc}</div>
                      </div>
                    </div>

                    {/* Rewards indicators */}
                    <div className="flex gap-2 mb-3">
                      <span className="bg-blue-600/10 border border-blue-500/20 text-white font-semibold rounded px-2 py-0.5 text-[9px] font-mono">
                        💠 {quest.cubes}
                      </span>
                      <span className="bg-purple-600/10 border border-purple-500/20 text-purple-300 font-semibold rounded px-2 py-0.5 text-[9px] font-mono">
                        +{quest.xp} XP
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: quest.color,
                        }}
                      />
                    </div>

                    {/* Numerical or completed state */}
                    <div className="mt-3.5 flex items-center justify-between">
                      {isClaimed ? (
                        <div className="text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>✅ Reward Claimed!</span>
                        </div>
                      ) : isCompleted ? (
                        <button
                          onClick={() => handleClaimQuestReward(quest.id)}
                          className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 active:scale-95 transition-all rounded-xl text-black text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-lg shadow-amber-500/20"
                        >
                          <span>Claim Reward 🎁</span>
                        </button>
                      ) : (
                        <div className="text-slate-400 text-[10px] font-semibold font-mono">
                          Progress: {progressValue} / {quest.target}
                        </div>
                      )}

                      {!isCompleted && (
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV BAR ── */}
      <nav className="flex justify-around items-center py-1.5 pb-max(8px,env(safe-area-inset-bottom)) border-t border-white/5 bg-black/70 backdrop-blur-2xl flex-shrink-0 relative z-10 px-2 gap-0.5">
        {[
          { id: 'home', label: 'Home', icon: Cpu },
          { id: 'expeditions', label: 'Explore', icon: Radar },
          { id: 'upgrades', label: 'Upgrades', icon: Zap },
          { id: 'shop', label: 'Shop', icon: Database },
          { id: 'quests', label: 'Quests', icon: Award, badge: true }
        ].map((item) => {
          const isActive = currentScreen === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentScreen(item.id as any);
                if (item.id === 'expeditions') {
                  updateState((prev) => {
                    if (prev.selectedId) {
                      prev.expPickId = prev.selectedId;
                      prev.expPickIds = [prev.selectedId];
                    }
                    return prev;
                    });
                }
              }}
              className="flex-1 flex flex-col items-center justify-center cursor-pointer relative transition-all group py-0.5"
            >
              <div className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${
                isActive 
                  ? 'transform -translate-y-0.5' 
                  : 'opacity-70 group-hover:opacity-100 group-hover:-translate-y-0.5'
              }`}>
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-[#0052ff]/20 to-[#00cfff]/10 border border-[#00cfff]/35 text-[#00cfff] shadow-md shadow-[#00cfff]/10 scale-105'
                    : 'bg-white/0 border border-transparent text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Icon className={`w-3.5 h-3.5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className={`text-[7px] font-extrabold uppercase tracking-widest transition-colors duration-300 ${
                  isActive ? 'text-[#00cfff]' : 'text-slate-500 group-hover:text-slate-300'
                }`}>
                  {item.label}
                </span>
              </div>

              {item.badge && QUEST_CFG.some(
                (q) => state.questDone[q.id] && !state.questClaimed?.[q.id]
              ) && (
                <span className="absolute top-1 right-5 w-1 h-1 bg-amber-400 rounded-full animate-pulse shadow-lg shadow-amber-400/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Naming update modal */}
      <NameModal
        isOpen={isNameModalOpen}
        currentName={state.playerName}
        onClose={() => setIsNameModalOpen(false)}
        onSave={handleSaveName}
      />

      {/* Wallet connection modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setInitialConnectType(null);
        }}
        walletAddress={walletAddress || ''}
        onConnect={handleConnectWalletType}
        onDisconnect={handleDisconnectWallet}
        triggerToast={triggerToast}
        initialConnectType={initialConnectType}
      />

      {/* BlobDex / Gallery modal */}
      <BlobDexModal
        isOpen={isBlobDexOpen}
        onClose={() => setIsBlobDexOpen(false)}
        blobs={state.blobs}
        cubes={state.cubes}
        onUnlockSpecies={handleUnlockSpecies}
        onPreviewSpecies={(p) => {
          setPreviewPersonality(p);
          setIsBlobDexOpen(false);
          triggerToast(`✨ Previewing ${P[p].name}! Look at the home stage.`);
        }}
        onClosePreview={() => setPreviewPersonality(null)}
        previewingPersonality={previewPersonality}
      />

      {/* Upgrades & Evolution Modal Overlay */}
      {isUpgradesOpen && currentSelectedBlob && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center z-50 animate-fade-in p-0 sm:p-4">
          <div className="bg-[#070e28] border-t sm:border border-[#ffaa00]/20 rounded-t-3xl sm:rounded-3xl w-full max-w-[420px] h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/40 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h3 className="text-white text-sm font-black tracking-tight uppercase">Upgrades & Evolution</h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Evolve your Blobs and unlock ultimate passive skills</p>
                </div>
              </div>
              <button
                onClick={() => setIsUpgradesOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal Scroll of Blob selectors inside modal */}
            <div className="flex gap-2 overflow-x-auto px-5 py-2.5 bg-black/30 border-b border-white/5 no-scrollbar flex-shrink-0">
              {state.blobs.map((blob) => {
                const bp = P[blob.personality] || P.happy;
                const isSelected = blob.id === state.selectedId;
                return (
                  <button
                    key={blob.id}
                    onClick={() => handleSelectBlob(blob.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-[#ffaa00]/60 text-white shadow-md shadow-[#ffaa00]/5'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs">{bp.emoji}</span>
                    <span className="text-[10px] font-bold whitespace-nowrap">{bp.name} (Lv.{blob.level})</span>
                  </button>
                );
              })}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {/* Selected blob summary and balance */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-[#0a1130]/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black/20 rounded-xl border border-white/5 flex items-center justify-center">
                    <BlobCanvas personality={currentSelectedBlob.personality} size={42} animate={true} evolutionStage={getEvolutionStage(currentSelectedBlob.level)} />
                  </div>
                  <div>
                    <h4 className="text-white text-xs font-bold uppercase tracking-wide">
                      {P[currentSelectedBlob.personality].name} Blob
                    </h4>
                    <p className="text-[#ffaa00] text-[9px] font-semibold mt-0.5 font-mono uppercase tracking-widest">
                      Lv.{currentSelectedBlob.level} {EVOLUTION_NAMES[getEvolutionStage(currentSelectedBlob.level)]}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-slate-400 text-[9px] font-mono">Your Balance</p>
                  <p className="text-[#00cfff] text-xs font-black font-mono mt-0.5">
                    💠 {formatNumber(state.cubes)}
                  </p>
                </div>
              </div>

              {/* Upgrades list */}
              <UpgradesScreen
                selectedBlob={currentSelectedBlob}
                cubes={state.cubes}
                onUpgrade={handleUpgradeBlob}
              />
            </div>
          </div>
        </div>
      )}

      {/* Level Up Celebration Modal */}
      <LevelUpModal
        isOpen={levelUpInfo !== null}
        info={levelUpInfo}
        onClose={() => setLevelUpInfo(null)}
      />

      {/* Summon Celebration Modal */}
      <SummonModal
        isOpen={isSummonModalOpen}
        onClose={() => {
          setIsSummonModalOpen(false);
          setDirectRevealPersonality(null);
        }}
        onConfirmSummon={handleExecuteSummon}
        cubes={state.cubes}
        directRevealPersonality={directRevealPersonality}
        rawWalletAddress={rawWalletAddress}
        triggerToast={triggerToast}
      />

      {/* Builder Hub / Developer Station Modal */}
      <BuilderHubModal
        isOpen={isBuilderHubOpen}
        onClose={() => setIsBuilderHubOpen(false)}
        rawWalletAddress={rawWalletAddress}
        state={state}
        updateState={updateState}
        triggerToast={triggerToast}
      />

      {/* Custom notification Toast */}
      <Toast message={toastMessage} onClear={() => setToastMessage('')} />
    </div>
  );
}
