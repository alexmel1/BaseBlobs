/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wallet, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  RefreshCw,
  Link,
  QrCode
} from 'lucide-react';
import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { appKit } from '../lib/web3Config';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  onConnect: (walletType: 'base' | 'metamask', address?: string) => void;
  onDisconnect: () => void;
  triggerToast: (msg: string) => void;
  initialConnectType?: 'base' | 'metamask' | null;
}

// Global variable to cache the CoinbaseWalletSDK instance
let coinbaseSDKInstance: any = null;

const getCoinbaseSDKProvider = () => {
  if (typeof window === 'undefined') return null;
  if (!coinbaseSDKInstance) {
    try {
      coinbaseSDKInstance = createCoinbaseWalletSDK({
        appName: 'BaseBlobs',
        appLogoUrl: window.location.origin + '/icon.png',
        preference: {
          options: 'all',
        },
      });
    } catch (e) {
      console.error('Failed to init CoinbaseWalletSDK:', e);
    }
  }
  return coinbaseSDKInstance ? coinbaseSDKInstance.getProvider() : null;
};

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  onConnect,
  onDisconnect,
  triggerToast,
  initialConnectType = null,
}) => {
  const [connectingType, setConnectingType] = useState<'base' | 'metamask' | null>(null);
  const [step, setStep] = useState<number>(0); // 0: select, 1: info/redirect notice, 2: connecting, 3: success, 4: error
  const [progress, setProgress] = useState(0);
  const [connectedAddr, setConnectedAddr] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConnectingType(null);
      setStep(0);
      setProgress(0);
      setErrorMsg(null);
    } else {
      if (!walletAddress && initialConnectType) {
        handleStartConnect(initialConnectType);
      } else {
        setStep(0);
        setConnectingType(null);
      }
    }
  }, [isOpen, initialConnectType, walletAddress]);

  if (!isOpen) return null;

  const handleStartConnect = async (type: 'base' | 'metamask') => {
    setErrorMsg(null);
    setConnectingType(type);
    onClose();
    appKit.open();
  };


  const handleBackToSelect = () => {
    setConnectingType(null);
    setStep(0);
    setProgress(0);
  };

  const isWalletConnected = !!walletAddress;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-[#0b1026] border border-[#0055ff]/40 rounded-2xl w-full max-w-[350px] shadow-2xl overflow-hidden text-white flex flex-col transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-[#00aaff]" />
            <h3 className="text-sm font-black tracking-wide uppercase font-mono">
              {isWalletConnected ? 'Sync & Wallet Info' : 'Connect Web3 Wallet'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1">
          {isWalletConnected && step !== 3 ? (
            /* Connected state (Simple display) */
            <div className="flex flex-col items-center py-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Connected Web3 Wallet</p>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 mt-1.5 font-mono text-xs text-white select-text">
                {walletAddress}
              </div>

              <div className="mt-6 flex flex-col gap-2 w-full">
                <button
                  onClick={onDisconnect}
                  className="w-full py-2.5 bg-red-600/10 hover:bg-red-600/20 active:scale-98 border border-red-500/25 rounded-xl text-xs font-bold text-red-400 transition-all cursor-pointer"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : step === 1 && connectingType === 'base' ? (
            /* Immersive Base App Request step */
            <div className="flex flex-col text-left py-1 animate-fade-in">
              <div className="bg-[#0052ff]/10 border border-[#0052ff]/20 text-[#00cfff] rounded-xl p-3 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-bold text-[13px] tracking-tight font-mono">
                  <Database className="w-4 h-4 text-[#00cfff]" /> Base App Connection
                </div>
                <span className="bg-[#00cfff]/15 text-[#00cfff] text-[8px] font-bold font-mono px-1.5 py-0.5 rounded uppercase">
                  L2 Tunnel
                </span>
              </div>

              <p className="text-slate-300 text-[10px] leading-relaxed mb-4">
                Open this page from inside your <strong className="text-[#00cfff]">Base App</strong> or Coinbase Wallet browser to connect directly with gasless support.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const currentUrl = window.location.href;
                    window.location.href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`;
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-[#0052ff] to-[#00cfff] hover:brightness-110 active:scale-95 text-white rounded-xl text-[10px] font-bold transition-all shadow-lg shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-1.5 font-mono uppercase tracking-wider"
                >
                  🚀 Open in Base App
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleBackToSelect}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-[10px] font-bold text-slate-400 transition-all cursor-pointer"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          ) : step === 2 ? (
            /* Connection Progress screen */
            <div className="flex flex-col items-center py-6 animate-fade-in">
              <div className="relative w-14 h-14 flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-[#0052ff] animate-spin" />
                <div className="absolute inset-0 border-2 border-white/5 rounded-full" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">
                Connecting Base App
              </h4>
              <p className="text-slate-400 text-[9px] text-center max-w-[200px]">
                Please approve the request in your wallet window or phone browser...
              </p>
              
              <p className="text-[8px] text-slate-400 font-mono mt-2">
                {progress < 50 ? 'Requesting accounts...' : 'Verifying chain connection...'}
              </p>
            </div>
          ) : step === 3 ? (
            /* Connection Success state */
            <div className="flex flex-col items-center py-5 animate-fade-in">
              <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Connection Successful!</h4>
              <p className="text-[9px] text-slate-400 text-center leading-relaxed max-w-[240px] mb-4">
                Wallet connected successfully on Base Network. You are ready for gameplay!
              </p>

              <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2 mt-1.5 font-mono text-xs text-white">
                {connectedAddr || walletAddress}
              </div>

              <button
                onClick={onClose}
                className="mt-6 w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/15 cursor-pointer active:scale-98 font-mono uppercase tracking-wider text-center"
              >
                Let's Play!
              </button>
            </div>
          ) : step === 4 ? (
            /* Error state screen */
            <div className="flex flex-col items-center text-center py-4 animate-fade-in">
              <div className="w-11 h-11 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Connection Failed</h4>
              <p className="text-slate-400 text-[9px] leading-relaxed max-w-[260px] mb-4">
                {errorMsg || 'Your browser wallet rejected the request or has sandbox restrictions.'}
              </p>
              
              <div className="flex flex-col gap-1.5 w-full">
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    handleStartConnect(connectingType || 'base');
                  }}
                  className="w-full py-2 bg-[#0052ff] hover:bg-[#1a65ff] text-white rounded-xl text-[10px] font-bold transition-all shadow-md cursor-pointer font-mono uppercase tracking-wider"
                >
                  Try Connecting Again
                </button>
                <button
                  onClick={handleBackToSelect}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-all cursor-pointer font-mono uppercase tracking-wider"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            /* Step 0: Disconnected state - Connection options directly */
            <div className="flex flex-col gap-2.5 animate-fade-in">
              <p className="text-slate-400 text-[9.5px] leading-relaxed mb-0.5">
                Connect your Web3 wallet to save and sync your game progress across PC & Mobile.
              </p>

              {/* MetaMask / PC Browser option */}
              <button
                onClick={() => handleStartConnect('metamask')}
                className="w-full flex items-center justify-between p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded-xl transition-all group cursor-pointer text-left relative overflow-hidden"
              >
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-400" />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-lg">🦊</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-xs font-bold">MetaMask / Web3 Wallet</span>
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[7.5px] font-mono font-bold px-1 py-0.2 rounded">
                        PC & Mobile
                      </span>
                    </div>
                    <span className="text-slate-400 text-[8.5px] block mt-0.5 font-sans">Connect with MetaMask extension or Web3 browser</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </button>

              {/* Base App option */}
              <button
                onClick={() => handleStartConnect('base')}
                className="w-full flex items-center justify-between p-3 bg-[#00a6ff]/10 hover:bg-[#00a6ff]/20 border border-[#00a6ff]/35 rounded-xl transition-all group cursor-pointer text-left relative overflow-hidden"
              >
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#00cfff]" />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg viewBox="0 0 100 100" className="w-6 h-6 text-[#0052ff] fill-current">
                      <circle cx="50" cy="50" r="40" stroke="#0052ff" strokeWidth="12" fill="none" />
                      <circle cx="50" cy="50" r="15" fill="#0052ff" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-xs font-bold">Base App / CB Wallet</span>
                      <span className="bg-cyan-500/20 text-[#00cfff] border border-cyan-500/30 text-[7.5px] font-mono font-bold px-1 py-0.2 rounded flex items-center gap-0.5 animate-pulse">
                        <Zap className="w-2 h-2" /> Gasless
                      </span>
                    </div>
                    <span className="text-slate-400 text-[8.5px] block mt-0.5 font-sans">Connect within Base App or Coinbase Wallet</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/30 text-center border-t border-white/5">
          <p className="text-[8px] text-slate-500 font-mono">
            Secure connection via Base L2 API · BaseBlobs Game
          </p>
        </div>
      </div>
    </div>
  );
};
