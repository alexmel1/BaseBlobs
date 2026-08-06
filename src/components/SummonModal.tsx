/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Atom, Loader2, Code, Database } from 'lucide-react';
import { P, UPGRADES } from '../data';
import { PersonalityType, UpgradeBranchId } from '../types';
import { playTapSound } from '../utils/audio';
import { BlobCanvas } from './BlobCanvas';

interface SummonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSummon: () => PersonalityType | null | Promise<PersonalityType | null>;
  cubes: number;
  currentBlobCount?: number;
  directRevealPersonality?: PersonalityType | null;
  /** Ветки, выпавшие только что призванному блобу — показываем в ревиле */
  revealBranches?: UpgradeBranchId[] | null;
  rawWalletAddress?: string | null;
  triggerToast?: (msg: string) => void;
  updateState?: any;
}

export const SummonModal: React.FC<SummonModalProps> = ({
  isOpen,
  onClose,
  onConfirmSummon,
  cubes,
  currentBlobCount = 0,
  directRevealPersonality,
  revealBranches,
  rawWalletAddress,
  triggerToast,
  updateState
}) => {
  const [stage, setStage] = useState<'prepare' | 'signing' | 'reveal'>('prepare');
  const [isSummoning, setIsSummoning] = useState(false);
  const [rolledPersonality, setRolledPersonality] = useState<PersonalityType | null>(null);
  const [summonError, setSummonError] = useState<string | null>(null);

  const MAX_BLOBS = 10;
  const summonCost = 1500 + currentBlobCount * 500;
  const isMaxBlobs = currentBlobCount >= MAX_BLOBS;

  useEffect(() => {
    if (isOpen) {
      if (directRevealPersonality) {
        setStage('reveal');
        setRolledPersonality(directRevealPersonality);
      } else {
        setStage('prepare');
        setRolledPersonality(null);
      }
      setSummonError(null);
      setIsSummoning(false);
    }
  }, [isOpen, directRevealPersonality]);

  const handleInitiateSummon = async () => {
    if (isMaxBlobs) {
      setSummonError(`You already have the maximum of ${MAX_BLOBS} Blobs!`);
      return;
    }
    if (cubes < summonCost || isSummoning) return;
    setIsSummoning(true);
    setSummonError(null);
    playTapSound();
    setStage('signing');

    try {
      const personalityResult = await onConfirmSummon();
      if (personalityResult) {
        setRolledPersonality(personalityResult);
        setStage('reveal');
      } else {
        setSummonError('Server returned no blob data — check console/logs');
        setStage('prepare');
      }
    } catch (err: any) {
      console.error('Summoning failed:', err);
      if (triggerToast) triggerToast(err.message || 'Summoning failed.');
      setSummonError(err.message || 'Summoning failed');
      setStage('prepare');
    } finally {
      setIsSummoning(false);
    }
  };

  if (!isOpen) return null;

  const bp = rolledPersonality ? (P[rolledPersonality] || P.happy) : P.happy;
  // Ветки блоба приходят с сервера — роллятся только там
  const rolledBranches = UPGRADES.filter((u) => (revealBranches || []).includes(u.id));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center z-[210] p-4">
        
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          className="relative bg-[#04081c] border-2 border-[#0052ff]/40 rounded-3xl p-6 w-full max-w-[340px] text-center shadow-2xl overflow-hidden"
          style={{
            boxShadow: `0 0 50px ${bp.glow}20, inset 0 0 35px #0052ff15`,
          }}
        >
          {/* Cyber grid pattern background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />

          {/* CLOSE BUTTON - available only in pre-payment or post-mint stages */}
          {(stage === 'prepare' || stage === 'reveal') && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-50 active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* STAGE 1: PREPARE (Before spending cubes, with CANCEL option) */}
          {stage === 'prepare' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0052ff]/10 border border-[#0052ff]/30 rounded-full text-[#00cfff] text-[10px] font-black uppercase tracking-wider mb-4 font-mono">
                <Database className="w-3 h-3 text-[#00cfff]" />
                <span>Base L2 Factory</span>
              </div>
              
              <h3 className="text-white text-base font-black tracking-wide font-display">
                Summon New Blob
              </h3>
              <p className="text-slate-400 text-[11px] mt-1.5 font-semibold font-mono max-w-[240px] leading-relaxed">
                Compile a randomized companion Blob NFT directly via Web3 smart contract.
              </p>

              {summonError && (
                <div className="w-full bg-red-950/80 border border-red-500/50 rounded-2xl p-3 mt-3 text-left font-mono text-[11px] text-red-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-black text-red-400 text-[10px] uppercase tracking-wider">
                    <span>Summon Error</span>
                    <button
                      onClick={() => setSummonError(null)}
                      className="text-red-400 hover:text-white transition-colors cursor-pointer text-xs font-bold px-1"
                    >
                      Закрыть
                    </button>
                  </div>
                  <div className="break-words leading-snug">{summonError}</div>
                </div>
              )}

              {/* Holographic Spinning Blueprint Core */}
              <div className="relative h-44 flex items-center justify-center my-2">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 border border-dashed border-[#00cfff]/35 rounded-full animate-spin-slow" />
                  <div className="absolute inset-2 border border-dotted border-[#0052ff]/40 rounded-full animate-pulse" />
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0052ff]/20 via-[#00cfff]/10 to-transparent border border-[#00cfff]/30 flex items-center justify-center shadow-lg shadow-[#00cfff]/5">
                    <Atom className="w-7 h-7 text-[#00cfff] animate-spin-slow" />
                  </div>
                </div>
              </div>

              {/* Price card */}
              <div className="w-full bg-slate-900/60 border border-white/5 rounded-2xl p-3.5 mb-5">
                <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1 font-mono">
                  {isMaxBlobs ? 'Limit Reached' : 'Consensus Price'}
                </div>
                <div className="text-white text-xl font-black font-mono flex items-center justify-center gap-1.5">
                  <span>{isMaxBlobs ? 'MAX (10/10)' : summonCost}</span>
                  {!isMaxBlobs && <span className="text-[#00cfff]">💠</span>}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Your Balance: {cubes} 💠 ({currentBlobCount}/10 Blobs)
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <motion.button
                  whileHover={{ scale: (cubes < summonCost || isSummoning || isMaxBlobs) ? 1.0 : 1.02 }}
                  whileTap={{ scale: (cubes < summonCost || isSummoning || isMaxBlobs) ? 1.0 : 0.98 }}
                  onClick={handleInitiateSummon}
                  disabled={cubes < summonCost || isSummoning || isMaxBlobs}
                  className={`w-full py-3.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-[#0052ff] to-[#00cfff] border border-white/10 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20 cursor-pointer ${
                    (cubes < summonCost || isSummoning || isMaxBlobs) ? 'opacity-50 cursor-not-allowed filter grayscale' : ''
                  }`}
                >
                  {isSummoning ? 'PREPARE IN WALLET...' : isMaxBlobs ? 'MAX BLOBS REACHED (10/10)' : 'SIGN & INITIATE CONTRACT'}
                </motion.button>
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL TRANSACTION
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: SIGNING (Web3 wallet signature popup simulation) */}
          {stage === 'signing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#0052ff]/10 border border-[#00cfff]/45 flex items-center justify-center mb-5 relative">
                <div className="absolute inset-0 rounded-2xl border border-[#00cfff]/25 animate-ping" />
                <Loader2 className="w-6 h-6 text-[#00cfff] animate-spin" />
              </div>
              
              <h4 className="text-white text-sm font-black tracking-tight font-display">
                Requesting Signature...
              </h4>
              <p className="text-[#00cfff] text-[9px] font-mono mt-1.5 animate-pulse">
                await wallet.signMessage(...)
              </p>
              
              {/* Fake web3 tx metadata */}
              <div className="w-full mt-5 p-3.5 bg-black/40 border border-white/5 rounded-2xl text-left font-mono text-[9px] text-slate-400 space-y-1.5">
                <div className="flex justify-between border-b border-white/5 pb-1 mb-1 text-[8px] uppercase font-black text-slate-500">
                  <span>Transaction Request</span>
                  <span className="text-[#00cfff]">Base L2</span>
                </div>
                <div>
                  <span className="text-slate-500">Contract:</span>{' '}
                  <span className="text-blue-400 font-bold">0xBlobRegistry...</span>
                </div>
                <div>
                  <span className="text-slate-500">Method:</span>{' '}
                  <span className="text-yellow-400 font-semibold">mintRandomBlob()</span>
                </div>
                <div>
                  <span className="text-slate-500">Value:</span> {summonCost} Cubes (Sponsored)
                </div>
                <div>
                  <span className="text-slate-500">Gas Limit:</span> 21000 (Zero Fee)
                </div>
              </div>

              <p className="text-[8px] text-slate-500 mt-5 font-mono text-center max-w-[200px]">
                Please authorize the request in your wallet to complete the synthesis.
              </p>
            </motion.div>
          )}

          {/* STAGE 3: REVEAL (Final unlocked companion) */}
          {stage === 'reveal' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/30 to-blue-500/20 border border-cyan-500/40 rounded-full text-cyan-300 text-[10px] font-black uppercase tracking-wider mb-4 animate-bounce-short font-mono">
                <Code className="w-3 h-3 text-cyan-300" />
                <span>Blob Smart Contract Minted!</span>
              </div>
              
              <h3 className="text-white text-lg font-black tracking-wide font-display">
                Synthesized {bp.name}!
              </h3>

              {/* CENTER COMPONENT - revealed blob */}
              <div className="relative h-44 flex items-center justify-center my-4 w-full">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 11 }}
                  className="w-28 h-28 rounded-full flex items-center justify-center relative bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-2 border-slate-700/50 shadow-xl"
                  style={{
                    borderColor: bp.glow + '55',
                    boxShadow: `0 12px 32px -6px ${bp.glow}66`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <BlobCanvas personality={rolledPersonality || 'happy'} size={80} animate={true} />
                  </div>

                  <motion.div
                    animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ type: 'tween', ease: 'easeInOut', duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border"
                    style={{ borderColor: bp.glow + '44' }}
                  />
                  <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-cyan-300 animate-spin-slow" />
                </motion.div>
              </div>

              {/* DESCRIPTIONS & STATS DISPLAY */}
              <div className="w-full space-y-4">
                {/* Description */}
                <div className="bg-[#081230]/75 border border-[#0052ff]/30 rounded-2xl p-3">
                  <div className="text-[10px] font-black text-[#00cfff] uppercase tracking-wider mb-1 font-mono">
                    Special Ability
                  </div>
                  <div className="text-white text-xs font-bold leading-normal">
                    {bp.bonus}
                  </div>
                </div>

                {/* Rolled upgrade branches — the actual reveal moment */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-3">
                  <div className="text-[10px] font-black text-[#00cfff] uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                    <span>Upgrade Branches</span>
                    <span className="text-slate-500">
                      {rolledBranches.length}/{UPGRADES.length}
                    </span>
                  </div>

                  {rolledBranches.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {rolledBranches.map((branch) => (
                        <div
                          key={branch.id}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 border text-left"
                          style={{
                            background: `${branch.color}12`,
                            borderColor: `${branch.color}44`,
                          }}
                        >
                          <span className="text-sm leading-none">{branch.icon}</span>
                          <span className="text-white text-[11px] font-bold flex-1">
                            {branch.name}
                          </span>
                          <span
                            className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
                            style={{
                              color: branch.kind === 'combat' ? '#ff9a6b' : '#6ee7b7',
                              background: branch.kind === 'combat' ? 'rgba(255,122,47,0.12)' : 'rgba(27,175,122,0.12)',
                              borderColor: branch.kind === 'combat' ? 'rgba(255,122,47,0.35)' : 'rgba(27,175,122,0.35)',
                            }}
                          >
                            {branch.kind === 'combat' ? 'Combat' : 'Mining'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[10px] font-mono py-1">
                      Open the Upgrades screen to see this Blob's branches.
                    </div>
                  )}

                  <p className="text-slate-500 text-[8.5px] font-mono mt-2 leading-relaxed">
                    This set is unique to this Blob and cannot be rerolled.
                  </p>
                </div>

                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full py-3.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-[#0052ff] to-[#00cfff] border border-white/10 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  CONFIRM & REGISTER TO WALLET 💠
                </motion.button>
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
