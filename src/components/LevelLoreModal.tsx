import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Radio, BookOpen, X, ChevronRight } from 'lucide-react';
import { P, LEVEL_LORE } from '../data';
import { PersonalityType } from '../types';
import { playTapSound } from '../utils/audio';

export interface LoreInfo {
  blobId: string;
  personality: PersonalityType;
  level: number; // Milestone level to display
  blobLevel?: number; // Actual current blob level
  title: string;
  text: string;
}

interface LevelLoreModalProps {
  isOpen: boolean;
  loreInfo: LoreInfo | null;
  onClose: () => void;
}

export const LevelLoreModal: React.FC<LevelLoreModalProps> = ({ isOpen, loreInfo, onClose }) => {
  if (!isOpen || !loreInfo) return null;

  const bp = P[loreInfo.personality] || P.happy;

  const handleClose = () => {
    playTapSound();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[210] p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.85, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative bg-[#070e28] border-2 border-amber-500/40 rounded-3xl p-6 w-full max-w-[390px] text-center shadow-2xl overflow-hidden"
          style={{
            boxShadow: `0 0 40px ${bp.glow}20, inset 0 0 25px ${bp.glow}10`,
          }}
        >
          {/* Subtle Ambient Aura Background */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full filter blur-[70px] opacity-15 pointer-events-none"
            style={{ backgroundColor: bp.glow }}
          />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top Sparkling Badge */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-[10px] font-extrabold uppercase tracking-widest mb-3 shadow-inner"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Network Transmission • Level {loreInfo.level}</span>
          </motion.div>

          {/* Blob Icon / Emoji Header */}
          <div className="relative mb-3 flex justify-center">
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center relative bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 border-2 border-amber-500/40 shadow-xl"
              style={{
                boxShadow: `0 8px 24px -4px ${bp.glow}44`,
              }}
            >
              <span className="text-4xl select-none filter drop-shadow-[0_4px_12px_rgba(255,255,255,0.25)]">
                {bp.emoji}
              </span>
              <Sparkles className="absolute -top-1.5 -right-1.5 w-5 h-5 text-amber-400 animate-pulse" />
            </motion.div>
          </div>

          {/* Lore Title */}
          <h3 className="text-white text-xl font-black tracking-wide mb-1 font-display">
            {loreInfo.title}
          </h3>
          <p className="text-[11px] font-mono text-amber-400/90 font-bold mb-4 uppercase tracking-wider">
            {bp.name} Blob Milestone • Lv.{loreInfo.level}
          </p>

          {/* Lore Text Card */}
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 text-left mb-5 shadow-inner relative">
            <BookOpen className="w-4 h-4 text-amber-400/60 absolute top-3 right-3 pointer-events-none" />
            <p className="text-slate-200 text-xs leading-relaxed font-sans italic">
              "{loreInfo.text}"
            </p>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClose}
            className="w-full py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 border border-amber-300/30 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/20 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <span>Acknowledge Signal ✨</span>
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

