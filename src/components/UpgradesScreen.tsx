import React from 'react';
import { Blob, BlobUpgrades, EvolutionStage } from '../types';
import { UPGRADES, EVOLUTION_NAMES, EVOLUTION_EMOJIS, canUpgrade, getEvolutionStage, getUpgradeSlots } from '../data';

interface Props {
  selectedBlob: Blob;
  cubes: number;
  onUpgrade: (blobId: string, branch: 'speed' | 'harvest' | 'fortune') => void;
}

export const UpgradesScreen: React.FC<Props> = ({ selectedBlob, cubes, onUpgrade }) => {
  const stage = getEvolutionStage(selectedBlob.level);
  const slots = getUpgradeSlots(selectedBlob.level);

  return (
    <div style={{ padding: '0 14px 24px' }}>

      {/* Evolution status banner */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>{EVOLUTION_EMOJIS[stage]}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
            {selectedBlob.personality.charAt(0).toUpperCase() + selectedBlob.personality.slice(1)} — {EVOLUTION_NAMES[stage]}
          </p>
          <p style={{ color: 'rgba(180,200,255,0.6)', fontSize: 10, marginTop: 2 }}>
            {stage < 3
              ? `Next evolution at Lv.${[5, 10, 20][stage]} · ${slots} upgrade branch${slots > 1 ? 'es' : ''} unlocked`
              : 'Max evolution · All upgrades available'}
          </p>
        </div>
        <div style={{
          background: 'rgba(0,100,255,0.2)',
          border: '1px solid rgba(0,150,255,0.3)',
          borderRadius: 8,
          padding: '4px 10px',
          color: '#4a9eff',
          fontSize: 11,
          fontWeight: 600,
        }}>
          Lv. {selectedBlob.level}
        </div>
      </div>

      {/* Upgrade branches */}
      {UPGRADES.map(branch => {
        const currentLv = selectedBlob.upgrades[branch.id] || 0;
        const isMaxed = currentLv >= 5;
        const check = !isMaxed ? canUpgrade(
          branch.id, currentLv, selectedBlob.level,
          selectedBlob.upgrades, cubes, stage
        ) : { allowed: false };
        const nextLevel = !isMaxed ? branch.levels[currentLv] : null;

        return (
          <div key={branch.id} style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${branch.color}33`,
            borderRadius: 14,
            padding: '14px',
            marginBottom: 10,
          }}>
            {/* Branch header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{branch.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{branch.name}</p>
                <p style={{ color: 'rgba(180,200,255,0.5)', fontSize: 10 }}>{branch.desc}</p>
              </div>
              <div style={{
                color: isMaxed ? '#ffcc00' : branch.color,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {isMaxed ? 'MAX' : `${currentLv}/5`}
              </div>
            </div>

            {/* Level progress dots */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 99,
                  background: i < currentLv ? branch.color : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>

            {/* Current effect */}
            {currentLv > 0 && (
              <p style={{ color: branch.color, fontSize: 11, marginBottom: 8 }}>
                Active: {branch.levels[currentLv - 1].effect}
              </p>
            )}

            {/* Next level info + button */}
            {!isMaxed && nextLevel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'rgba(200,210,255,0.7)', fontSize: 11 }}>
                    Next: {nextLevel.effect}
                  </p>
                  {!check.allowed && check.reason && (
                    <p style={{ color: 'rgba(255,150,100,0.7)', fontSize: 10, marginTop: 2 }}>
                      🔒 {check.reason}
                    </p>
                  )}
                </div>
                <button
                  disabled={!check.allowed}
                  onClick={() => check.allowed && onUpgrade(selectedBlob.id, branch.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: check.allowed
                      ? `linear-gradient(90deg, ${branch.color}cc, ${branch.color})`
                      : 'rgba(255,255,255,0.08)',
                    color: check.allowed ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: check.allowed ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {nextLevel.cost} 💠
                </button>
              </div>
            )}

            {isMaxed && (
              <p style={{ color: '#ffcc00', fontSize: 11, textAlign: 'center' }}>
                ✨ Fully upgraded!
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
