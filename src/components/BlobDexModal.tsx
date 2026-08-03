/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Lock, Check, Eye, EyeOff, X } from 'lucide-react';
import { PersonalityType, Blob } from '../types';
import { P, PKEYS, getBlobStats } from '../data';
import { BlobCanvas } from './BlobCanvas';

interface BlobDexModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobs: Blob[];
  cubes: number;
  onUnlockSpecies: (personality: PersonalityType) => void;
  onPreviewSpecies: (personality: PersonalityType) => void;
  onClosePreview: () => void;
  previewingPersonality: PersonalityType | null;
}

export const BlobDexModal: React.FC<BlobDexModalProps> = ({
  isOpen,
  onClose,
  blobs,
  cubes,
  onUnlockSpecies,
  onPreviewSpecies,
  onClosePreview,
  previewingPersonality,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center z-50 animate-fade-in p-0 sm:p-4">
      {/* Container matching phone format bounds */}
      <div className="bg-[#070e28] border-t sm:border border-[#00cfff]/20 rounded-t-3xl sm:rounded-3xl w-full max-w-[420px] h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div>
              <h3 className="text-white text-sm font-black tracking-tight">BLOBDEX / GALLERY</h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Explore species & unlock your favorites</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable grid content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 text-[11px] leading-relaxed text-slate-300">
            💡 Each of the <span className="text-[#00cfff] font-bold">5 premium personalities</span> has a unique passive booster. 
            Level them up to evolve their visual stage! You can summon randomly for <span className="text-amber-400 font-bold">1500 💠</span> or directly unlock a specific species for <span className="text-[#00cfff] font-bold">3000 💠</span> below.
          </div>

          {PKEYS.map((pk) => {
            const pInfo = P[pk];
            // Find if player owns this species
            const ownedInstances = blobs.filter((b) => b.personality === pk);
            const isOwned = ownedInstances.length > 0;
            const maxLevel = isOwned ? Math.max(...ownedInstances.map((o) => o.level)) : 0;
            const stats = getBlobStats(pk, isOwned ? maxLevel : 1);
            const isCurrentlyPreviewing = previewingPersonality === pk;

            return (
              <div
                key={pk}
                className={`relative rounded-2xl border bg-black/40 p-4 transition-all flex flex-col gap-3 overflow-hidden ${
                  isOwned 
                    ? 'border-emerald-500/20 shadow-md shadow-emerald-500/2' 
                    : 'border-white/5'
                }`}
              >
                {/* Visual gradient backdrop strip based on blob color */}
                <div 
                  className="absolute top-0 right-0 bottom-0 w-1.5"
                  style={{ backgroundColor: pInfo.glow }}
                />

                <div className="flex items-center gap-3.5">
                  {/* Miniature Animated Canvas */}
                  <div 
                    className="w-[72px] h-[72px] rounded-xl flex items-center justify-center flex-shrink-0 relative border overflow-hidden"
                    style={{ 
                      backgroundColor: `${pInfo.glow}10`,
                      borderColor: `${pInfo.glow}20`,
                    }}
                  >
                    <BlobCanvas personality={pk} size={64} animate={true} />
                  </div>

                  {/* Species Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-black tracking-tight">
                        {pInfo.name} {pInfo.emoji}
                      </span>
                      {isOwned ? (
                        <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="w-2 h-2" />
                          <span>Owned (Lv.{maxLevel})</span>
                        </span>
                      ) : (
                        <span className="bg-slate-500/10 border border-white/5 text-slate-400 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Lock className="w-2 h-2" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[10px] text-slate-300 mt-1.5 font-semibold bg-white/5 px-2 py-1 rounded-lg border border-white/5 inline-block">
                      ⚡ Bonus: <span className="font-mono text-[#00cfff]">{pInfo.bonus}</span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <div className="bg-white/5 border border-white/5 rounded-lg px-1 py-1.5 flex flex-col items-center">
                        <span className="text-[6.5px] text-slate-400 font-mono tracking-wider uppercase">💪 Power</span>
                        <span className="text-[10px] font-extrabold font-mono text-emerald-400 mt-0.5">{stats.power}</span>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-lg px-1 py-1.5 flex flex-col items-center">
                        <span className="text-[6.5px] text-slate-400 font-mono tracking-wider uppercase">⚡ Speed</span>
                        <span className="text-[10px] font-extrabold font-mono text-cyan-400 mt-0.5">{stats.speed}</span>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-lg px-1 py-1.5 flex flex-col items-center">
                        <span className="text-[6.5px] text-slate-400 font-mono tracking-wider uppercase">🍀 Luck</span>
                        <span className="text-[10px] font-extrabold font-mono text-amber-400 mt-0.5">{stats.luck}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className="text-[8px] font-mono text-slate-500">Color DNA:</span>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full border border-white/10" style={{ backgroundColor: pInfo.c1 }} />
                        <span className="w-2 h-2 rounded-full border border-white/10" style={{ backgroundColor: pInfo.c2 }} />
                        <span className="w-2 h-2 rounded-full border border-white/10" style={{ backgroundColor: pInfo.c3 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="grid grid-cols-2 gap-2 mt-1 pt-1.5 border-t border-white/5">
                  {/* Preview Stage button */}
                  {isCurrentlyPreviewing ? (
                    <button
                      onClick={onClosePreview}
                      className="py-2 rounded-xl text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Stop Preview</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onPreviewSpecies(pk)}
                      className="py-2 rounded-xl text-[10px] font-bold text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Stage</span>
                    </button>
                  )}

                  {/* Unlock button */}
                  {isOwned ? (
                    <button
                      disabled
                      className="py-2 rounded-xl text-[10px] font-bold text-slate-500 bg-white/5 border border-white/5 flex items-center justify-center gap-1 cursor-not-allowed opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unlocked</span>
                    </button>
                  ) : (
                    <div className="py-2 rounded-xl text-[9px] font-bold text-slate-500 bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-1 select-none">
                      <Lock className="w-3 h-3 text-slate-500" />
                      <span>Summon in Shop</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Total Balance bar */}
        <div className="p-4 bg-black/60 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[10px] font-semibold">Your Balance:</span>
            <div className="flex items-center gap-1 bg-[#060a1f] px-2 py-0.5 rounded-lg border border-white/5 text-[11px] font-bold font-mono">
              <span>💠</span>
              <span>{cubes}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
