import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

export async function verifyWalletSignature(message: string, signature: `0x${string}`, expectedAddress: string) {
  try {
    const isValid = await publicClient.verifyMessage({
      address: expectedAddress as `0x${string}`,
      message,
      signature,
    });
    if (!isValid) {
      throw new Error('Invalid signature');
    }
  } catch (err: any) {
    if (err.message === 'Invalid signature') {
      throw err;
    }
    console.error('Signature verification error:', err);
    throw new Error('Signature verification failed: ' + (err.message || 'Unknown error'));
  }
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_TOKEN_SECRET || process.env.REACTOR_CLOSE_SECRET;
  if (!secret) {
    throw new Error('SESSION_TOKEN_SECRET is not configured');
  }
  return secret;
}

export function issueSessionToken(walletAddress: string): { token: string; expiresAt: number } {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = Buffer.from(JSON.stringify({ wallet: walletAddress.toLowerCase(), exp: expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

export function verifySessionToken(token: string, expectedAddress: string) {
  if (!token) {
    console.error('[verifySessionToken] Error: Missing session token');
    throw new Error('Missing session token');
  }
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch (err: any) {
    console.error('[verifySessionToken] Error: Secret configuration issue:', err.message);
    throw err;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    console.error('[verifySessionToken] Error: Invalid session token format:', { token });
    throw new Error('Invalid session token format');
  }
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    console.error('[verifySessionToken] Error: Invalid session token signature', {
      receivedSig: sig,
      expectedSig,
      payload,
    });
    throw new Error('Invalid session token signature');
  }
  let data: any;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch (e) {
    console.error('[verifySessionToken] Error: Failed to parse token payload JSON');
    throw new Error('Invalid session token payload');
  }
  if (!data || !data.wallet || !data.exp) {
    console.error('[verifySessionToken] Error: Payload missing wallet or exp:', data);
    throw new Error('Invalid session token payload');
  }
  const tokenWallet = String(data.wallet).toLowerCase();
  const expectedWallet = expectedAddress.toLowerCase();
  if (tokenWallet !== expectedWallet) {
    console.error('[verifySessionToken] Error: Token wallet mismatch', {
      tokenWallet,
      expectedWallet,
      rawExpected: expectedAddress,
    });
    throw new Error('Token wallet mismatch');
  }
  if (Date.now() > data.exp) {
    console.error('[verifySessionToken] Error: Session expired', {
      now: Date.now(),
      exp: data.exp,
      diffMs: Date.now() - data.exp,
    });
    throw new Error('Session expired, please reconnect wallet');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletAddress, message, signature } = req.body || {};

  if (!walletAddress || !message || !signature) {
    return res.status(400).json({ error: 'Missing walletAddress, message, or signature' });
  }

  try {
    await verifyWalletSignature(message, signature as `0x${string}`, walletAddress);

    const nonceMatch = message.match(/nonce:(\d+)/);
    if (!nonceMatch || Date.now() - Number(nonceMatch[1]) > 120_000) {
      return res.status(401).json({ error: 'Signature expired, retry' });
    }

    const { token, expiresAt } = issueSessionToken(walletAddress);
    return res.status(200).json({ token, expiresAt, walletAddress: walletAddress.toLowerCase() });
  } catch (err: any) {
    console.error('Auth handler error:', err);
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }
}
