import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import claimHandler from './api/claim.js';
import authHandler from './api/auth.js';
import reactorCloseHandler from './api/reactor-close.js';
import reactorAdminHandler from './api/reactor-admin.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to wrap Vercel-style handlers as Express routes
  function mount(routePath: string, handler: (req: any, res: any) => Promise<any>) {
    app.post(routePath, async (req, res) => {
      try {
        await handler(req as any, res as any);
      } catch (err: any) {
        console.error(`API ${routePath} error:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
      }
    });
  }

  // API Routes
  mount('/api/claim', claimHandler);
  mount('/api/auth', authHandler);
  mount('/api/reactor-close', reactorCloseHandler);
  mount('/api/reactor-admin', reactorAdminHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();