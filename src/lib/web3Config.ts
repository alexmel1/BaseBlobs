/// <reference types="vite/client" />
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base } from '@reown/appkit/networks';

const projectId = (import.meta.env.VITE_REOWN_PROJECT_ID as string) || '';

if (!projectId) {
  console.error('VITE_REOWN_PROJECT_ID is not set — wallet connection will not work.');
}

const metadata = {
  name: 'BaseBlobs',
  description: 'Idle collector game on Base',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://baseblobs.app',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/icon.png` : 'https://baseblobs.app/icon.png'],
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [base],
  projectId,
  ssr: false,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [base],
  projectId,
  metadata,
  features: {
    analytics: false,
  },
  allWallets: 'SHOW',
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
