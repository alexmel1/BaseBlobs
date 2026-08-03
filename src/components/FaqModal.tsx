import React from 'react';
import { X, HelpCircle, Sparkles, Shield, Zap, Flame, Atom, MapPin, Radio, Compass, Lightbulb, ChevronRight } from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FaqModal({ isOpen, onClose }: FaqModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#070e28] border border-white/10 rounded-3xl w-full max-w-[520px] max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0052ff]/20 border border-[#0052ff]/40 flex items-center justify-center text-[#00cfff]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm tracking-wide font-display flex items-center gap-1.5">
                BASE L2 REGISTRY
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">System Documentation & Manual</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs leading-relaxed">
          
          {/* Section 1: Summoning New Blobs */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">🥚</span>
              <h3>Summoning New Blobs</h3>
            </div>
            <p className="text-slate-300">
              Each new Blob is compiled via the Base L2 Factory for a Cube fee. The fee scales up with every Blob you already own — your collection has a maximum capacity of <strong className="text-white">10 Blobs</strong>.
            </p>

            {/* Price Table */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 font-mono text-[11px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-bold">
                    <th className="py-2 px-3">Blob #</th>
                    <th className="py-2 px-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr><td className="py-1.5 px-3">1st</td><td className="py-1.5 px-3 text-[#00cfff] font-bold">1,500 💠</td></tr>
                  <tr><td className="py-1.5 px-3">2nd</td><td className="py-1.5 px-3 text-[#00cfff] font-bold">2,000 💠</td></tr>
                  <tr><td className="py-1.5 px-3">3rd</td><td className="py-1.5 px-3 text-[#00cfff] font-bold">2,500 💠</td></tr>
                  <tr><td className="py-1.5 px-3 text-slate-500">...</td><td className="py-1.5 px-3 text-slate-400">+500 💠 each time</td></tr>
                  <tr><td className="py-1.5 px-3 font-bold text-amber-400">10th</td><td className="py-1.5 px-3 text-amber-400 font-bold">6,000 💠</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-400 text-[11px] italic">
              Plan your Cube spending — later slots cost more, but each new Blob is a fresh roll on personality, meaning more coverage across all specializations (XP farming, crit-chasing, Node defense, and more).
            </p>
          </div>

          {/* Section 2: Core Stats */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">⚙️</span>
              <h3>Your Blobs — Core Stats</h3>
            </div>
            <p className="text-slate-300">
              Every Blob compiles with three on-chain-flavored stats:
            </p>
            <ul className="space-y-2 font-mono text-[11px]">
              <li className="flex items-start gap-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <span className="text-red-400 font-bold shrink-0">⚔️ POWER:</span>
                <span className="text-slate-300">Combat weight when attacking or defending Network Nodes.</span>
              </li>
              <li className="flex items-start gap-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <span className="text-amber-400 font-bold shrink-0">⚡ SPEED:</span>
                <span className="text-slate-300">Reduces Expedition block-confirmation time.</span>
              </li>
              <li className="flex items-start gap-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <span className="text-emerald-400 font-bold shrink-0">🍀 LUCK:</span>
                <span className="text-slate-300">Chance to trigger a double-reward consensus event when an Expedition settles.</span>
              </li>
            </ul>
            <p className="text-slate-400 text-[11px]">
              Stats scale automatically as your Blob levels up from XP — each personality has its own growth curve.
            </p>
          </div>

          {/* Section 3: Personality Modules */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">🧬</span>
              <h3>Personality Modules</h3>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="p-2 bg-blue-950/30 border border-blue-500/20 rounded-xl">
                <span className="font-bold text-blue-400">Happy</span> — <span className="text-slate-300">+20% bonus XP yield per Expedition. Optimized for fast leveling.</span>
              </div>
              <div className="p-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
                <span className="font-bold text-emerald-400">Lucky</span> — <span className="text-slate-300">Highest base LUCK stat, plus a flat +15% Cube reward multiplier. Built for crit-farming.</span>
              </div>
              <div className="p-2 bg-purple-950/30 border border-purple-500/20 rounded-xl">
                <span className="font-bold text-purple-400">Cosmic</span> — <span className="text-slate-300">Unlocks a +25% Cube reward multiplier once it reaches Level 10. Late-game payoff.</span>
              </div>
              <div className="p-2 bg-pink-950/30 border border-pink-500/20 rounded-xl">
                <span className="font-bold text-pink-400">Chaotic</span> — <span className="text-slate-300">Random chance to trigger a +50% Cube reward spike on any Expedition. High variance, high reward.</span>
              </div>
              <div className="p-2 bg-indigo-950/30 border border-indigo-500/20 rounded-xl">
                <span className="font-bold text-indigo-300">Sleepy</span> — <span className="text-slate-300">Naturally high POWER. The go-to unit for capturing and holding Network Nodes.</span>
              </div>
            </div>
          </div>

          {/* Section 4: Upgrade Branches */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">🔧</span>
              <h3>Upgrade Branches</h3>
            </div>
            <p className="text-slate-300">
              Every Blob is born with its own random set of <strong className="text-white">3 branches out of 7</strong>.
              The set is fixed at summon and can never be rerolled — so two Blobs of the same
              personality can play completely differently. Each branch goes up to level 5.
            </p>

            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 pt-1">
              Farm branches
            </div>
            <ul className="space-y-1.5 text-[11px] font-mono">
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-amber-400">Harvest:</strong> Increases base Cube yield from Expeditions.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-cyan-400">Speed:</strong> Further reduces Expedition duration.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-yellow-400">Fortune:</strong> Increases LUCK-based crit chance for double rewards.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-violet-400">Insight:</strong> More XP per Expedition — up to +65% at max.
              </li>
            </ul>

            <div className="text-[10px] font-black uppercase tracking-wider text-orange-400 pt-1">
              Combat branches
            </div>
            <ul className="space-y-1.5 text-[11px] font-mono">
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-rose-400">Vigor:</strong> Raw POWER multiplier — helps both attack and defense.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-blue-400">Guard:</strong> Strengthens the defense of Nodes this Blob holds.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-orange-400">Ferocity:</strong> Stronger when attacking someone else's Node.
              </li>
            </ul>

            <p className="text-slate-400 text-[11px]">
              Every Blob is guaranteed at least one Farm and one Combat branch. Higher tiers
              unlock as the Blob levels up; how many branches you can develop at once depends
              on evolution stage (1 at Base, 2 at Glow, 3 at Crystal).
            </p>
          </div>

          {/* Section 4b: Expedition Events */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">🎲</span>
              <h3>Expedition Events</h3>
            </div>
            <p className="text-slate-300">
              Every completed Expedition rolls one event on settlement:
            </p>
            <ul className="space-y-1.5 text-[11px] font-mono">
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-slate-300">✅ Safe Return (40%):</strong> Standard payout.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-emerald-400">💎 Rich Vein (25%):</strong> ×1.5 Cubes.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-sky-400">🌩️ Data Storm (12%):</strong> ×0.85 Cubes, but ×1.3 XP — a trade, not a loss.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-pink-400">🎁 Blob Charm (11%):</strong> Next Expedition pays double Cubes.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-violet-400">🔮 Awakening (8%):</strong> Double XP.
              </li>
              <li className="bg-black/20 p-2 rounded-xl border border-white/5">
                <strong className="text-amber-400">👑 Jackpot (4%):</strong> ×3 Cubes and ×1.5 XP.
              </li>
            </ul>
          </div>

          {/* Section 5: Expeditions */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">🚀</span>
              <h3>Expeditions</h3>
            </div>
            <p className="text-slate-300">
              Deploy a Blob to a Zone to mine Cubes + XP over time. Higher-tier Zones = longer runtime, bigger payout. On settlement, a random network event may fire — bonus multipliers, rare drops, and more — rolled the moment you collect.
            </p>
          </div>

          {/* Section 6: Network Nodes */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">MAP</span>
              <h3>Network Nodes</h3>
            </div>
            <p className="text-slate-300">
              Nodes are map-based yield sources that generate passive Cubes once captured (accumulates up to 24h — collect on a schedule, don't let it cap out).
            </p>
            <div className="space-y-2 text-[11px]">
              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                <span className="font-bold text-red-400 font-mono">Attacking:</span> <span className="text-slate-300">Your Blob's POWER (boosted by Vigor, then by Ferocity when attacking) is checked against the node's defense. Higher = guaranteed capture. Within 75-100% of their defense = coin-flip odds. Below that = attempt fails.</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                <span className="font-bold text-blue-400 font-mono">Defending:</span> <span className="text-slate-300">A node is defended by the POWER of the Blob that captured it. If that Blob has the Guard branch, its defense is multiplied — up to +70% at max level.</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                <span className="font-bold text-blue-400 font-mono">Fortification:</span> <span className="text-slate-300">The longer you hold a node, the more fortified it gets — up to +50% extra defense after several days of continuous ownership. Long-term holders are genuinely harder to dislodge.</span>
              </div>
              <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                <span className="font-bold text-amber-400 font-mono">Cooldown:</span> <span className="text-slate-300">Every attack attempt (win or lose) triggers a short cooldown on that node before it can be hit again — no back-to-back spam attacks.</span>
              </div>
            </div>
          </div>

          {/* Section 7: The Reactor */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="text-base">☢️</span>
              <h3>The Reactor</h3>
            </div>
            <p className="text-slate-300">
              A recurring, community-wide event: contribute Cubes toward a shared pool target. When the target is hit (or the event closes), every contributor gets a proportional share of $BLOBS tokens, claimable directly to your wallet on Base. Claiming is a real on-chain transaction — small gas fee applies.
            </p>
          </div>

          {/* Section 8: Protocol Tips */}
          <div className="bg-gradient-to-br from-amber-950/30 to-blue-950/30 border border-amber-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h3>Protocol Tips</h3>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>Keep Expeditions and Node collection cycling — idle yield compounds fast.</li>
              <li>Check each Blob's branch set before investing — a Blob with Vigor or Ferocity is your Node raider, one with Harvest and Insight is your farmer. Build to what it rolled instead of fighting it.</li>
              <li>Summon more Blobs to hunt for branch sets you're missing: the roll is fixed at summon and can't be changed later.</li>
              <li>Watch for open Reactor events — limited-time window to convert Cubes into real $BLOBS.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-xs font-black text-white bg-slate-800 hover:bg-slate-700 border border-white/10 active:scale-95 transition-all cursor-pointer font-mono"
          >
            CLOSE SYSTEM DOCS
          </button>
        </div>

      </div>
    </div>
  );
}
