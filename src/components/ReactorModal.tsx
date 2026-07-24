import React, { useState } from 'react';
import { ReactorPhase } from '../hooks/useReactor';
import { getSavedFirebaseConfig, saveFirebaseConfig, CustomFirebaseConfig } from '../lib/firebase';

interface ReactorModalProps {
  phase: ReactorPhase | null;
  target: number;
  totalContributed: number;
  totalReward: number;
  contributorsCount: number;
  progressPercent: number;
  synthesizingProgress: number;
  msUntilClaimEnd: number;
  myContribution: number;
  estimatedReward: number;
  myAllocation: number;
  myClaimed: boolean;
  cubes: number;
  isClaiming: boolean;
  claimError: string | null;
  claimTxHash: string | null;
  walletAddress: string | null;
  firestoreError?: string | null;
  onContribute: (amount: number) => Promise<boolean>;
  onClaim: () => Promise<boolean>;
  onClose: () => void;
  onCubesSpent: (amount: number) => void;
  
  // Admin Props
  isAdmin?: boolean;
  ownerAddress?: string | null;
  adminLoading?: boolean;
  adminError?: string | null;
  adminSuccess?: string | null;
  syncEventFromContract?: (targetCubes: number) => Promise<boolean>;
  startEventOnChain?: (rewardAmount: number, targetCubes: number) => Promise<boolean>;
  generateAndSubmitMerkle?: () => Promise<boolean>;
  closeEventOnChain?: () => Promise<boolean>;
  setPhaseInFirestore?: (phase: ReactorPhase) => Promise<boolean>;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

export function ReactorModal({
  phase, target, totalContributed, totalReward, contributorsCount,
  progressPercent, synthesizingProgress, msUntilClaimEnd,
  myContribution, estimatedReward, myAllocation, myClaimed,
  cubes, isClaiming, claimError, claimTxHash,
  walletAddress, firestoreError, onContribute, onClaim, onClose, onCubesSpent,
  
  isAdmin, ownerAddress, adminLoading, adminError, adminSuccess,
  syncEventFromContract, startEventOnChain, generateAndSubmitMerkle, closeEventOnChain, setPhaseInFirestore,
}: ReactorModalProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [justContributed, setJustContributed] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  
  // Admin state controls
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAdvancedUtils, setShowAdvancedUtils] = useState(false);
  const [targetCubesInput, setTargetCubesInput] = useState('100000');
  const [rewardAmountInput, setRewardAmountInput] = useState('50000');

  // Keep reward & target inputs synced with current event props when loaded
  React.useEffect(() => {
    if (totalReward && totalReward > 0) {
      setRewardAmountInput(totalReward.toString());
    }
    if (target && target > 0) {
      setTargetCubesInput(target.toString());
    }
  }, [totalReward, target]);

  // Custom Firebase configuration states
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [firebaseInput, setFirebaseInput] = useState('');
  const [firebaseSetupError, setFirebaseSetupError] = useState<string | null>(null);
  const [firebaseSetupSuccess, setFirebaseSetupSuccess] = useState<string | null>(null);

  const hasCustomFirebase = !!getSavedFirebaseConfig();

  const handleSaveFirebaseConfig = () => {
    setFirebaseSetupError(null);
    setFirebaseSetupSuccess(null);

    if (!firebaseInput.trim()) {
      setFirebaseSetupError('Please paste your Firebase configuration object or JSON first.');
      return;
    }

    try {
      let parsed: CustomFirebaseConfig | null = null;
      try {
        parsed = JSON.parse(firebaseInput.trim()) as CustomFirebaseConfig;
      } catch {
        // Try fuzzy parsing via regex for javascript objects copied from Firebase Console
        const apiKeyMatch = firebaseInput.match(/apiKey:\s*["']([^"']+)["']/);
        const authDomainMatch = firebaseInput.match(/authDomain:\s*["']([^"']+)["']/);
        const projectIdMatch = firebaseInput.match(/projectId:\s*["']([^"']+)["']/);
        const storageBucketMatch = firebaseInput.match(/storageBucket:\s*["']([^"']+)["']/);
        const messagingSenderIdMatch = firebaseInput.match(/messagingSenderId:\s*["']([^"']+)["']/);
        const appIdMatch = firebaseInput.match(/appId:\s*["']([^"']+)["']/);

        if (apiKeyMatch && projectIdMatch && appIdMatch) {
          parsed = {
            apiKey: apiKeyMatch[1],
            authDomain: authDomainMatch ? authDomainMatch[1] : `${projectIdMatch[1]}.firebaseapp.com`,
            projectId: projectIdMatch[1],
            storageBucket: storageBucketMatch ? storageBucketMatch[1] : `${projectIdMatch[1]}.firebasestorage.app`,
            messagingSenderId: messagingSenderIdMatch ? messagingSenderIdMatch[1] : '',
            appId: appIdMatch[1]
          };
        }
      }

      if (!parsed || !parsed.apiKey || !parsed.projectId || !parsed.appId) {
        throw new Error('Could not extract required fields (apiKey, projectId, appId). Please check the format.');
      }

      saveFirebaseConfig(parsed);
      setFirebaseSetupSuccess('Firebase configuration saved successfully! Reloading application...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setFirebaseSetupError(err.message || 'Invalid format. Make sure to paste the full firebaseConfig object.');
    }
  };

  const handleResetFirebaseConfig = () => {
    saveFirebaseConfig(null);
    setFirebaseSetupSuccess('Reset to default Firebase configuration. Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleContribute = async (amount: number) => {
    if (!amount || amount <= 0 || amount > cubes || contributing) return;
    setContributing(true);
    const ok = await onContribute(amount);
    if (ok) {
      onCubesSpent(amount);
      setJustContributed(true);
      setCustomAmount('');
      setTimeout(() => setJustContributed(false), 3000);
    }
    setContributing(false);
  };

  const handleClaim = async () => {
    const ok = await onClaim();
    if (ok) setJustClaimed(true);
  };

  const isInactive = !phase || phase === 'inactive';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-md bg-[#06091e] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Handle for mobile */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <span className={phase === 'collecting' ? 'animate-pulse' : ''}>⚛️</span>
              The Blob Reactor
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Contribute Cubes · Earn $BLOBS tokens
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl p-1 cursor-pointer">✕</button>
        </div>

        {/* Firestore error warning */}
        {firestoreError && (
          <div className="mb-4 bg-red-950/40 border border-red-500/30 text-red-300 rounded-xl p-3 text-xs leading-relaxed">
            <p className="font-bold mb-1">⚠️ Connection issue:</p>
            <p className="mb-2">{firestoreError}</p>
            <p className="text-slate-400 text-[10px]">
              If you see "Missing or insufficient permissions", check your Firebase Security Rules. 
              Also make sure your Vercel project environment variables match your Firebase keys!
            </p>
          </div>
        )}

        {/* Phase badge */}
        {!isInactive && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-4 ${
            phase === 'collecting'   ? 'border-blue-500/50 text-blue-300 bg-blue-900/20' :
            phase === 'synthesizing' ? 'border-purple-500/50 text-purple-300 bg-purple-900/20' :
            phase === 'claimable'    ? 'border-emerald-500/50 text-emerald-300 bg-emerald-900/20' :
            'border-white/10 text-slate-400 bg-white/5'
          }`}>
            {phase === 'collecting'   && '🔵 Collecting'}
            {phase === 'synthesizing' && '🟣 Synthesizing…'}
            {phase === 'claimable'    && '🟢 Claim Open'}
            {phase === 'closed'       && '⚫ Closed'}
          </div>
        )}

        {/* Inactive state */}
        {isInactive && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4 opacity-30">⚛️</div>
            <p className="text-slate-400 text-sm font-semibold">No active Reactor Event</p>
            <p className="text-slate-500 text-xs mt-2">Check back soon for the next event!</p>
          </div>
        )}

        {/* ── COLLECTING PHASE ── */}
        {phase === 'collecting' && (
          <>
            {/* Global progress */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold">Global Reactor</span>
                <span className="text-white font-bold">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="h-5 bg-white/8 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                  style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #0044cc, #00aaff)',
                    boxShadow: '0 0 16px #00aaff66',
                  }}
                >
                  {progressPercent > 15 && (
                    <span className="text-white text-[9px] font-bold">
                      {totalContributed.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-slate-500">
                  {totalContributed.toLocaleString()} / {target.toLocaleString()} Cubes
                </span>
                <span className="text-slate-500">{contributorsCount} Contributors</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/8 mb-4" />

            {/* My stats */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Your Contribution</div>
                <div className="text-white font-bold text-base">
                  {myContribution.toLocaleString()} Cubes
                </div>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Estimated Reward</div>
                <div className="text-emerald-300 font-bold text-base">
                  {estimatedReward > 0 ? `${estimatedReward.toLocaleString()} $BLOBS` : '—'}
                </div>
              </div>
            </div>

            {/* Contribute UI */}
            {walletAddress ? (
              <>
                <p className="text-white text-sm font-semibold mb-3">
                  Contribute Cubes
                  <span className="text-slate-500 text-xs font-normal ml-2">
                    Available: {cubes.toLocaleString()} 💠
                  </span>
                </p>

                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      disabled={cubes < amt || contributing}
                      onClick={() => handleContribute(amt)}
                      className="py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white hover:bg-blue-900/30 hover:border-blue-500/40 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {amt >= 1000 ? `${amt/1000}K` : amt}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    placeholder="Custom amount"
                    className="flex-1 bg-white/6 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                  />
                  <button
                    disabled={!customAmount || Number(customAmount) <= 0 || Number(customAmount) > cubes || contributing}
                    onClick={() => handleContribute(Number(customAmount))}
                    className="px-5 py-2.5 rounded-xl bg-blue-600/80 border border-blue-400/40 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {contributing ? '…' : 'Add'}
                  </button>
                </div>

                {justContributed && (
                  <div className="text-emerald-400 text-xs text-center py-1 animate-pulse">
                    ✅ Contributed! Your share is growing.
                  </div>
                )}

                <p className="text-slate-600 text-[10px] text-center mt-2">
                  More Cubes = larger share of the {totalReward.toLocaleString()} $BLOBS reward pool
                </p>
              </>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm">
                Connect your wallet to contribute
              </div>
            )}
          </>
        )}

        {/* ── SYNTHESIZING PHASE ── */}
        {phase === 'synthesizing' && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4 animate-spin" style={{ animationDuration: '3s' }}>⚛️</div>
            <p className="text-purple-300 font-bold text-lg mb-2">Synthesizing…</p>

            {/* Synthesizing progress bar */}
            <div className="mb-4">
              <div className="h-3 bg-white/8 rounded-full overflow-hidden mx-8">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(synthesizingProgress))}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    boxShadow: '0 0 12px #a855f766',
                  }}
                />
              </div>
              <p className="text-purple-300 text-xs mt-2 font-semibold">
                {Math.min(100, Math.round(synthesizingProgress))}%
              </p>
            </div>

            <p className="text-slate-400 text-sm">
              Calculating allocations for all contributors.
              <br />
              <span className="text-purple-300 font-semibold">Claim window opens in ~6 hours.</span>
            </p>

            {myContribution > 0 && (
              <div className="mt-5 bg-purple-900/20 border border-purple-500/25 rounded-xl p-3">
                <p className="text-slate-400 text-xs">Your contribution</p>
                <p className="text-white font-bold text-lg">{myContribution.toLocaleString()} Cubes</p>
              </div>
            )}
          </div>
        )}

        {/* ── CLAIMABLE PHASE ── */}
        {phase === 'claimable' && (
          <div>
            {/* Claim window countdown */}
            <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-500/25 rounded-xl p-3 mb-5">
              <div>
                <p className="text-emerald-400 text-xs font-semibold">Claim window closes in</p>
                <p className="text-white font-bold text-xl">{fmtCountdown(msUntilClaimEnd)}</p>
              </div>
              <span className="text-3xl">⏰</span>
            </div>

            {/* My allocation */}
            {myAllocation > 0 ? (
              myClaimed || justClaimed ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-emerald-400 font-bold text-lg">Claimed!</p>
                  <p className="text-slate-400 text-xs mt-2">
                    {myAllocation.toLocaleString()} $BLOBS sent to your wallet.
                  </p>
                  {claimTxHash && (
                    <a
                      href={`https://basescan.org/tx/${claimTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-xs mt-2 inline-block underline"
                    >
                      View on Basescan ↗
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-blue-900/20 border border-blue-500/25 rounded-xl p-4 mb-5 text-center">
                    <p className="text-slate-400 text-xs mb-1">Your allocation</p>
                    <p className="text-white font-bold text-4xl">
                      {myAllocation.toLocaleString()}
                    </p>
                    <p className="text-blue-400 text-base font-semibold mt-1">$BLOBS</p>
                    <p className="text-slate-500 text-[10px] mt-2">
                      Based on your {myContribution.toLocaleString()} Cube contribution
                    </p>
                  </div>

                  <button
                    disabled={isClaiming || !walletAddress}
                    onClick={handleClaim}
                    className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    style={{ background: isClaiming ? '#1e293b' : 'linear-gradient(90deg, #059669, #10b981)' }}
                  >
                    {isClaiming ? '⏳ Confirming transaction…' : `🎁 Claim ${myAllocation.toLocaleString()} $BLOBS`}
                  </button>

                  {claimError && (
                    <p className="text-red-400 text-xs text-center mt-3">{claimError}</p>
                  )}

                  <p className="text-slate-500 text-[10px] text-center mt-3">
                    Tokens will be sent to your wallet via Base blockchain.
                    Requires gas (ETH).
                  </p>
                </>
              )
            ) : (
              <div className="text-center py-6">
                <div className="text-5xl mb-3 opacity-30">💠</div>
                <p className="text-slate-400 text-sm">No allocation for this wallet.</p>
                <p className="text-slate-500 text-xs mt-1">
                  You didn't contribute to this Reactor Event.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── CLOSED PHASE ── */}
        {phase === 'closed' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 opacity-30">⚛️</div>
            <p className="text-slate-400 font-semibold">Reactor Event Closed</p>
            <p className="text-slate-500 text-xs mt-2">The next event is being prepared.</p>
          </div>
        )}

        {/* ── ADMIN CONTROL PANEL ── */}
        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors cursor-pointer py-1"
            >
              <span className="flex items-center gap-1.5">
                🔧 ADMIN CONTROL PANEL
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">Contract Owner</span>
              </span>
              <span>{showAdminPanel ? '▼ Hide' : '▶ Show'}</span>
            </button>

          {showAdminPanel && (
            <div className="mt-4 p-4 rounded-2xl bg-black/60 border border-white/10 space-y-4 text-xs">
              
              {/* Status Header */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 font-mono">REACTOR STATUS</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    phase === 'collecting' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    phase === 'synthesizing' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    phase === 'claimable' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                  }`}>
                    Phase: {phase || 'inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                  <div>Reward Pool: <span className="text-emerald-300 font-bold">{totalReward.toLocaleString()} $BLOBS</span></div>
                  <div>Cube Target: <span className="text-blue-300 font-bold">{target.toLocaleString()} 💠</span></div>
                </div>
                <div className="text-[9px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-800">
                  <span>Wallet: <span className="text-slate-300">{walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : 'Disconnected'}</span></span>
                  <span>Owner: <span className="text-purple-300">{ownerAddress ? `${ownerAddress.slice(0,6)}...${ownerAddress.slice(-4)}` : '—'}</span></span>
                </div>
              </div>

              {/* Feedback Messages */}
              {adminError && (
                <div className="p-2.5 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{adminError}</span>
                </div>
              )}
              {adminSuccess && (
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <span>✅</span>
                  <span>{adminSuccess}</span>
                </div>
              )}

              {/* ── STEP-BY-STEP GUIDED EVENT WORKFLOW ── */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold font-mono text-indigo-300 flex items-center justify-between">
                  <span>📋 EVENT LIFECYCLE WORKFLOW</span>
                  <span className="text-[9px] text-slate-500 font-normal">Follow steps 1 ➔ 2 ➔ 3</span>
                </div>

                {/* STEP 1: Launch New Event */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  (isInactive || phase === 'closed')
                    ? 'bg-blue-950/30 border-blue-500/40 ring-1 ring-blue-500/20'
                    : 'bg-white/5 border-white/5 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span>Step 1:</span> Launch Event on Base
                    </span>
                    {(isInactive || phase === 'closed') && (
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        READY TO LAUNCH
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[10px] mb-3 leading-normal">
                    Starts a new event on the Base smart contract. Players will immediately be able to contribute Cubes.
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[9px] text-slate-400 font-mono block mb-1">Reward Pool ($BLOBS)</label>
                      <input
                        type="number"
                        value={rewardAmountInput}
                        onChange={(e) => setRewardAmountInput(e.target.value)}
                        placeholder="50000"
                        className="w-full bg-black/80 border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 font-mono block mb-1">Cube Target (💠)</label>
                      <input
                        type="number"
                        value={targetCubesInput}
                        onChange={(e) => setTargetCubesInput(e.target.value)}
                        placeholder="100000"
                        className="w-full bg-black/80 border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    disabled={adminLoading || (phase === 'collecting' || phase === 'synthesizing')}
                    onClick={() => startEventOnChain && startEventOnChain(Number(rewardAmountInput || 50000), Number(targetCubesInput || 100000))}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all text-xs cursor-pointer disabled:cursor-not-allowed shadow-md"
                  >
                    {adminLoading ? '⏳ Confirming on-chain transaction...' : (phase === 'collecting' || phase === 'synthesizing') ? '🚫 Event is currently active' : '🚀 Step 1: Start Event On-Chain'}
                  </button>
                </div>

                {/* STEP 2: Finalize & Generate Claims */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  (phase === 'collecting' || phase === 'synthesizing')
                    ? 'bg-purple-950/30 border-purple-500/40 ring-1 ring-purple-500/20'
                    : 'bg-white/5 border-white/5 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span>Step 2:</span> Generate Claims & Submit Merkle Root
                    </span>
                    {(phase === 'collecting' || phase === 'synthesizing') && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                        ACTION NEEDED
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[10px] mb-3 leading-normal">
                    Calculates exact $BLOBS token allocations for all {contributorsCount} contributors ({totalContributed.toLocaleString()} Cubes total), builds the Merkle Tree proof, and submits the root on-chain to open token claims.
                  </p>

                  <button
                    disabled={adminLoading || (phase !== 'collecting' && phase !== 'synthesizing')}
                    onClick={() => generateAndSubmitMerkle && generateAndSubmitMerkle()}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all text-xs cursor-pointer disabled:cursor-not-allowed shadow-md"
                  >
                    {adminLoading ? '⏳ Generating Merkle Tree & Submitting Root...' : (phase !== 'collecting' && phase !== 'synthesizing') ? '🚫 Only available during Collecting phase' : '🧬 Step 2: Generate & Submit Merkle Root'}
                  </button>
                </div>

                {/* STEP 3: Close Event */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  (phase === 'claimable')
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-white/5 border-white/5 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <span>Step 3:</span> Close On-Chain Event
                    </span>
                    {phase === 'claimable' && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        {msUntilClaimEnd > 0 ? `CLAIMS OPEN (${fmtCountdown(msUntilClaimEnd)})` : 'CLAIMS EXPIRED'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[10px] mb-3 leading-normal">
                    {msUntilClaimEnd > 0 
                      ? `Players are currently claiming $BLOBS tokens (${fmtCountdown(msUntilClaimEnd)} remaining). Close event will be available on-chain after the claim window ends.`
                      : 'Closes the event on-chain once the claim window has finished.'}
                  </p>

                  <button
                    disabled={adminLoading || (phase !== 'synthesizing' && phase !== 'claimable')}
                    onClick={() => closeEventOnChain && closeEventOnChain()}
                    className="w-full py-2 bg-red-950/70 hover:bg-red-900 border border-red-700/50 disabled:opacity-40 text-red-200 font-bold rounded-xl transition-all text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {adminLoading 
                      ? '⏳ Checking/Closing event on-chain...' 
                      : (phase !== 'synthesizing' && phase !== 'claimable') 
                        ? '🚫 Available when claims are open' 
                        : msUntilClaimEnd > 0
                          ? `⏳ Claim Window Active (${fmtCountdown(msUntilClaimEnd)} left)`
                          : '❌ Step 3: Close On-Chain Event'}
                  </button>
                </div>
              </div>

              {/* ── ADVANCED UTILITIES (Collapsible) ── */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedUtils(!showAdvancedUtils)}
                  className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-slate-200 py-1"
                >
                  <span>🛠️ Advanced Tools & Database Sync</span>
                  <span>{showAdvancedUtils ? '▼' : '▶'}</span>
                </button>

                {showAdvancedUtils && (
                  <div className="space-y-3 pt-2">
                    {/* Sync from contract */}
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200 text-[11px]">Sync State from Blockchain</div>
                        <div className="text-[9px] text-slate-400">Fetch latest event status from Base contract</div>
                      </div>
                      <button
                        disabled={adminLoading}
                        onClick={() => syncEventFromContract && syncEventFromContract(Number(targetCubesInput || 100000))}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer"
                      >
                        Sync Now
                      </button>
                    </div>

                    {/* Manual Phase Override */}
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="font-bold text-slate-300 text-[11px]">Manual Phase Override</div>
                      <div className="grid grid-cols-5 gap-1">
                        {(['inactive', 'collecting', 'synthesizing', 'claimable', 'closed'] as const).map(p => (
                          <button
                            key={p}
                            disabled={adminLoading}
                            onClick={() => setPhaseInFirestore && setPhaseInFirestore(p)}
                            className={`py-1 rounded text-[9px] font-semibold text-center border capitalize cursor-pointer transition-all ${
                              phase === p
                                ? 'bg-blue-600 text-white border-blue-400'
                                : 'bg-black/40 text-slate-400 border-white/5 hover:text-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Firebase Dynamic Config Panel */}
                    <div className="p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/10 space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowFirebaseSetup(!showFirebaseSetup)}
                        className="w-full flex items-center justify-between font-bold text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 font-mono">
                          ⚙️ {hasCustomFirebase ? '✅ CUSTOM DATABASE ACTIVE' : '🔌 CONNECT CUSTOM FIREBASE'}
                        </span>
                        <span>{showFirebaseSetup ? '▼' : '▶'}</span>
                      </button>

                      {showFirebaseSetup && (
                        <div className="space-y-3 pt-2 text-[11px]">
                          <p className="text-slate-400 leading-normal">
                            Pasting your custom Firebase configuration ensures the app connects to your database:
                          </p>

                          <textarea
                            value={firebaseInput}
                            onChange={(e) => setFirebaseInput(e.target.value)}
                            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "your-project-id",\n  appId: "1:..."\n};`}
                            className="w-full h-24 bg-black border border-indigo-500/25 rounded-lg p-2 font-mono text-[10px] text-indigo-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                          />

                          {firebaseSetupError && (
                            <div className="text-red-400 text-[10px] bg-red-950/30 border border-red-500/30 rounded px-2 py-1 leading-normal">
                              {firebaseSetupError}
                            </div>
                          )}
                          {firebaseSetupSuccess && (
                            <div className="text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-500/30 rounded px-2 py-1 leading-normal">
                              {firebaseSetupSuccess}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveFirebaseConfig}
                              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded transition-colors text-center cursor-pointer font-mono text-[10px]"
                            >
                              Save & Reconnect
                            </button>
                            {hasCustomFirebase && (
                              <button
                                type="button"
                                onClick={handleResetFirebaseConfig}
                                className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded border border-white/10 transition-colors text-center cursor-pointer font-mono text-[10px]"
                              >
                                Reset Default
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
