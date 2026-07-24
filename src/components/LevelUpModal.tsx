/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, ArrowRight, Zap, Shield, Flame } from 'lucide-react';
import { P, getBlobStats, EVOLUTION_NAMES, EVOLUTION_EMOJIS, getEvolutionStage } from '../data';
import { PersonalityType } from '../types';
import { playTapSound } from '../utils/audio';

interface LevelUpModalProps {
  isOpen: boolean;
  info: {
    blobId: string;
    personality: PersonalityType;
    oldLevel: number;
    newLevel: number;
    evolved: boolean;
    oldStage: number;
    newStage: number;
  } | null;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, info, onClose }) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; color: string; delay: number; angle: number }>>([]);

  useEffect(() => {
    if (isOpen && info) {
      // Generate a burst of 28 confetti/sparkle particles
      const bp = P[info.personality] || P.happy;
      const colors = [bp.glow, bp.c1, bp.c2, '#ffaa00', '#ffffff', '#00ff88'];
      const newParticles = Array.from({ length: 32 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 160, // Spread outwards from center
        y: (Math.random() - 0.5) * 160,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.15,
        angle: Math.random() * 360,
      }));
      setParticles(newParticles);
    }
  }, [isOpen, info]);

  if (!isOpen || !info) return null;

  const bp = P[info.personality] || P.happy;
  const oldStats = getBlobStats(info.personality, info.oldLevel);
  const newStats = getBlobStats(info.personality, info.newLevel);

  const statDiffs = {
    power: newStats.power - oldStats.power,
    speed: newStats.speed - oldStats.speed,
    luck: newStats.luck - oldStats.luck,
  };

  const oldStageName = EVOLUTION_NAMES[info.oldStage];
  const newStageName = EVOLUTION_NAMES[info.newStage];
  const newStageEmoji = EVOLUTION_EMOJIS[info.newStage];

  const handleClose = () => {
    playTapSound();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[200] p-4 overflow-y-auto">
        
        {/* Particle / Confetti Layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute left-1/2 top-1/2 rounded-full shadow-lg"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: Math.cos((p.angle * Math.PI) / 180) * (120 + Math.random() * 140),
                y: Math.sin((p.angle * Math.PI) / 180) * (120 + Math.random() * 140) - 50, // slightly float up
                scale: [0, 1.2, 0.8, 0],
                opacity: [1, 1, 0.8, 0],
                rotate: p.angle * 2,
              }}
              transition={{
                type: 'tween',
                duration: 1.6,
                ease: 'easeOut',
                delay: p.delay,
              }}
            />
          ))}
        </div>

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.85, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative bg-[#08102d] border-2 border-[#0078ff]/50 rounded-3xl p-6 w-full max-w-[340px] text-center shadow-2xl overflow-hidden"
          style={{
            boxShadow: `0 0 40px ${bp.glow}15, inset 0 0 25px ${bp.glow}10`,
          }}
        >
          {/* Subtle Ambient Aura Background */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full filter blur-[70px] opacity-15 pointer-events-none"
            style={{ backgroundColor: bp.glow }}
          />

          {/* Top Sparkling Badge */}
          <motion.div
            initial={{ y: -15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-bold uppercase tracking-wider mb-5 shadow-inner"
          >
            <Trophy className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
            <span>Level Up!</span>
          </motion.div>

          {/* Blob Big Animated Avatar */}
          <div className="relative mb-4 flex justify-center">
            <motion.div
              initial={{ scale: 0.3, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 11 }}
              className="w-24 h-24 rounded-full flex items-center justify-center relative bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-2 border-slate-700/50 shadow-xl"
              style={{
                borderColor: bp.glow + '55',
                boxShadow: `0 8px 24px -4px ${bp.glow}44`,
              }}
            >
              <span className="text-5xl select-none filter drop-shadow-[0_4px_12px_rgba(255,255,255,0.25)]">
                {bp.emoji}
              </span>

              {/* Decorative Pulsing Halo Ring */}
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border-2 pointer-events-none"
                style={{ borderColor: bp.glow + '33' }}
              />

              {/* Tiny Sparkles around the blob */}
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 animate-spin-slow" />
              <Sparkles className="absolute -bottom-1 -left-1 w-4 h-4 text-[#00ff88] animate-pulse" />
            </motion.div>
          </div>

          {/* Evolved Banner */}
          {info.evolved && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-emerald-500/20 border border-green-500/30 rounded-xl mb-4 shadow-lg shadow-green-500/5"
            >
              <div className="text-[10px] uppercase font-black text-emerald-400 tracking-widest flex items-center justify-center gap-1">
                <span>Evolution Reached!</span>
                <Sparkles className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-white text-sm font-black mt-0.5 flex items-center justify-center gap-1.5">
                <span className="text-base">{newStageEmoji}</span>
                <span>{newStageName}</span>
              </div>
            </motion.div>
          )}

          {/* Personality / Level Info */}
          <div className="mb-6">
            <h4 className="text-white text-lg font-black tracking-wide">
              {bp.name} Blob
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {bp.bonus}
            </p>

            {/* Level Counter Banner */}
            <div className="flex items-center justify-center gap-4 mt-4 bg-white/5 border border-white/5 rounded-2xl py-2 px-5 max-w-[200px] mx-auto">
              <span className="text-slate-400 text-xs font-bold">Lv.{info.oldLevel}</span>
              <ArrowRight className="w-4 h-4 text-[#0078ff]" />
              <span className="text-white text-sm font-black bg-[#0055ff]/30 px-3 py-1 rounded-lg border border-[#00aaff]/40">
                Lv.{info.newLevel}
              </span>
            </div>
          </div>

          {/* Stats Improvements List */}
          <div className="space-y-2.5 bg-slate-900/60 border border-white/5 rounded-2xl p-4 text-left mb-6 relative">
            <div className="text-[10px] uppercase font-black text-[#00aaff] tracking-widest mb-1 text-center">
              Stats Upgraded
            </div>

            {/* Power Stat */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span>Power</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-400">{oldStats.power}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-white font-bold">{newStats.power}</span>
                <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-1 py-0.5 rounded">
                  +{statDiffs.power}
                </span>
              </div>
            </div>

            {/* Speed Stat */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>Speed</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-400">{oldStats.speed}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-white font-bold">{newStats.speed}</span>
                <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-1 py-0.5 rounded">
                  +{statDiffs.speed}
                </span>
              </div>
            </div>

            {/* Luck Stat */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Luck</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-400">{oldStats.luck}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-white font-bold">{newStats.luck}</span>
                <span className="text-emerald-400 text-[10px] font-black bg-emerald-500/10 px-1 py-0.5 rounded">
                  +{statDiffs.luck}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClose}
            className="w-full py-3.5 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-[#0052ff] to-[#00aaff] border border-white/10 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            Awesome! ✨
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
