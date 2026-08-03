import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './claim.js';

export default async function statusHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    req.method = 'POST';
    const walletAddress = String(req.query.walletAddress || '');
    const syncId = String(req.query.syncId || (walletAddress ? `wallet_${walletAddress.toLowerCase()}` : ''));
    const sessionToken = String(req.query.sessionToken || req.query.token || '');
    req.body = {
      type: 'status',
      syncId,
      walletAddress,
      sessionToken,
    };
  } else if (req.method === 'POST') {
    req.body = {
      type: 'status',
      ...(req.body || {}),
    };
  }
  return handler(req, res);
}
