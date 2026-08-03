/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DEV-ONLY точка входа для стенда визуала реактора (/preview.html).
 *
 * Отдельная от main.tsx намеренно: здесь НЕ импортируются App, wagmi
 * и web3Config. AppKit при загрузке модуля пытается восстановить сессию
 * кошелька — это и приводило к окнам подписи при работе над визуалом.
 *
 * В прод-сборку не попадает: rollupOptions.input содержит только index.html,
 * поэтому preview.html не собирается и на Vercel не деплоится.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactorPreview } from './components/ReactorPreview.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (!import.meta.env.DEV) {
  throw new Error('Reactor preview is a dev-only entry point');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ReactorPreview />
    </ErrorBoundary>
  </StrictMode>,
);
