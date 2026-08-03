import { getWalletClient } from 'wagmi/actions';
import { wagmiConfig } from './web3Config';

interface SessionData {
  token: string;
  expiresAt: number;
}

const inMemorySessions: Record<string, SessionData> = {};

function getStorageKey(walletAddress: string): string {
  return `bb_session_${walletAddress.toLowerCase()}`;
}

export function clearSessionToken(walletAddress: string): void {
  if (!walletAddress) return;
  const lowerAddr = walletAddress.toLowerCase();
  delete inMemorySessions[lowerAddr];
  try {
    if (typeof window !== 'undefined') {
      const key = getStorageKey(lowerAddr);
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Failed to clear session token from storage:', e);
  }
}

export function hasValidSession(walletAddress: string): boolean {
  if (!walletAddress) return false;
  const lowerAddr = walletAddress.toLowerCase();

  const memSession = inMemorySessions[lowerAddr];
  if (memSession && memSession.expiresAt > Date.now() + 60_000) {
    return true;
  }

  try {
    if (typeof window !== 'undefined') {
      const key = getStorageKey(lowerAddr);
      const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (stored) {
        const parsed: SessionData = JSON.parse(stored);
        if (parsed.token && parsed.expiresAt > Date.now() + 60_000) {
          inMemorySessions[lowerAddr] = parsed;
          return true;
        } else {
          clearSessionToken(lowerAddr);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read session token from localStorage:', e);
  }

  return false;
}

export async function getSessionToken(
  walletAddress: string,
  forceRefresh = false
): Promise<string> {
  const lowerAddr = walletAddress.toLowerCase();

  if (forceRefresh) {
    clearSessionToken(lowerAddr);
  } else {
    // Check in-memory cache
    const memSession = inMemorySessions[lowerAddr];
    if (memSession && memSession.expiresAt > Date.now() + 60_000) {
      return memSession.token;
    }

    // Check localStorage
    try {
      if (typeof window !== 'undefined') {
        const key = getStorageKey(lowerAddr);
        const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (stored) {
          const parsed: SessionData = JSON.parse(stored);
          if (parsed.token && parsed.expiresAt > Date.now() + 60_000) {
            inMemorySessions[lowerAddr] = parsed;
            return parsed.token;
          } else {
            clearSessionToken(lowerAddr);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read session token from localStorage:', e);
    }
  }

  // Request signature from wallet once for session
  const nonce = Date.now();
  const message = `BaseBlobs session\nwallet:${walletAddress}\nnonce:${nonce}`;

  const walletClient = await getWalletClient(wagmiConfig, {
    account: walletAddress as `0x${string}`,
  });
  if (!walletClient) {
    throw new Error('No connected wallet available to authorize session');
  }
  const signature = await walletClient.signMessage({
    account: walletAddress as `0x${string}`,
    message,
  });

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      message,
      signature,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Failed to obtain session token');
  }

  const sessionData: SessionData = {
    token: data.token,
    expiresAt: data.expiresAt || Date.now() + 24 * 3600_000,
  };

  inMemorySessions[lowerAddr] = sessionData;
  try {
    if (typeof window !== 'undefined') {
      const key = getStorageKey(lowerAddr);
      localStorage.setItem(key, JSON.stringify(sessionData));
    }
  } catch (e) {
    console.warn('Failed to save session token to localStorage:', e);
  }

  return data.token;
}

export async function fetchWithSession(
  url: string,
  body: Record<string, any>,
  forceRefresh = false
): Promise<Response> {
  const walletAddress = body.walletAddress;
  if (!walletAddress) {
    throw new Error('Wallet address is required for authenticated requests');
  }

  const token = await getSessionToken(walletAddress, forceRefresh);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      sessionToken: token,
    }),
  });

  if (res.status === 401) {
    clearSessionToken(walletAddress);
    const clone = res.clone();
    try {
      const data = await clone.json();
      console.error('[fetchWithSession 401 Error]:', data.error, {
        url,
        walletAddress,
        forceRefresh,
        status: res.status,
      });

      if (!forceRefresh) {
        // Retry once automatically with a fresh session token
        return fetchWithSession(url, body, true);
      }
    } catch (e) {
      console.error('[fetchWithSession 401 Error - Failed to parse JSON body]');
    }
  }

  return res;
}

export async function getWalletSignature(
  walletAddress: string,
  type: string
): Promise<{ message: string; signature: string }> {
  const nonce = Date.now();
  const message = `BaseBlobs claim\naction:${type}\nwallet:${walletAddress}\nnonce:${nonce}`;

  const walletClient = await getWalletClient(wagmiConfig, {
    account: walletAddress as `0x${string}`,
  });
  if (!walletClient) {
    throw new Error('No wallet connected to sign message');
  }
  const signature = await walletClient.signMessage({
    account: walletAddress as `0x${string}`,
    message,
  });
  return { message, signature };
}

