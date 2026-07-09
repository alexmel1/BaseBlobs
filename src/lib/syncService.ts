import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { GameState } from '../types';

/**
 * Checks if an error is due to being offline or a network issue.
 */
export function isOfflineError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const code = String(error.code || '').toLowerCase();
  return (
    code === 'unavailable' || 
    code === 'failed-precondition' ||
    msg.includes('offline') || 
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('failed to get document because the client is offline')
  );
}

/**
 * Generates a random alphanumeric Sync Code
 */
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'BBLOB-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Saves game state to Firestore
 */
export async function saveGameState(identifier: string, state: GameState): Promise<void> {
  if (!identifier) return;
  
  // Format the ID safely
  const docId = identifier.trim().toLowerCase();
  const docRef = doc(db, 'saves', docId);

  // Strip or normalize fields before saving if necessary
  const payload = {
    ...state,
    lastUpdated: Date.now(),
  };

  try {
    await setDoc(docRef, payload, { merge: true });
    console.log(`Saved state to Cloud for: ${docId}`);
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Failed to save game state to Cloud (client is offline, handled gracefully):', error);
    } else {
      console.error('Failed to save game state to Cloud:', error);
    }
    throw error;
  }
}

/**
 * Loads game state from Firestore
 */
export async function loadGameState(identifier: string): Promise<GameState | null> {
  if (!identifier) return null;

  const docId = identifier.trim().toLowerCase();
  const docRef = doc(db, 'saves', docId);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      // Ensure we cast it back to GameState
      return data as GameState;
    }
    return null;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn('Failed to load game state from Cloud (client is offline, handled gracefully):', error);
    } else {
      console.error('Failed to load game state from Cloud:', error);
    }
    throw error;
  }
}

/**
 * Subscribes to real-time updates for a game state document in Firestore
 */
export function subscribeToGameState(
  identifier: string,
  callback: (state: GameState) => void
): () => void {
  if (!identifier) return () => {};

  const docId = identifier.trim().toLowerCase();
  const docRef = doc(db, 'saves', docId);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data) {
          callback(data as GameState);
        }
      }
    },
    (error) => {
      console.error('Error in real-time sync listener:', error);
    }
  );
}

