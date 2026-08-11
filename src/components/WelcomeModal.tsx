import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Sparkles, X, ChevronRight } from 'lucide-react';
import { P } from '../data';
import { Blob } from '../types';
import { playTapSound } from '../utils/audio';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob?: Blob | null;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, blob }) => {
  if (!isOpen) return null;

  const bp = blob ? (P[blob.personality] || P.happy) : P.happy;

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
          className="relative bg-[#070e28] border-2 border-cyan-500/40 rounded-3xl p-6 w-full max-w-[420px] text-center shadow-2xl overflow-hidden"
          style={{
            boxShadow: `0 0 40px ${bp.glow}25, inset 0 0 25px ${bp.glow}10`,
          }}
        >
          {/* Subtle Ambient Aura Background */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full filter blur-[80px] opacity-20 pointer-events-none"
            style={{ backgroundColor: bp.glow }}
          />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top Network Badge */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500/20 via-blue-500/25 to-cyan-500/20 border border-cyan-500/40 rounded-full text-cyan-300 text-[10px] font-extrabold uppercase tracking-widest mb-4 shadow-inner"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Network Genesis • Signal Online</span>
          </motion.div>

          {/* Blob Icon / Emoji Avatar */}
          <div className="relative mb-4 flex justify-center">
            <motion.div
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-3xl flex items-center justify-center relative bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 border-2 border-cyan-500/40 shadow-xl"
              style={{
                boxShadow: `0 8px 28px -4px ${bp.glow}55`,
              }}
            >
              <span className="text-5xl select-none filter drop-shadow-[0_4px_16px_rgba(255,255,255,0.3)]">
                {bp.emoji}
              </span>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-cyan-300 animate-pulse" />
            </motion.div>
          </div>

          {/* Title */}
          <h3 className="text-white text-2xl font-black tracking-tight mb-4 font-display">
            Welcome to the network.
          </h3>

          {/* Body Text */}
          <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-4 text-left mb-6 shadow-inner space-y-3">
            <p className="text-slate-300 text-xs leading-relaxed font-sans">
              Right now, thousands of transactions are settling across Base — blocks
              confirming, stablecoins moving, x402 payments firing between agents that
              never sleep.
            </p>
            <p className="text-cyan-200 text-xs font-semibold leading-relaxed font-sans italic border-l-2 border-cyan-400/60 pl-3">
              Somewhere in all of that noise, a Blob was just born. Yours.
            </p>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClose}
            className="w-full py-3.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 border border-cyan-300/40 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-cyan-500/25 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <span>Enter the Network</span>
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
