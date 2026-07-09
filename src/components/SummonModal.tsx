/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Flame, Shield, Cpu, Database, Code, Terminal, X, Atom, Loader2 } from 'lucide-react';
import { P, getBlobStats } from '../data';
import { PersonalityType } from '../types';
import { playTapSound, playExpeditionCompleteSound } from '../utils/audio';
import { BlobCanvas } from './BlobCanvas';

import { NETWORKS } from './BuilderHubModal';

interface SummonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSummon: () => PersonalityType | null;
  cubes: number;
  directRevealPersonality?: PersonalityType | null;
  rawWalletAddress?: string | null;
  triggerToast?: (msg: string) => void;
}

export const SummonModal: React.FC<SummonModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirmSummon, 
  cubes, 
  directRevealPersonality,
  rawWalletAddress,
  triggerToast
}) => {
  const [stage, setStage] = useState<'prepare' | 'signing' | 'egg' | 'crack' | 'reveal'>('prepare');
  const [rolledPersonality, setRolledPersonality] = useState<PersonalityType | null>(null);
  const [clicks, setClicks] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; color: string; angle: number; char: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      if (directRevealPersonality) {
        setStage('reveal');
        setRolledPersonality(directRevealPersonality);
      } else {
        setStage('prepare');
        setRolledPersonality(null);
      }
      setClicks(0);
      setParticles([]);
    }
  }, [isOpen, directRevealPersonality]);

  useEffect(() => {
    if (stage === 'signing') {
      const executeTx = async () => {
        const provider = (window as any).ethereum;
        if (provider && rawWalletAddress) {
          try {
            // Get selected network from local storage or default to base
            const netKey = localStorage.getItem('bb_selected_network') || 'base';
            const net = NETWORKS[netKey as 'base' | 'b20'] || NETWORKS.base;
            
            // 1. Request Network Switch/Add
            try {
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: net.chainId }],
              });
            } catch (switchErr: any) {
              if (switchErr.code === 4902) {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [net],
                });
              } else {
                throw switchErr;
              }
            }

            // 2. Build transaction payload
            const customContract = localStorage.getItem('bb_custom_contract') || '';
            const builderCodeStr = 'bc_ch35e92e';
            const builderCodeHex = '62635f6368333565393265'; // UTF-8 hex representation of "bc_ch35e92e"
            
            // Following Base Builder Codes standard: https://docs.base.org/apps/builder-codes/app-developers
            // If custom contract is defined, call summonBlob(string) selector "0x2e061806" with the builder code appended.
            // Otherwise, do a self-transfer with the builder code as the transaction calldata.
            const txData = customContract 
              ? "0x2e061806" + builderCodeHex 
              : "0x" + builderCodeHex;

            const txParams = {
              from: rawWalletAddress,
              to: customContract || rawWalletAddress, // Self-transfer if no contract entered
              value: '0x0',
              data: txData,
            };

            if (triggerToast) triggerToast('Confirm transaction in your wallet to summon!');

            // 3. Request Tx send
            const txHash = await provider.request({
              method: 'eth_sendTransaction',
              params: [txParams],
            });

            console.log('Summon transaction submitted:', txHash);
            if (triggerToast) triggerToast(`Transaction submitted! Hash: ${txHash.slice(0, 10)}...`);

            const personalityResult = onConfirmSummon();
            if (personalityResult) {
              setRolledPersonality(personalityResult);
              setStage('egg');
            } else {
              setStage('prepare');
            }
          } catch (err: any) {
            console.error('Summoning transaction failed:', err);
            if (triggerToast) triggerToast(err.message || 'Transaction rejected/failed.');
            setStage('prepare');
          }
        } else {
          // Simulated summoning if no wallet is connected
          const timer = setTimeout(() => {
            const personalityResult = onConfirmSummon();
            if (personalityResult) {
              setRolledPersonality(personalityResult);
              setStage('egg');
            } else {
              setStage('prepare');
            }
          }, 1800);
          return () => clearTimeout(timer);
        }
      };

      executeTx();
    }
  }, [stage, onConfirmSummon, rawWalletAddress, triggerToast]);

  if (!isOpen) return null;

  const bp = rolledPersonality ? (P[rolledPersonality] || P.happy) : P.happy;
  const stats = rolledPersonality ? getBlobStats(rolledPersonality, 1) : getBlobStats('happy', 1);

  const handleInitiateSummon = () => {
    if (cubes < 1500) return;
    playTapSound();
    setStage('signing');
  };

  const handleEggClick = () => {
    if (stage !== 'egg' && stage !== 'crack') return;

    playTapSound();
    
    // Create click splash particles - binary & tech tokens
    const colors = [bp.glow, '#ffffff', '#00cfff', '#0052ff'];
    const chars = ['0', '1', '0x', 'BASE', 'MINT', 'BLOCK', 'TX', 'L2'];
    const newSplash = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80 - 20,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * 360,
      char: chars[Math.floor(Math.random() * chars.length)],
    }));
    setParticles((prev) => [...prev, ...newSplash]);

    const nextClicks = clicks + 1;
    setClicks(nextClicks);

    if (nextClicks >= 3 && stage === 'egg') {
      setStage('crack');
    } else if (nextClicks >= 6) {
      setStage('reveal');
      playExpeditionCompleteSound();
      
      // Giant burst of cryptographic consensus confetti
      const giantSplash = Array.from({ length: 36 }).map((_, i) => ({
        id: Date.now() + 100 + i,
        x: (Math.random() - 0.5) * 180,
        y: (Math.random() - 0.5) * 180 - 40,
        size: Math.random() * 12 + 8,
        color: [bp.glow, bp.c1, bp.c2, '#ffffff', '#0052ff', '#00cfff'][Math.floor(Math.random() * 6)],
        angle: Math.random() * 360,
        char: chars[Math.floor(Math.random() * chars.length)],
      }));
      setParticles((prev) => [...prev, ...giantSplash]);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center z-[210] p-4">
        
        {/* Particle Canvas layer: Cyber elements floating around */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute left-1/2 top-1/2 font-mono font-black text-center select-none"
              style={{
                fontSize: p.size,
                color: p.color,
                textShadow: `0 0 8px ${p.color}aa`,
              }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: Math.cos((p.angle * Math.PI) / 180) * (150 + Math.random() * 150),
                y: Math.sin((p.angle * Math.PI) / 180) * (150 + Math.random() * 150) - 30,
                scale: [0, 1.2, 0.7, 0],
                opacity: [1, 1, 0.6, 0],
              }}
              transition={{
                type: 'tween',
                duration: 1.5,
                ease: 'easeOut',
              }}
            >
              {p.char}
            </motion.div>
          ))}
        </div>

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
                <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1 font-mono">Consensus Price</div>
                <div className="text-white text-xl font-black font-mono flex items-center justify-center gap-1.5">
                  <span>1500</span>
                  <span className="text-[#00cfff]">💠</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Your Balance: {cubes} 💠
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInitiateSummon}
                  disabled={cubes < 1500}
                  className={`w-full py-3.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-[#0052ff] to-[#00cfff] border border-white/10 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20 cursor-pointer ${
                    cubes < 1500 ? 'opacity-50 cursor-not-allowed filter grayscale' : ''
                  }`}
                >
                  SIGN & INITIATE CONTRACT
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
                  <span className="text-blue-400 font-bold">0xBlobSummoner...</span>
                </div>
                <div>
                  <span className="text-slate-500">Method:</span>{' '}
                  <span className="text-yellow-400 font-semibold">mintRandomBlob()</span>
                </div>
                <div>
                  <span className="text-slate-500">Value:</span> 1500 Cubes (Sponsored)
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

          {/* STAGE 3 & 4: EGG & CRACK (Synthesis interactive phase) */}
          {(stage === 'egg' || stage === 'crack') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0052ff]/10 border border-[#0052ff]/30 rounded-full text-[#00cfff] text-[10px] font-black uppercase tracking-wider mb-4 font-mono">
                  <Cpu className="w-3 h-3 animate-pulse text-[#00cfff]" />
                  <span>Base L2 Compiler Active</span>
                </div>
                <h3 className="text-white text-base font-black tracking-wide font-display">
                  Tap Node to Synthesize!
                </h3>
                <p className="text-slate-400 text-[11px] mt-1 font-semibold font-mono">
                  Consensus Hash: <span className="text-[#00cfff] font-bold">{clicks} / 6 Blocks</span>
                </p>
              </div>

              {/* CENTER INTERACTIVE COMPONENT - blockchain computing node */}
              <div className="relative h-44 flex items-center justify-center my-4">
                <AnimatePresence mode="wait">
                  {stage === 'egg' && (
                    <motion.div
                      key="egg-stage"
                      onClick={handleEggClick}
                      whileTap={{ scale: 0.9 }}
                      animate={{
                        rotateY: [0, 180, 360],
                        y: [0, -6, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="relative select-none cursor-pointer filter drop-shadow-[0_0_20px_rgba(0,82,255,0.45)] hover:brightness-110 active:scale-95"
                    >
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-dashed border-blue-500/30 rounded-2xl animate-spin-slow" />
                        <div className="absolute w-20 h-20 border border-cyan-400/20 rounded-full transform rotate-45 animate-pulse" />
                        <div className="w-14 h-14 rounded-full bg-[#0052ff] flex items-center justify-center border-2 border-white shadow-[0_0_20px_rgba(0,82,255,0.7)]">
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {stage === 'crack' && (
                    <motion.div
                      key="crack-stage"
                      onClick={handleEggClick}
                      whileTap={{ scale: 0.85 }}
                      animate={{
                        rotate: [-8, 8, -8, 8, 0],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                      }}
                      className="relative select-none cursor-pointer filter drop-shadow-[0_0_30px_rgba(0,207,255,0.6)] hover:brightness-125"
                    >
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-solid border-cyan-400 rounded-full animate-ping" />
                        <div className="absolute w-20 h-20 border-2 border-dashed border-white/40 rounded-xl animate-spin" />
                        <div className="w-16 h-16 rounded-full bg-[#0052ff] flex items-center justify-center border-2 border-white shadow-[0_0_25px_#00cfff]">
                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#0052ff] text-[8px] font-black font-mono">
                            MINT
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-[9px] text-slate-500 mt-4 leading-none font-mono">
                Compiles 1 unique Blob NFT with randomized Base attributes.
              </p>
            </motion.div>
          )}

          {/* STAGE 5: REVEAL (Final unlocked companion) */}
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

                {/* Companion Base Stats */}
                <div className="grid grid-cols-3 gap-2 bg-slate-900/50 border border-white/5 rounded-2xl p-3 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                      <Flame className="w-3 h-3 text-red-400" />
                      <span>Pow</span>
                    </div>
                    <div className="text-white font-mono text-sm font-black mt-1">
                      {stats.power}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Spd</span>
                    </div>
                    <div className="text-white font-mono text-sm font-black mt-1">
                      {stats.speed}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span>Lck</span>
                    </div>
                    <div className="text-white font-mono text-sm font-black mt-1">
                      {stats.luck}
                    </div>
                  </div>
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
