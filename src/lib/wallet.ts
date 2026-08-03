import { getWalletClient } from 'wagmi/actions';
import { wagmiConfig } from './web3Config';

interface SessionData {
  token: string;
  expiresAt: number;
}

const inMemorySessions: Record<string, SessionData> = {};

/**
 * Одна общая промис-ссылка на идущий запрос подписи.
 * Без неё параллельные вызовы (status + клейм экспедиции + сбор нод)
 * открывают кошелёк несколько раз подряд ради одной и той же сессии.
 */
const inFlightAuth: Record<string, Promise<string>> = {};

export interface SessionRequestOptions {
  /**
   * true (по умолчанию) — вызов может открыть кошелёк ради новой подписи.
   * Разрешено ТОЛЬКО в обработчике клика пользователя.
   *
   * false — фоновый вызов: берёт токен из кэша, иначе возвращает null.
   * Кошелёк не трогает никогда. Незапрошенное окно подписи — это флаг
   * Safe Browsing / Blockaid, а не косметика.
   */
  interactive?: boolean;
  /** Переподписать даже при живом кэше (внутренний ретрай на 401). */
  forceRefresh?: boolean;
}

function getStorageKey(walletAddress: string): string {
  return `bb_session_${walletAddress.toLowerCase()}`;
}

/**
 * Единственное место, где читается кэш сессии.
 * Возвращает токен, только если до истечения больше 60 секунд —
 * иначе запрос успеет уйти с уже мёртвым токеном.
 */
function readCachedSession(lowerAddr: string): SessionData | null {
  const memSession = inMemorySessions[lowerAddr];
  if (memSession && memSession.expiresAt > Date.now() + 60_000) {
    return memSession;
  }

  try {
    if (typeof window !== 'undefined') {
      const key = getStorageKey(lowerAddr);
      const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (stored) {
        const parsed: SessionData = JSON.parse(stored);
        if (parsed.token && parsed.expiresAt > Date.now() + 60_000) {
          inMemorySessions[lowerAddr] = parsed;
          return parsed;
        }
        clearSessionToken(lowerAddr);
      }
    }
  } catch (e) {
    console.warn('Failed to read session token from storage:', e);
  }

  return null;
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

/**
 * Синхронная проверка «есть ли живой токен» без обращения к кошельку.
 * Используется как дешёвый фильтр в 1-Гц игровом тике (App.tsx).
 */
export function hasValidSession(walletAddress: string): boolean {
  if (!walletAddress) return false;
  return readCachedSession(walletAddress.toLowerCase()) !== null;
}

export async function getSessionToken(
  walletAddress: string,
  opts?: SessionRequestOptions & { interactive?: true }
): Promise<string>;
export async function getSessionToken(
  walletAddress: string,
  opts: SessionRequestOptions & { interactive: false }
): Promise<string | null>;
export async function getSessionToken(
  walletAddress: string,
  opts: SessionRequestOptions = {}
): Promise<string | null> {
  const { forceRefresh = false, interactive = true } = opts;
  const lowerAddr = walletAddress.toLowerCase();

  if (forceRefresh) {
    clearSessionToken(lowerAddr);
  } else {
    const cached = readCachedSession(lowerAddr);
    if (cached) {
      return cached.token;
    }
  }

  // Фоновый вызов: живого токена нет — уходим тихо.
  // Кошелёк открывается ТОЛЬКО по действию пользователя.
  if (!interactive) {
    return null;
  }

  // Если запрос подписи уже идёт — переиспользуем его вместо второго окна кошелька
  const pending = inFlightAuth[lowerAddr];
  if (pending) {
    return pending;
  }

  const authPromise = (async (): Promise<string> => {
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

    const data = await res.json().catch(() => ({} as any));
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
  })();

  inFlightAuth[lowerAddr] = authPromise;
  try {
    return await authPromise;
  } finally {
    delete inFlightAuth[lowerAddr];
  }
}

export async function fetchWithSession(
  url: string,
  body: Record<string, any>,
  opts?: SessionRequestOptions & { interactive?: true }
): Promise<Response>;
export async function fetchWithSession(
  url: string,
  body: Record<string, any>,
  opts: SessionRequestOptions & { interactive: false }
): Promise<Response | null>;
export async function fetchWithSession(
  url: string,
  body: Record<string, any>,
  opts: SessionRequestOptions = {}
): Promise<Response | null> {
  const { forceRefresh = false, interactive = true } = opts;
  const walletAddress = body.walletAddress;
  if (!walletAddress) {
    throw new Error('Wallet address is required for authenticated requests');
  }

  const token = await getSessionToken(walletAddress, { forceRefresh, interactive: false });

  // Живого токена нет. В фоне — уходим тихо, в интерактивном режиме
  // запрашиваем подпись (это разрешено только по клику пользователя).
  if (token === null) {
    if (!interactive) {
      return null;
    }
    const freshToken = await getSessionToken(walletAddress, { forceRefresh });
    return sendWithToken(url, body, freshToken, { forceRefresh, interactive });
  }

  return sendWithToken(url, body, token, { forceRefresh, interactive });
}

async function sendWithToken(
  url: string,
  body: Record<string, any>,
  token: string,
  opts: { forceRefresh: boolean; interactive: boolean }
): Promise<Response | null> {
  const { forceRefresh, interactive } = opts;
  const walletAddress = body.walletAddress;

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
        interactive,
        status: res.status,
      });

      // Ретрай с новой подписью осмысленен только если протух/побился сам токен.
      // Если сервер отвечает 401 из-за отсутствующего секрета или сломанной
      // конфигурации — новая подпись не поможет, а кошелёк будет открываться
      // на каждый запрос. Отдаём ответ как есть.
      const serverError = String(data?.error || '');
      const isRecoverable =
        /session|token|expired|signature/i.test(serverError) &&
        !/not configured|configuration|SESSION_TOKEN_SECRET/i.test(serverError);

      // Фон не переподписывает никогда: clearSessionToken выше уже сбросил кэш,
      // поэтому следующий фоновый вызов вернёт null и замолчит до действия игрока.
      if (interactive && !forceRefresh && isRecoverable) {
        return fetchWithSession(url, body, { forceRefresh: true });
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

