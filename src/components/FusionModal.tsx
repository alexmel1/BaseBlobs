import React, { useState } from 'react';
import { Blob, TraitId } from '../types';
import { FUSION_CONFIG, TRAITS, TRAIT_KEYS } from '../data';

interface FusionModalProps {
  blobs: Blob[];
  cubes: number;
  lastFusionTime: number;
  onFuse: (blobAId: string, blobBId: string) => void;
  onClose: () => void;
}

const PERSONALITY_COLORS: Record<string, string> = {
  happy: '#00aaff', sleepy: '#aa44ff', lucky: '#00ff88',
  chaotic: '#ff44aa', cosmic: '#8844ff',
};

const MOOD_EMOJI = ['😢', '😴', '😐', '😊'];

export function FusionModal({ blobs, cubes, lastFusionTime, onFuse, onClose }: FusionModalProps) {
  const [blobA, setBlobA] = useState<string | null>(null);
  const [blobB, setBlobB] = useState<string | null>(null);

  const cooldownLeft = Math.max(0, lastFusionTime + FUSION_CONFIG.cooldownHours * 3600000 - Date.now());
  const isCooling = cooldownLeft > 0;

  const blobAObj = blobs.find(b => b.id === blobA);
  const blobBObj = blobs.find(b => b.id === blobB);

  // Preview result
  const previewLevel = blobAObj && blobBObj
    ? FUSION_CONFIG.calcNewLevel(blobAObj.level, blobBObj.level)
    : null;

  const fusionCost = blobAObj && blobBObj
    ? (blobAObj.level + blobBObj.level) * FUSION_CONFIG.costPerLevel
    : 0;

  const samePersonality = blobAObj && blobBObj
    && blobAObj.personality === blobBObj.personality;

  const canFuse = blobA && blobB
    && blobA !== blobB
    && cubes >= fusionCost
    && !isCooling
    && blobs.length > 2; // cannot leave player with 0 blobs

  const selectBlob = (id: string) => {
    if (blobA === id) { setBlobA(null); return; }
    if (blobB === id) { setBlobB(null); return; }
    if (!blobA) { setBlobA(id); return; }
    if (!blobB) { setBlobB(id); return; }
    setBlobA(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
      <div className="w-full bg-[#08102a] border-t border-white/10 rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">✨ Fusion Lab</h2>
            <p className="text-slate-400 text-xs mt-0.5">Merge two Blobs into one stronger Blob</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Cooldown warning */}
        {isCooling && (
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3 mb-4 text-amber-400 text-xs text-center">
            ⏳ Fusion cooldown: {Math.ceil(cooldownLeft / 3600000)}h remaining
          </div>
        )}

        {/* Min blobs warning */}
        {blobs.length <= 2 && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-xs text-center">
            Need at least 3 Blobs to use Fusion (can't fuse your last Blobs)
          </div>
        )}

        {/* Blob selection */}
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
          Select 2 Blobs to merge:
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {blobs.map(blob => {
            const isA = blob.id === blobA;
            const isB = blob.id === blobB;
            const isSelected = isA || isB;
            const color = PERSONALITY_COLORS[blob.personality] ?? '#0088ff';
            const mood = blob.mood?.level ?? 2;

            return (
              <button
                key={blob.id}
                onClick={() => selectBlob(blob.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-opacity-60 bg-opacity-20'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                style={isSelected ? { borderColor: color + '99', backgroundColor: color + '18' } : {}}
              >
                {/* Slot badge */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: isSelected ? color + '33' : '#ffffff12', color: isSelected ? color : '#475569' }}
                >
                  {isA ? 'A' : isB ? 'B' : '·'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-sm font-semibold capitalize">{blob.personality}</span>
                    <span className="text-slate-400 text-xs">Lv.{blob.level}</span>
                    <span className="text-xs">{MOOD_EMOJI[mood]}</span>
                    {blob.trait && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {TRAITS[blob.trait].icon}
                      </span>
                    )}
                    {blob.isRadiant && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        ✦ Radiant
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">
                    Upgrades: S{blob.upgrades.speed} H{blob.upgrades.harvest} F{blob.upgrades.fortune}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Fusion preview */}
        {blobAObj && blobBObj && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-3">Fusion Preview</p>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 text-center">
                <div className="text-sm text-white font-semibold capitalize">{blobAObj.personality}</div>
                <div className="text-xs text-slate-400">Lv.{blobAObj.level}</div>
              </div>
              <div className="text-white text-lg">+</div>
              <div className="flex-1 text-center">
                <div className="text-sm text-white font-semibold capitalize">{blobBObj.personality}</div>
                <div className="text-xs text-slate-400">Lv.{blobBObj.level}</div>
              </div>
              <div className="text-white text-lg">=</div>
              <div className="flex-1 text-center">
                <div className="text-sm font-bold" style={{ color: '#00ccff' }}>
                  {samePersonality ? (
                    <span className="text-yellow-300">
                      {blobAObj.personality} / ✦ Radiant
                    </span>
                  ) : (
                    <span className="capitalize">{blobAObj.personality}</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">Lv.{previewLevel}</div>
              </div>
            </div>

            {/* Probabilities */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2">
                <div className="text-purple-300 font-semibold mb-0.5">Trait chance</div>
                <div className="text-slate-300">{FUSION_CONFIG.traitChance * 100}% — random trait</div>
              </div>
              {samePersonality && (
                <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-2">
                  <div className="text-yellow-300 font-semibold mb-0.5">Radiant chance</div>
                  <div className="text-slate-300">{FUSION_CONFIG.radiantChance * 100}% — rare form</div>
                </div>
              )}
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-2">
                <div className="text-red-300 font-semibold mb-0.5">Warning</div>
                <div className="text-slate-300">Both Blobs are consumed</div>
              </div>
              <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-2">
                <div className="text-blue-300 font-semibold mb-0.5">New level</div>
                <div className="text-slate-300">Lv.{blobAObj.level} + floor(Lv.{blobBObj.level}/3)</div>
              </div>
            </div>

            {/* Cost */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8">
              <span className="text-slate-400 text-xs">Fusion cost</span>
              <span className={`font-bold text-sm ${cubes >= fusionCost ? 'text-white' : 'text-red-400'}`}>
                💠 {fusionCost.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            disabled={!canFuse}
            onClick={() => blobA && blobB && onFuse(blobA, blobB)}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canFuse
                ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                : '#1e293b',
            }}
          >
            ✨ Fuse Blobs
          </button>
        </div>
      </div>
    </div>
  );
}
