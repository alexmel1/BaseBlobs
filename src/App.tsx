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
  Atom,
  Cloud,
  RefreshCw,
  Code,
} from 'lucide-react';

import { GameState, Blob, ActiveExpedition, PersonalityType, ExpeditionEventType, TraitId } from './types';
import { P, PKEYS, ZONES, QUEST_CFG, XP4LV, EREGEN, getBlobStats, getEvolutionStage, EVOLUTION_EMOJIS, EVOLUTION_NAMES, UPGRADES, canUpgrade, getUpgradeSlots, applyUpgrades, DEFAULT_NEW_BLOB_FIELDS, DEFAULT_GAMESTATE_NEW_FIELDS, DEFAULT_BLOB_MOOD, EXPEDITION_EVENTS, EVENT_WEIGHTS } from './data';
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
import { NetworkMap } from './components/NetworkMap';
import { useNetworkMap, calcBlobPower } from './hooks/useNetworkMap';
import { FusionModal } from './components/FusionModal';
import { ProfileModal } from './components/ProfileModal';
import { FUSION_CONFIG, TRAITS, TRAIT_KEYS } from './data';
import { playTapSound, playExpeditionCompleteSound, playLevelUpSound } from './utils/audio';
import { saveGameState, loadGameState, isOfflineError, subscribeToGameState, RevConflictError } from './lib/syncService';
import { useReactor } from './hooks/useReactor';
import { ReactorModal } from './components/ReactorModal';
import { useAccount, useDisconnect } from 'wagmi';
import { appKit } from './lib/web3Config';

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
    blobs: [{ id: 'b1', personality: 'happy', level: 1, xp: 0, upgrades: { speed: 0, harvest: 0, fortune: 0 }, ...DEFAULT_NEW_BLOB_FIELDS }],
    selectedId: 'b1',
    expPickId: 'b1',
    expPickIds: ['b1'],
    nextId: 2,
    activeExpedition: null,
    activeExpeditions: [],
    verifiedTxHashes: [],
    ...DEFAULT_GAMESTATE_NEW_FIELDS,
    hasOGBadge: false,
    ogBadgePurchasedAt: null,
    initialized: false,
  };
}

export function validateAndMigrateState(parsed: any): GameState {
  const defaultState = getDefaultState();
  if (!parsed || typeof parsed !== 'object') {
    return { ...defaultState, initialized: true };
  }

  const rawBlobs = Array.isArray(parsed.blobs) && parsed.blobs.length > 0
    ? parsed.blobs
    : defaultState.blobs;

  const migratedBlobs = rawBlobs.map((b: any, index: number) => ({
    id: b?.id || `b${index + 1}`,
    name: b?.name || `Blob #${index + 1}`,
    personality: b?.personality || 'happy',
    level: typeof b?.level === 'number' ? b.level : 1,
    xp: typeof b?.xp === 'number' ? b.xp : (typeof b?.experience === 'number' ? b.experience : 0),
    happiness: typeof b?.happiness === 'number' ? b.happiness : 80,
    upgrades: {
      speed: b?.upgrades?.speed || 0,
      harvest: b?.upgrades?.harvest || 0,
      fortune: b?.upgrades?.fortune || 0,
    },
    mood: b?.mood || DEFAULT_BLOB_MOOD,
    trait: b?.trait ?? null,
    isRadiant: Boolean(b?.isRadiant),
    totalExpeditions: b?.totalExpeditions || 0,
    totalCubesEarned: b?.totalCubesEarned || 0,
    nodesHeld: Array.isArray(b?.nodesHeld) ? b.nodesHeld : [],
  }));

  const selectedId = migratedBlobs.some((b: any) => b.id === parsed.selectedId)
    ? parsed.selectedId
    : migratedBlobs[0].id;

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
      exp: Boolean(parsed.questDone?.exp),
      cubes: Boolean(parsed.questDone?.cubes),
      sends: Boolean(parsed.questDone?.sends),
      taps: Boolean(parsed.questDone?.taps),
    },
    questClaimed: {
      exp: Boolean(parsed.questClaimed?.exp),
      cubes: Boolean(parsed.questClaimed?.cubes),
      sends: Boolean(parsed.questClaimed?.sends),
      taps: Boolean(parsed.questClaimed?.taps),
    },
    questsReset: parsed.questsReset || Date.now(),
    blobs: migratedBlobs,
    selectedId: selectedId,
    expPickId: selectedId,
    expPickIds: Array.isArray(parsed.expPickIds) && parsed.expPickIds.length > 0 ? parsed.expPickIds : [selectedId],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : migratedBlobs.length + 1,
    activeExpedition: parsed.activeExpedition || null,
    activeExpeditions: Array.isArray(parsed.activeExpeditions) ? parsed.activeExpeditions : (parsed.activeExpedition ? [parsed.activeExpedition] : []),
    verifiedTxHashes: Array.isArray(parsed.verifiedTxHashes) ? parsed.verifiedTxHashes : [],
    blobCharms: typeof parsed.blobCharms === 'number' ? parsed.blobCharms : 0,
    lastExpeditionEvent: parsed.lastExpeditionEvent || null,
    lastFusionTime: parsed.lastFusionTime || 0,
    totalCubesAllTime: typeof parsed.totalCubesAllTime === 'number' ? parsed.totalCubesAllTime : 0,
    totalExpeditionsAllTime: typeof parsed.totalExpeditionsAllTime === 'number' ? parsed.totalExpeditionsAllTime : 0,
    hasOGBadge: Boolean(parsed.hasOGBadge),
    ogBadgePurchasedAt: parsed.ogBadgePurchasedAt || null,
    arenaRegisteredBlobId: parsed.arenaRegisteredBlobId || null,
    lastArenaProcessedWeek: parsed.lastArenaProcessedWeek || null,
    lastArenaRank: parsed.lastArenaRank || null,
    lastArenaRewardClaimed: Boolean(parsed.lastArenaRewardClaimed),
    initialized: true,
    lastUpdated: parsed.lastUpdated || Date.now(),
    rev: typeof parsed.rev === 'number' ? parsed.rev : 0,
  };
}

async function saveWithRetry(
  syncId: string,
  state: GameState,
  expectedRev: number,
  maxAttempts: number = 3
): Promise<number> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await saveGameState(syncId, state, expectedRev);
    } catch (e) {
      if (e instanceof RevConflictError) {
        throw e; // конфликт версий — не повторяем, это обрабатывается отдельно выше
      }
      lastError = e;
      if (isOfflineError(e)) {
        throw e; // офлайн — нет смысла долбить сеть, подождём следующего цикла автосейва
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt)); // 800мс, 1600мс...
      }
    }
  }
  throw lastError;
}

export default function App() {
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<string>('home');
  const [exploreTab, setExploreTab] = useState<'expeditions' | 'network'>('expeditions');

  // Name Modal State
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);

  // Wallet Modal State
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [initialConnectType, setInitialConnectType] = useState<'base' | 'metamask' | null>(null);

  // BlobDex Gallery State
  const [isBlobDexOpen, setIsBlobDexOpen] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [previewPersonality, setPreviewPersonality] = useState<PersonalityType | null>(null);
  const [showFusionModal, setShowFusionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReactorModal, setShowReactorModal] = useState(false);

  // Summoning Celebration State
  const [isSummonModalOpen, setIsSummonModalOpen] = useState(false);
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
  const [saveTrigger, setSaveTrigger] = useState(0);

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
        return validateAndMigrateState(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load localStorage', e);
    }

    // Default State
    return { ...getDefaultState(), initialized: true };
  });

  const stateRef = React.useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const revRef = React.useRef<number>(0);
  const lastProcessedAddressRef = React.useRef<string | null>(null);

  // Helper to force-overwrite state, ref, and localStorage synchronously
  const syncAndSetState = (newState: GameState) => {
    if (typeof newState.rev === 'number') {
      revRef.current = newState.rev;
    }
    setState(newState);
    stateRef.current = newState;
    
    const currentSync = localStorage.getItem('bb_sync_id');
    if (currentSync) {
      localStorage.setItem(`bb_v6_${currentSync}`, JSON.stringify(newState));
    }
    localStorage.setItem('bb_v6', JSON.stringify(newState));
  };

  // Helper to update state and save to local storage
  const updateState = (updater: (prev: GameState) => GameState, silent: boolean = false) => {
    setState((prev) => {
      // Deep copy to prevent state pollution
      const next = updater(JSON.parse(JSON.stringify(prev)));
      const now = Date.now();
      next.lastUpdated = now;

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

      const currentSync = localStorage.getItem('bb_sync_id');
      if (currentSync) {
        localStorage.setItem(`bb_v6_${currentSync}`, JSON.stringify(next));
      }
      localStorage.setItem('bb_v6', JSON.stringify(next));
      return next;
    });

    if (!silent) {
      setSaveTrigger((t) => t + 1);
    }
  };

  // ☁️ Cloud Sync hook: Always prioritize wallet's cloud save on Firestore when connected
  useEffect(() => {
    if (!syncId) {
      setHasLoadedCloud(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let isMounted = true;

    const loadAndSyncCloud = async () => {
      setIsCloudSyncing(true);
      try {
        const cloudState = await loadGameState(syncId);
        if (cloudState) {
          const validated = validateAndMigrateState(cloudState);
          if (isMounted) {
            syncAndSetState(validated);
            revRef.current = validated.rev ?? 0;
            setHasLoadedCloud(true);
            triggerToast('Cloud save loaded! Progress synced.');
          }
        } else {
          // New wallet save initialization with clean default state for this wallet
          const freshState = getDefaultState();
          const newRev = await saveWithRetry(syncId, freshState, 0);
          freshState.rev = newRev;
          if (isMounted) {
            syncAndSetState(freshState);
            revRef.current = newRev;
            setHasLoadedCloud(true);
            triggerToast('Wallet save created in cloud.');
          }
        }
      } catch (e) {
        if (e instanceof RevConflictError) {
          if (e.cloudState && isMounted) {
            const validated = validateAndMigrateState(e.cloudState);
            syncAndSetState(validated);
            revRef.current = validated.rev ?? e.cloudState.rev ?? 0;
            setHasLoadedCloud(true);
          }
        } else {
          if (!isOfflineError(e)) {
            console.error('Failed to load cloud save:', e);
          }
          if (isMounted) {
            triggerToast('⚠️ Unable to load cloud save. Check connection.');
          }
        }
      } finally {
        if (isMounted) {
          setIsCloudSyncing(false);
        }
      }

      // Real-time listener for live sync across devices
      if (isMounted) {
        unsub = subscribeToGameState(syncId, (remoteState) => {
          if (!remoteState) return;
          const remoteRev = remoteState.rev ?? 0;
          if (remoteRev > revRef.current) {
            const validated = validateAndMigrateState(remoteState);
            syncAndSetState(validated);
            revRef.current = remoteRev;
            setHasLoadedCloud(true);
          }
        });
      }
    };

    loadAndSyncCloud();

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [syncId]);

  // ☁️ Cloud Sync hook: Safe background auto-save to Firestore (2-second debounce)
  useEffect(() => {
    if (!syncId || !hasLoadedCloud) return;

    const timer = setTimeout(async () => {
      try {
        setIsCloudSyncing(true);
        const newRev = await saveWithRetry(syncId, state, revRef.current);
        revRef.current = newRev;
      } catch (e) {
        if (e instanceof RevConflictError) {
          if (e.cloudState) {
            const validated = validateAndMigrateState(e.cloudState);
            syncAndSetState(validated);
            revRef.current = e.cloudState.rev ?? revRef.current;
          }
        } else if (!isOfflineError(e)) {
          console.error('Cloud auto-save failed:', e);
        }
      } finally {
        setIsCloudSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [saveTrigger, syncId, hasLoadedCloud]);

  // ☁️ Immediate flush save when tab becomes hidden or page unloads
  useEffect(() => {
    if (!syncId || !hasLoadedCloud) return;

    const handleFlushSave = () => {
      if (document.visibilityState === 'hidden' && stateRef.current) {
        saveWithRetry(syncId, stateRef.current, revRef.current)
          .then((newRev) => {
            revRef.current = newRev;
          })
          .catch((e) => {
            if (e instanceof RevConflictError) {
              if (e.cloudState) {
                const validated = validateAndMigrateState(e.cloudState);
                syncAndSetState(validated);
                revRef.current = e.cloudState.rev ?? revRef.current;
              }
            } else if (!isOfflineError(e)) {
              console.error('Flush save on visibility change failed:', e);
            }
          });
      }
    };

    document.addEventListener('visibilitychange', handleFlushSave);
    window.addEventListener('beforeunload', handleFlushSave);

    return () => {
      document.removeEventListener('visibilitychange', handleFlushSave);
      window.removeEventListener('beforeunload', handleFlushSave);
    };
  }, [syncId, hasLoadedCloud]);

  // Toast trigger
  const triggerToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Track in-flight server expedition claims to avoid duplicate fetches
  const inFlightExpeditionClaimsRef = React.useRef<Set<string>>(new Set());
  

  // ── Network Map ──
  const networkMap = useNetworkMap({
    syncId,
    walletAddress: rawWalletAddress,
    playerName: state.playerName ?? 'Trainer',
    blobs: state.blobs,
    onServerClaim: (updatedState: any) => {
      const validated = validateAndMigrateState(updatedState);
      syncAndSetState(validated);
      revRef.current = updatedState.rev || revRef.current;
    },
    onCubesEarned: (amount: number) => {
      updateState(prev => {
        prev.cubes += amount;
        prev.totalCubesAllTime = (prev.totalCubesAllTime ?? 0) + amount;
        return prev;
      });
      triggerToast(`💠 +${amount} from network!`);
    },
  });

  const reactor = useReactor(rawWalletAddress);

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
      const currentState = stateRef.current;
      const hasCompletedExpeditions =
        currentState.activeExpeditions?.some((exp) => Date.now() >= exp.endTime) ||
        Boolean(currentState.activeExpedition);
      const hasQuestReset = Date.now() - currentState.questsReset > 86400000;
      const isSignificant = hasCompletedExpeditions || hasQuestReset;

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
          for (const exp of prev.activeExpeditions) {
            if (Date.now() >= exp.endTime) {
              const activeIds = exp.blobIds || (exp.blobId ? [exp.blobId] : []);
              const primaryBlobId = activeIds[0];

              // Request server-side claim if not already in-flight
              if (
                syncId &&
                rawWalletAddress &&
                primaryBlobId &&
                !inFlightExpeditionClaimsRef.current.has(primaryBlobId)
              ) {
                inFlightExpeditionClaimsRef.current.add(primaryBlobId);

                fetch('/api/claim', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'expedition',
                    syncId,
                    walletAddress: rawWalletAddress,
                    blobId: primaryBlobId,
                  }),
                })
                  .then(async (res) => {
                    const updated = await res.json();
                    if (res.ok && updated) {
                      const validated = validateAndMigrateState(updated);
                      syncAndSetState(validated);
                      revRef.current = updated.rev || revRef.current;
                      playExpeditionCompleteSound();
                      if (updated.lastExpeditionEvent && updated.lastExpeditionEvent.type !== 'normal') {
                        const event = updated.lastExpeditionEvent;
                        triggerToast(`${event.icon} ${event.title}! Reward verified by server!`);
                      } else {
                        triggerToast(`✅ Expedition ${exp.name} Done! Verified by server.`);
                      }
                    } else {
                      console.warn('Expedition server claim failed:', updated?.error);
                    }
                  })
                  .catch((err) => {
                    console.warn('Expedition server claim fetch error:', err);
                  })
                  .finally(() => {
                    inFlightExpeditionClaimsRef.current.delete(primaryBlobId);
                  });
              }
            }
          }
        }

        return prev;
      }, !isSignificant);
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
    return n.toLocaleString();
  };

  // Connect Wallet Actions & Helper
  const processConnection = React.useCallback((addr: string) => {
    const formatted = addr.length > 12 ? (addr.slice(0, 6) + '...' + addr.slice(-4)) : addr;
    setWalletAddress(formatted);
    setRawWalletAddress(addr);
    
    const newSyncId = `wallet_${addr.toLowerCase()}`;
    const currentSyncId = localStorage.getItem('bb_sync_id');
    
    if (syncId !== newSyncId || currentSyncId !== newSyncId) {
      // Prepare state for newly connected wallet before cloud fetch finishes
      const localSaveForNewWallet = localStorage.getItem(`bb_v6_${newSyncId}`);
      if (localSaveForNewWallet) {
        try {
          syncAndSetState(validateAndMigrateState(JSON.parse(localSaveForNewWallet)));
        } catch (e) {
          // Let cloud load handle state hydration
        }
      }

      setHasLoadedCloud(false);
      setSyncId(newSyncId);
      localStorage.setItem('bb_sync_id', newSyncId);
      triggerToast('Wallet connected! Loading save from cloud...');
    } else {
      // Already loaded/in sync, just ensure state reflects it
      setSyncId(newSyncId);
    }
    
    localStorage.setItem('bb_formatted_wallet', formatted);
    localStorage.setItem('bb_raw_wallet', addr);

    setIsWalletModalOpen(false);
  }, [syncId, triggerToast]);

  // React to Wagmi account state changes
  useEffect(() => {
    if (isWagmiConnected && wagmiAddress && lastProcessedAddressRef.current !== wagmiAddress) {
      lastProcessedAddressRef.current = wagmiAddress;
      processConnection(wagmiAddress);
    }
  }, [isWagmiConnected, wagmiAddress, processConnection]);

  const handleConnectWalletType = async (type?: 'base' | 'metamask', address?: string) => {
    if (address) {
      processConnection(address);
      return;
    }
    try {
      await appKit.open();
    } catch (e) {
      console.error('Failed to open AppKit modal:', e);
      triggerToast('Failed to open wallet connection modal.');
    }
  };

  const handleDisconnectWallet = () => {
    lastProcessedAddressRef.current = null;
    try {
      wagmiDisconnect();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
    setWalletAddress(null);
    setRawWalletAddress(null);
    setSyncId(null);
    setHasLoadedCloud(false);
    setIsCloudSyncing(false);

    localStorage.removeItem('bb_formatted_wallet');
    localStorage.removeItem('bb_raw_wallet');
    localStorage.removeItem('bb_sync_id');

    setIsWalletModalOpen(false);
    triggerToast('Wallet disconnected. Please connect a wallet to play.');
  };

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
        ...DEFAULT_NEW_BLOB_FIELDS,
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
        ...DEFAULT_NEW_BLOB_FIELDS,
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

  const handleFusion = (blobAId: string, blobBId: string) => {
    let errorMsg = '';
    updateState((prev) => {
      const blobA = prev.blobs.find((b) => b.id === blobAId);
      const blobB = prev.blobs.find((b) => b.id === blobBId);
      if (!blobA || !blobB) {
        errorMsg = 'Blob not found!';
        return prev;
      }
      if (prev.blobs.length <= 2) {
        errorMsg = 'Need at least 3 Blobs to fuse!';
        return prev;
      }

      const cost = (blobA.level + blobB.level) * FUSION_CONFIG.costPerLevel;
      if (prev.cubes < cost) {
        errorMsg = `Need ${cost} 💠 to fuse!`;
        return prev;
      }

      // Cooldown check
      const cooldownLeft = (prev.lastFusionTime ?? 0) + FUSION_CONFIG.cooldownHours * 3600000 - Date.now();
      if (cooldownLeft > 0) {
        errorMsg = `Fusion cooldown: ${Math.ceil(cooldownLeft / 3600000)}h left`;
        return prev;
      }

      // Calculate result
      const newLevel = FUSION_CONFIG.calcNewLevel(blobA.level, blobB.level);
      const samePersonality = blobA.personality === blobB.personality;

      // Personality: stronger blob wins, unless both same → chance of Radiant
      const isRadiant = samePersonality && Math.random() < FUSION_CONFIG.radiantChance;
      const newPersonality = isRadiant ? 'radiant' : blobA.level >= blobB.level
        ? blobA.personality
        : blobB.personality;

      // Trait: 50% chance
      const trait: TraitId | null = Math.random() < FUSION_CONFIG.traitChance
        ? TRAIT_KEYS[Math.floor(Math.random() * TRAIT_KEYS.length)]
        : null;

      const newBlob: Blob = {
        id: `b${prev.nextId}`,
        personality: newPersonality as any,
        level: newLevel,
        xp: 0,
        upgrades: { speed: 0, harvest: 0, fortune: 0 },
        mood: { level: 3, lastFed: Date.now(), winsToday: 0, lossesToday: 0 },
        trait,
        isRadiant,
        totalExpeditions: 0,
        totalCubesEarned: 0,
        nodesHeld: [],
      };

      const updatedBlobs = prev.blobs
        .filter((b) => b.id !== blobAId && b.id !== blobBId)
        .concat(newBlob);

      const msg = isRadiant
        ? `✦ Radiant Blob appeared! Lv.${newLevel}${trait ? ` + ${TRAITS[trait].icon} ${TRAITS[trait].name}` : ''}`
        : `✨ Fusion! New Lv.${newLevel} ${newPersonality} Blob${trait ? ` + ${TRAITS[trait].icon} ${TRAITS[trait].name}` : ''}`;

      setTimeout(() => triggerToast(msg), 300);

      prev.cubes -= cost;
      prev.blobs = updatedBlobs;
      prev.selectedId = newBlob.id;
      prev.nextId = prev.nextId + 1;
      prev.lastFusionTime = Date.now();

      return prev;
    });

    if (errorMsg) {
      triggerToast(errorMsg);
    } else {
      setShowFusionModal(false);
    }
  };

  const handleBuyOGBadge = async () => {
    if (state.hasOGBadge) {
      triggerToast('You already have the OG Badge! 🏅');
      return;
    }
    if (state.cubes < 100000) {
      triggerToast(`Need 100,000 💠 (have ${state.cubes.toLocaleString()})`);
      return;
    }
    if (!rawWalletAddress) {
      triggerToast('Connect wallet to claim OG Badge');
      return;
    }

    updateState((prev) => {
      prev.cubes -= 100000;
      prev.hasOGBadge = true;
      prev.ogBadgePurchasedAt = Date.now();
      return prev;
    });

    // Save to Firebase for leaderboard/verification
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      await setDoc(
        doc(db, 'og_badges', rawWalletAddress.toLowerCase()),
        {
          walletAddress: rawWalletAddress,
          playerName: state.playerName ?? 'Trainer',
          purchasedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('OG Badge Firebase save failed:', e);
    }

    triggerToast('🏅 OG Badge claimed! Flex it!');
  };

  const handleBuyShield = async (nodeId: string, hours: number, cost: number) => {
    if (state.cubes < cost) {
      triggerToast(`Need ${cost} 💠 for Shield`);
      return;
    }

    updateState((prev) => {
      prev.cubes -= cost;
      return prev;
    });

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      await updateDoc(doc(db, 'nodes', nodeId), {
        shieldUntil: Date.now() + hours * 3600000,
      });
      triggerToast(`🛡️ Shield active for ${hours}h!`);
    } catch (e) {
      // Refund cubes if Firebase is down
      updateState((prev) => {
        prev.cubes += cost;
        return prev;
      });
      triggerToast('Shield purchase failed. Try again.');
    }
  };

  function rollExpeditionEvent(): typeof EXPEDITION_EVENTS[ExpeditionEventType] {
    const total = Object.values(EVENT_WEIGHTS).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [type, weight] of Object.entries(EVENT_WEIGHTS) as [ExpeditionEventType, number][]) {
      roll -= weight;
      if (roll <= 0) return EXPEDITION_EVENTS[type];
    }
    return EXPEDITION_EVENTS.normal;
  }

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

      const useCharm = (prev.blobCharms ?? 0) > 0;
      const newExp: any = {
        blobIds: finalBlobs.map((b) => b.id),
        zoneId,
        name: zone.name,
        reward: zone.reward,
        xp: zone.xp,
        duration: duration,
        endTime: Date.now() + duration * 1000,
        charmActive: useCharm,
      };

      if (useCharm) {
        prev.blobCharms = (prev.blobCharms ?? 1) - 1;
        triggerToast('🎁 Blob Charm activated! +100% cubes this expedition');
      }

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

  // ── Collect All Nodes Handler ──
  const handleCollectAllNodes = async () => {
    if (!rawWalletAddress) {
      triggerToast("🔌 Please connect your wallet first!");
      return;
    }
    try {
      const collected = await networkMap.collectAll();
      if (collected > 0) {
        triggerToast(`💠 Collected all nodes! Total: +${collected.toLocaleString()} Cubes!`);
      } else {
        triggerToast("🌐 No pending cubes to collect from your nodes.");
      }
    } catch (e) {
      console.error(e);
      triggerToast("❌ Error collecting from nodes.");
    }
  };

  // ── Push Notification Permission Handler ──
  const handleRequestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          triggerToast("🔔 Notifications enabled! You'll receive alerts when expeditions finish.");
          try {
            new Notification("BaseBlobs Notifications Active! 🔔", {
              body: "We will notify you when your expeditions finish.",
            });
          } catch (e) {
            console.warn(e);
          }
        } else {
          triggerToast("❌ Notification permission was not granted.");
        }
      });
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

  if (!state.initialized) {
    return (
      <div className="min-h-screen bg-[#06091a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl animate-bounce">🟦</div>
          <p className="text-slate-400 text-sm animate-pulse font-mono tracking-wide">Loading BaseBlobs…</p>
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

            {/* MetaMask Option */}
            <button
              onClick={() => {
                setInitialConnectType('metamask');
                setIsWalletModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all group cursor-pointer text-left relative overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-xs">🦊</span>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-white text-[10.5px] font-bold">MetaMask / Browser</span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[6.5px] font-mono font-bold px-0.8 py-0.1 rounded">
                      PC & Mobile
                    </span>
                  </div>
                  <span className="text-slate-400 text-[8px] block font-sans">Connect with MetaMask extension or Web3 browser</span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors animate-bounce-short" />
            </button>

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
                  <span className="text-slate-400 text-[8px] block font-sans">Connect inside Base App or Coinbase Wallet</span>
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
        </div>
        <button
          onClick={() => {
            setInitialConnectType(null);
            setIsWalletModalOpen(true);
          }}
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
          <div 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
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
                {state.hasOGBadge && (
                  <span className="text-yellow-400 text-[11px]" title="OG Badge">🏅</span>
                )}
                <Edit2 
                  className="w-2.5 h-2.5 text-slate-500 cursor-pointer hover:text-white transition-colors" 
                  onClick={(e) => { e.stopPropagation(); setIsNameModalOpen(true); }}
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

              {/* Left Floating Action Button — on top of Home background */}
              <div className="absolute top-2 left-2 z-20 flex flex-col gap-2">
                {/* Fusion Lab */}
                <button
                  onClick={() => setShowFusionModal(true)}
                  className="w-10 h-10 rounded-xl bg-purple-950/75 border border-purple-400/50 backdrop-blur-sm flex items-center justify-center hover:bg-purple-900/80 active:scale-95 transition-all shadow-lg"
                  title="Fusion Lab"
                >
                  <span className="text-lg">✨</span>
                </button>
              </div>



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

            {/* Collect All button on Home (pending cubes from all nodes) */}
            {networkMap.myNodes && networkMap.myNodes.length > 0 && (
              <div className="px-4 mb-3 flex-shrink-0">
                <button
                  onClick={handleCollectAllNodes}
                  className="relative overflow-hidden w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 hover:brightness-110 active:scale-[0.98] text-white transition-all duration-300 shadow-xl shadow-emerald-600/25 border border-emerald-400/35 cursor-pointer text-left flex items-center justify-between group"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(16,185,129,0.25)_0%,transparent_60%)] pointer-events-none group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                      <span className="text-xl">🌐</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black tracking-widest uppercase text-white drop-shadow-sm">
                        Collect All Node Income
                      </span>
                      <span className="text-[8.5px] font-semibold text-emerald-100/80 tracking-wide font-mono mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                        Holding {networkMap.myNodes.length} {networkMap.myNodes.length === 1 ? 'node' : 'nodes'} · {networkMap.totalPending > 0 ? `Pending: ${networkMap.totalPending} 💠` : 'All collected!'}
                      </span>
                    </div>
                  </div>

                  {networkMap.totalPending > 0 ? (
                    <div className="px-3 py-1.5 rounded-xl bg-black/30 border border-emerald-400/30 text-emerald-300 font-mono font-bold text-xs relative z-10 flex items-center gap-1">
                      <span>+{networkMap.totalPending}</span>
                      <span>💠</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl bg-black/10 border border-white/10 text-slate-400 font-mono font-bold text-xs relative z-10">
                      Collected
                    </div>
                  )}
                </button>
              </div>
            )}

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

            {/* Network income — show only if there are nodes */}
            {networkMap.myNodes.length > 0 && (
              <div className="mx-4 mt-2 p-3 rounded-2xl border border-blue-500/20 bg-blue-900/8 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider">Network Income</p>
                  <p className="text-white font-bold text-sm mt-0.5">
                    💠 {networkMap.totalIncome}/hr · {networkMap.myNodes.length} nodes
                  </p>
                </div>
                {networkMap.totalPending > 0 ? (
                  <button
                    onClick={() => networkMap.collectAll().then(n => {
                      if (n > 0) triggerToast(`💠 +${n} collected from network!`);
                    })}
                    className="px-4 py-2 rounded-xl bg-blue-600/80 border border-blue-400/50 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    Collect +{networkMap.totalPending} 💠
                  </button>
                ) : (
                  <span className="text-slate-500 text-xs font-semibold">Nothing pending</span>
                )}
              </div>
            )}

            {/* Active expedition reminder on Home */}
            {state.activeExpeditions && state.activeExpeditions.length > 0 && (
              <div className="mx-4 mt-2">
                {state.activeExpeditions.slice(0, 2).map((exp: any) => {
                  const timeLeft = exp.endTime - Date.now();
                  if (timeLeft <= 0) return null;
                  const mins = Math.floor(timeLeft / 60000);
                  const secs = Math.floor((timeLeft % 60000) / 1000);
                  return (
                    <div key={exp.id ?? exp.zoneId} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/8 bg-white/3 mb-1.5">
                      <span className="text-sm">🗺️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{exp.zoneName ?? exp.zoneId}</p>
                      </div>
                      <span className="text-[#00cfff] text-xs font-bold tabular-nums">
                        {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

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
          <div className="flex flex-col flex-1 relative z-10">

            {/* ── Tab switcher ── */}
            <div className="flex gap-1.5 px-4 pt-3 pb-2">
              {(['expeditions', 'network'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setExploreTab(tab)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    exploreTab === tab
                      ? 'bg-blue-600/80 text-white border border-blue-500/60'
                      : 'bg-white/5 text-slate-400 border border-white/8 hover:bg-white/10'
                  }`}
                >
                  {tab === 'expeditions' ? '🗺️ Expeditions' : '🌐 Network Map'}
                </button>
              ))}
            </div>

            {/* ── Expeditions tab (existing content) ── */}
            {exploreTab === 'expeditions' && (
            <div className="flex flex-col flex-1 px-4 pb-4">
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

            {/* Notification Permission Banner */}
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
              <div className="mb-4 p-3.5 bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-purple-950/50 border border-purple-500/35 rounded-2xl flex items-center justify-between gap-3 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-lg animate-bounce">
                    🔔
                  </div>
                  <div className="leading-tight">
                    <h4 className="text-white text-[11px] font-black uppercase tracking-wider">Enable Expedition Alerts</h4>
                    <p className="text-slate-400 text-[9px] mt-0.5">Get instant push notifications when expeditions finish!</p>
                  </div>
                </div>
                <button
                  onClick={handleRequestNotificationPermission}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-[10px] font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md shadow-purple-600/20 border border-purple-400/20"
                >
                  Enable 🔔
                </button>
              </div>
            )}

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
                          {timeLeft <= 0 ? ((exp as any).claiming ? 'Verifying... ⏳' : 'Completing... ⏳') : formatMs(timeLeft)}
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

            {/* Last expedition event */}
            {state.lastExpeditionEvent && state.lastExpeditionEvent.type !== 'normal' && (
              <div className="mx-4 mb-2 p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-3">
                <span className="text-2xl">{state.lastExpeditionEvent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">{state.lastExpeditionEvent.title}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5 truncate">{state.lastExpeditionEvent.description}</p>
                </div>
                <button
                  onClick={() => updateState(prev => ({ ...prev, lastExpeditionEvent: null }))}
                  className="text-slate-600 hover:text-slate-400 text-sm animate-fade-in"
                >
                  ✕
                </button>
              </div>
            )}

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

            {/* ── Network Map tab ── */}
            {exploreTab === 'network' && (
              <NetworkMap
                walletAddress={rawWalletAddress}
                playerName={state.playerName ?? 'Trainer'}
                blobs={state.blobs}
                nodes={networkMap.nodes}
                isLoading={networkMap.isLoading}
                myNodes={networkMap.myNodes}
                totalIncome={networkMap.totalIncome}
                totalPending={networkMap.totalPending}
                attackNode={networkMap.attackNode}
                collectFromNode={networkMap.collectFromNode}
                collectAll={networkMap.collectAll}
                getPendingCubes={networkMap.getPendingCubes}
                attackCooldowns={networkMap.attackCooldowns}
                onBuyShield={handleBuyShield}
                onToast={triggerToast}
              />
            )}

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

            {/* OG Badge section */}
            <div>
              <p style={{
                color: 'rgba(255,200,80,0.6)',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Status
              </p>

              <div
                onClick={state.hasOGBadge ? undefined : handleBuyOGBadge}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                  state.hasOGBadge
                    ? 'border-yellow-500/40 bg-yellow-900/10 cursor-default'
                    : 'border-white/8 bg-white/3 cursor-pointer hover:bg-white/6'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border ${
                  state.hasOGBadge
                    ? 'bg-yellow-500/20 border-yellow-400/40'
                    : 'bg-white/5 border-white/10'
                }`}>
                  🏅
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${state.hasOGBadge ? 'text-yellow-300' : 'text-white'}`}>
                      OG Badge
                    </p>
                    {state.hasOGBadge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-semibold">
                        OWNED
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {state.hasOGBadge
                      ? 'You are an OG BaseBlobs player ✨'
                      : 'Exclusive badge for early supporters'}
                  </p>
                  {!state.hasOGBadge && (
                    <p className="text-yellow-500/70 text-[10px] mt-1">
                      Cost: 100,000 💠 · One-time · Non-transferable
                    </p>
                  )}
                </div>
                {!state.hasOGBadge && (
                  <div className={`text-right flex-shrink-0 ${state.cubes >= 100000 ? 'text-yellow-400' : 'text-slate-500'}`}>
                    <p className="font-bold text-sm">100K 💠</p>
                    <p className="text-[10px]">{state.cubes >= 100000 ? 'Affordable' : 'Not enough'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Blob Charms info */}
            {(state.blobCharms ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-900/10">
                <div>
                  <p className="text-white text-xs font-semibold">🎁 Blob Charms</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Next expedition +100% cubes</p>
                </div>
                <span className="text-emerald-400 font-bold text-sm">×{state.blobCharms}</span>
              </div>
            )}

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
      </main>

      {/* ── BOTTOM NAV BAR ── */}
      <nav className="flex justify-around items-center py-1.5 pb-max(8px,env(safe-area-inset-bottom)) border-t border-white/5 bg-black/70 backdrop-blur-2xl flex-shrink-0 relative z-10 px-2 gap-0.5">
        {[
          { id: 'home', label: 'Home', icon: Cpu },
          { id: 'expeditions', label: 'Explore', icon: Radar },
          { id: 'upgrades', label: 'Upgrades', icon: Zap },
          { id: 'shop', label: 'Shop', icon: Database },
          { id: 'reactor', label: 'Reactor', icon: Atom }
        ].map((item) => {
          const isActive = currentScreen === item.id || (item.id === 'reactor' && showReactorModal);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'reactor') {
                  setShowReactorModal(true);
                  return;
                }
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
        updateState={updateState}
      />

      {showFusionModal && (
        <FusionModal
          blobs={state.blobs}
          cubes={state.cubes}
          lastFusionTime={state.lastFusionTime ?? 0}
          onFuse={handleFusion}
          onClose={() => setShowFusionModal(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          playerName={state.playerName ?? 'Trainer'}
          walletAddress={walletAddress}
          blobs={state.blobs}
          cubes={state.cubes}
          totalCubesAllTime={state.totalCubesAllTime ?? 0}
          totalExpeditionsAllTime={state.totalExpeditionsAllTime ?? 0}
          hasOGBadge={state.hasOGBadge ?? false}
          ogBadgePurchasedAt={state.ogBadgePurchasedAt ?? null}
          nodesHeld={networkMap.myNodes?.length ?? 0}
          incomePerHour={networkMap.totalIncome ?? 0}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showReactorModal && (
        <ReactorModal
          phase={reactor.reactor?.phase ?? null}
          target={reactor.reactor?.target ?? 0}
          totalContributed={reactor.reactor?.totalContributed ?? 0}
          totalReward={reactor.reactor?.totalReward ?? 0}
          contributorsCount={reactor.reactor?.contributorsCount ?? 0}
          progressPercent={reactor.progressPercent}
          synthesizingProgress={reactor.synthesizingProgress}
          msUntilClaimEnd={reactor.msUntilClaimEnd}
          myContribution={reactor.myContrib?.contributed ?? 0}
          estimatedReward={reactor.estimatedReward}
          myAllocation={reactor.myContrib?.allocation ?? 0}
          myClaimed={reactor.myContrib?.claimed ?? false}
          cubes={state.cubes}
          isClaiming={reactor.isClaiming}
          claimError={reactor.claimError}
          claimTxHash={reactor.claimTxHash}
          walletAddress={rawWalletAddress}
          firestoreError={reactor.firestoreError}
          onContribute={reactor.contribute}
          onClaim={reactor.claimTokens}
          onClose={() => setShowReactorModal(false)}
          onCubesSpent={(amount) =>
            updateState(prev => ({ ...prev, cubes: prev.cubes - amount }))
          }
          isAdmin={reactor.isAdmin}
          ownerAddress={reactor.ownerAddress}
          adminLoading={reactor.adminLoading}
          adminError={reactor.adminError}
          adminSuccess={reactor.adminSuccess}
          syncEventFromContract={reactor.syncEventFromContract}
          startEventOnChain={reactor.startEventOnChain}
          generateAndSubmitMerkle={reactor.generateAndSubmitMerkle}
          closeEventOnChain={reactor.closeEventOnChain}
          setPhaseInFirestore={reactor.setPhaseInFirestore}
        />
      )}

      {/* Custom notification Toast */}
      <Toast message={toastMessage} onClear={() => setToastMessage('')} />
    </div>
  );
}
