/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { PersonalityType, EvolutionStage } from '../types';
import { P } from '../data';

interface BlobCanvasProps {
  personality: PersonalityType;
  size: number;
  animate?: boolean;
  className?: string;
  evolutionStage?: EvolutionStage;
}

// Helper to draw a star
const drawStar = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) => {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  let step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
};

// Helper to draw a 3D isometric cube
const draw3DCube = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  cTop: string,
  cLeft: string,
  cRight: string,
  alpha: number = 1
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  
  // Top face
  ctx.fillStyle = cTop;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.86, cy - size * 0.5);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - size * 0.86, cy - size * 0.5);
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = cLeft;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - size * 0.86, cy - size * 0.5);
  ctx.lineTo(cx - size * 0.86, cy + size * 0.5);
  ctx.lineTo(cx, cy + size);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = cRight;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + size * 0.86, cy - size * 0.5);
  ctx.lineTo(cx + size * 0.86, cy + size * 0.5);
  ctx.lineTo(cx, cy + size);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

export const BlobCanvas: React.FC<BlobCanvasProps> = ({
  personality,
  size,
  animate = true,
  className = '',
  evolutionStage = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper rounded rectangle
  const rr = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawBlob = (ctx: CanvasRenderingContext2D, t: number, S: number) => {
    const bp = P[personality] || P.happy;
    const cx = S / 2;
    const cy = S / 2;
    
    const r = S * 0.32;
    const br = r * 0.42;

    const fy = animate ? Math.sin(t * 0.05) * (S * 0.024) : 0;
    const sq = !animate
      ? 1
      : personality === 'sleepy'
      ? 1 + Math.sin(t * 0.02) * 0.012
      : 1 + Math.sin(t * 0.05) * 0.025;

    ctx.clearRect(0, 0, S, S);

    // 1. BACKDROP GLOW AURA
    const g = ctx.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.48);
    g.addColorStop(0, bp.glow + '55');
    g.addColorStop(0.5, bp.glow + '22');
    g.addColorStop(1, bp.glow + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // 2. FLOATING BACKGROUND 3D CUBES (Inspired by the user image!)
    const getCubeTheme = () => {
      switch (personality) {
        case 'sleepy':
          return { top: '#f3e8ff', left: '#c084fc', right: '#9333ea' };
        case 'lucky':
          return { top: '#f0fdf4', left: '#4ade80', right: '#16a34a' };
        case 'chaotic':
          return { top: '#fdf2f8', left: '#f472b6', right: '#db2777' };
        case 'cosmic':
          return { top: '#e0e7ff', left: '#818cf8', right: '#4f46e5' };
        case 'happy':
        default:
          return { top: '#e0f2fe', left: '#38bdf8', right: '#0284c7' };
      }
    };
    const ct = getCubeTheme();

    const drawFloatCube = (x: number, y: number, size: number, phase: number, speed: number) => {
      const floatY = y + Math.sin(t * speed + phase) * (S * 0.05);
      const floatX = x + Math.cos(t * speed * 0.7 + phase) * (S * 0.015);
      
      // Outer glow of the floating cube
      ctx.save();
      ctx.shadowColor = bp.glow;
      ctx.shadowBlur = S * 0.03;
      draw3DCube(ctx, floatX, floatY, size, ct.top, ct.left, ct.right, 0.85);
      ctx.restore();
    };

    // Render 6 cute background cubes floating with different settings
    drawFloatCube(cx - r * 1.25, cy - r * 1.15, S * 0.025, 0, 0.04);
    drawFloatCube(cx + r * 1.35, cy - r * 0.95, S * 0.03, 1.5, 0.035);
    drawFloatCube(cx - r * 1.45, cy + r * 0.75, S * 0.02, 3.1, 0.045);
    drawFloatCube(cx + r * 1.4, cy + r * 0.65, S * 0.026, 4.2, 0.03);
    drawFloatCube(cx - r * 0.6, cy - r * 1.4, S * 0.018, 2.0, 0.05);
    drawFloatCube(cx + r * 0.8, cy - r * 1.45, S * 0.022, 5.5, 0.038);

    // 3. FUTURISTIC NEON GLOWING PLATFORM (Underneath the character!)
    const pY = cy + r * 0.95;
    const pW = r * 1.1;
    const pH = r * 0.24;

    ctx.save();
    // Outer shadow trail for platform
    ctx.shadowColor = bp.glow;
    ctx.shadowBlur = S * 0.04;

    // Outer neon ring
    ctx.strokeStyle = bp.glow + '44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, pY, pW * 1.25, pH * 1.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Medium neon ring
    ctx.strokeStyle = bp.glow + 'aa';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, pY, pW, pH, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright white/neon glowing ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, pY, pW * 0.65, pH * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. TRANSFORMS FOR BOUNCY CHARACTER
    ctx.save();
    ctx.translate(cx, cy + fy);
    ctx.scale(sq, 2 - sq);

    // Under-body shadow cast onto platform
    const sg = ctx.createRadialGradient(0, r * 0.85, 0, 0, r * 0.85, r);
    sg.addColorStop(0, bp.glow + '55');
    sg.addColorStop(1, bp.glow + '00');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.9, r * 0.75, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. CUTE SPHERICAL FEET AT THE BOTTOM
    const drawFoot = (fx: number, fyPos: number) => {
      const footR = r * 0.16;
      ctx.save();
      // Outer neon border
      ctx.shadowColor = bp.glow;
      ctx.shadowBlur = S * 0.05;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.05;
      
      const fg = ctx.createRadialGradient(fx - footR * 0.2, fyPos - footR * 0.2, footR * 0.1, fx, fyPos, footR);
      fg.addColorStop(0, bp.c1);
      fg.addColorStop(0.5, bp.c2);
      fg.addColorStop(1, bp.c3);
      ctx.fillStyle = fg;
      
      ctx.beginPath();
      ctx.arc(fx, fyPos, footR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawFoot(-r * 0.42, r * 0.95);
    drawFoot(r * 0.42, r * 0.95);

    // 6. CUTE FLOATING SPHERICAL HANDS (L & R)
    const hYOffset = Math.sin(t * 0.1) * (r * 0.06);
    const drawHand = (hx: number, hyPos: number, isLeft: boolean) => {
      const handR = r * 0.18;
      ctx.save();
      ctx.shadowColor = bp.glow;
      ctx.shadowBlur = S * 0.05;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.05;

      const hg = ctx.createRadialGradient(
        hx - (isLeft ? -1 : 1) * handR * 0.2,
        hyPos - handR * 0.2,
        handR * 0.1,
        hx,
        hyPos,
        handR
      );
      hg.addColorStop(0, bp.c1);
      hg.addColorStop(0.5, bp.c2);
      hg.addColorStop(1, bp.c3);
      ctx.fillStyle = hg;

      ctx.beginPath();
      ctx.arc(hx, hyPos, handR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawHand(-r * 1.1, r * 0.15 + hYOffset, true);
    drawHand(r * 1.1, r * 0.15 - hYOffset, false);

    // 7. GLOSSY 3D CHARACTER BODY (CUBE WITH ROUNDED CORNERS)
    const bg = ctx.createLinearGradient(-r, -r, r, r);
    bg.addColorStop(0, bp.c1);
    bg.addColorStop(0.4, bp.c2);
    bg.addColorStop(1, bp.c3);

    ctx.save();
    ctx.shadowColor = bp.glow;
    ctx.shadowBlur = S * 0.12;
    rr(ctx, -r, -r, r * 2, r * 2, br);
    ctx.fillStyle = bg;
    ctx.fill();

    // High brightness neon border around body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
    ctx.restore();

    // 8. LUXURIOUS GLASS REFLECTION HIGHLIGHTS (Jelly / Glossy effect)
    // Top specular sheen
    const hl = ctx.createLinearGradient(-r * 0.7, -r * 0.8, 0, -r * 0.15);
    hl.addColorStop(0, 'rgba(255,255,255,0.48)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    rr(ctx, -r * 0.7, -r * 0.82, r * 1.4, r * 0.65, br * 0.5);
    ctx.fillStyle = hl;
    ctx.fill();

    // Bright glass bubble dot on top left
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.5, -r * 0.5, r * 0.15, r * 0.08, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Bottom light bounce reflection from neon platform
    const bhl = ctx.createLinearGradient(0, r * 0.35, 0, r * 0.88);
    bhl.addColorStop(0, 'rgba(255,255,255,0)');
    bhl.addColorStop(1, bp.glow + '55');
    rr(ctx, -r * 0.8, r * 0.35, r * 1.6, r * 0.48, br * 0.5);
    ctx.fillStyle = bhl;
    ctx.fill();

    // ── UNIQUE DECORATIVE ACCESSORIES ON HEAD/BODY ──
    if (personality === 'happy') {
      // Ears are removed as requested by the user
    } else if (personality === 'sleepy') {
      // Sleepy nightcap hat!
      ctx.save();
      ctx.translate(-r * 0.4, -r * 0.95);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#ddccff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.6, -r * 0.8, -r * 0.7);
      ctx.quadraticCurveTo(0, -r * 0.4, r * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      
      // Pattern lines on cap
      ctx.fillStyle = '#9933ff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.1);
      ctx.lineTo(r * 0.1, -r * 0.2);
      ctx.lineTo(r * 0.25, 0);
      ctx.lineTo(-r * 0.25, 0);
      ctx.closePath();
      ctx.fill();

      // Fluffy pompom ball on the tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.8, -r * 0.7, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (personality === 'lucky') {
      // Cute four-leaf clover (🍀) behind left side of head
      ctx.save();
      ctx.translate(-r * 0.5, -r * 0.82);
      ctx.rotate(0.2);
      ctx.fillStyle = '#00cc44';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.12, r * 0.1, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Stem
      ctx.strokeStyle = '#00aa33';
      ctx.lineWidth = r * 0.04;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(r * 0.05, r * 0.05, r * 0.15, Math.PI, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    } else if (personality === 'chaotic') {
      // Glow lightning bolt crest on forehead
      ctx.save();
      ctx.translate(0, -r * 0.55);
      ctx.fillStyle = '#ffff33';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = S * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.35);
      ctx.lineTo(r * 0.15, -r * 0.1);
      ctx.lineTo(0, -r * 0.08);
      ctx.lineTo(r * 0.2, r * 0.2);
      ctx.lineTo(-r * 0.05, 0);
      ctx.lineTo(0.05, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (personality === 'cosmic') {
      // Elegant starry celestial rings surrounding body
      ctx.strokeStyle = 'rgba(160, 100, 255, 0.7)';
      ctx.lineWidth = r * 0.12;
      ctx.shadowColor = '#aa66ff';
      ctx.shadowBlur = S * 0.06;
      ctx.save();
      ctx.rotate(-0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.4, r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Blush pink cheeks (on top of eyes)
    ctx.fillStyle = bp.blush;
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, r * 0.18, r * 0.19, r * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.55, r * 0.18, r * 0.19, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── EYES BY PERSONALITY ──
    const ey = -r * 0.12;
    const ew = r * 0.22;
    const eh = r * 0.28;

    if (personality === 'happy') {
      // Big vertical shiny cute cartoon eyes (exactly like the user's reference image!)
      const drawCuteAnimeEye = (ex: number, eyPos: number) => {
        ctx.save();
        // Base dark oval pupil
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(ex, eyPos, ew * 0.85, eh * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main shiny white sparkle (top left)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - ew * 0.26, eyPos - eh * 0.35, ew * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Small secondary sparkle (bottom right)
        ctx.beginPath();
        ctx.arc(ex + ew * 0.26, eyPos + eh * 0.35, ew * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawCuteAnimeEye(-r * 0.35, ey);
      drawCuteAnimeEye(r * 0.35, ey);
    } else if (personality === 'sleepy') {
      // Relaxed curved sleepy arcs (u shape)
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.085;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(-r * 0.3, ey + eh * 0.1, ew, 0.15, Math.PI - 0.15);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(r * 0.3, ey + eh * 0.1, ew, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (personality === 'lucky') {
      // Left eye winking (happy arc upward), right eye starry gold open
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.085;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(-r * 0.3, ey + eh * 0.2, ew, Math.PI + 0.25, Math.PI * 2 - 0.25);
      ctx.stroke();

      // Right eye white
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(r * 0.3, ey, ew * 1.15, eh * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Star glint pupil
      ctx.fillStyle = '#ffb300';
      drawStar(ctx, r * 0.3, ey, 5, ew * 0.85, ew * 0.38);
    } else if (personality === 'chaotic') {
      // Energetic cross/lightning bolt angled eyes (> <)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.11;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Left eye (>)
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, ey - eh * 0.5);
      ctx.lineTo(-r * 0.2, ey);
      ctx.lineTo(-r * 0.45, ey + eh * 0.5);
      ctx.stroke();

      // Right eye (<)
      ctx.beginPath();
      ctx.moveTo(r * 0.45, ey - eh * 0.5);
      ctx.lineTo(r * 0.2, ey);
      ctx.lineTo(r * 0.45, ey + eh * 0.5);
      ctx.stroke();
    } else if (personality === 'cosmic') {
      // Glowing starry diamond eyes with orbital rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.arc(-r * 0.3, ey, ew * 1.2, 0, Math.PI * 2);
      ctx.arc(r * 0.3, ey, ew * 1.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = S * 0.08;
      drawStar(ctx, -r * 0.3, ey, 4, ew * 0.95, ew * 0.28);
      drawStar(ctx, r * 0.3, ey, 4, ew * 0.95, ew * 0.28);
      ctx.shadowBlur = 0;
    }

    // ── MOUTHS BY PERSONALITY ──
    if (personality === 'happy') {
      // Beautiful Open mouth with dynamic tongue and thick outline (just like reference!)
      ctx.save();
      ctx.translate(0, ey + r * 0.44);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.24, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = '#450a0a';
      ctx.fill();
      
      // Cute pink tongue
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.16, 0, Math.PI);
      ctx.fillStyle = '#ff6b8b';
      ctx.fill();
      
      // Black cartoon stroke
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.24, 0, Math.PI);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else if (personality === 'sleepy') {
      // Yawning small "o" mouth
      ctx.fillStyle = '#220a3a';
      ctx.beginPath();
      ctx.arc(0, ey + r * 0.45, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
    } else if (personality === 'lucky') {
      // Mischievous :3 mouth
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.085;
      ctx.lineCap = 'round';
      
      // Left curve
      ctx.beginPath();
      ctx.arc(-r * 0.09, ey + r * 0.36, r * 0.1, 0, Math.PI);
      ctx.stroke();
      // Right curve
      ctx.beginPath();
      ctx.arc(r * 0.09, ey + r * 0.36, r * 0.1, 0, Math.PI);
      ctx.stroke();
    } else if (personality === 'chaotic') {
      // Jagged zig-zag grin
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.085;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, ey + r * 0.38);
      ctx.lineTo(-r * 0.12, ey + r * 0.48);
      ctx.lineTo(0, ey + r * 0.38);
      ctx.lineTo(r * 0.12, ey + r * 0.48);
      ctx.lineTo(r * 0.25, ey + r * 0.38);
      ctx.stroke();
    } else if (personality === 'cosmic') {
      // Gentle calm curved line
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = r * 0.065;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.arc(0, ey + r * 0.38, r * 0.26, 0.4, Math.PI - 0.4);
      ctx.stroke();
    }

    // ── FLOATING PARTICLES AND SPECIAL EFFECTS ──
    if (personality === 'sleepy') {
      // Floating Zzz letters rising up
      ctx.save();
      ctx.fillStyle = '#cc99ff';
      ctx.font = `bold ${S * 0.07}px monospace`;
      const z1y = -r * 1.1 + Math.sin(t * 0.03) * 4;
      const z1x = r * 0.6 + Math.cos(t * 0.03) * 3;
      ctx.fillText('Z', z1x, z1y);
      
      ctx.font = `bold ${S * 0.05}px monospace`;
      const z2y = -r * 1.45 + Math.sin((t + 35) * 0.03) * 4;
      const z2x = r * 0.95 + Math.cos((t + 35) * 0.03) * 3;
      ctx.fillText('z', z2x, z2y);
      ctx.restore();
    } else if (personality === 'lucky') {
      // Sparking yellow/gold 4-point sparkle stars floating
      ctx.save();
      ctx.fillStyle = '#ffcc00';
      const s1x = -r * 1.3 + Math.sin(t * 0.04) * 4;
      const s1y = -r * 0.3 + Math.cos(t * 0.04) * 4;
      drawStar(ctx, s1x, s1y, 4, r * 0.15, r * 0.06);
      
      const s2x = r * 1.25 + Math.sin((t + 50) * 0.04) * 5;
      const s2y = -r * 0.7 + Math.cos((t + 50) * 0.04) * 5;
      drawStar(ctx, s2x, s2y, 4, r * 0.12, r * 0.05);
      ctx.restore();
    } else if (personality === 'chaotic') {
      // High-frequency lightning bolts crackling around body
      ctx.save();
      ctx.strokeStyle = '#ff44aa';
      ctx.lineWidth = r * 0.055;
      if (Math.sin(t * 0.28) > 0.65) {
         ctx.beginPath();
         ctx.moveTo(-r * 1.25, -r * 0.15);
         ctx.lineTo(-r * 1.45, -r * 0.35);
         ctx.lineTo(-r * 1.35, -r * 0.45);
         ctx.stroke();
      }
      if (Math.cos(t * 0.22) > 0.65) {
         ctx.beginPath();
         ctx.moveTo(r * 1.25, r * 0.1);
         ctx.lineTo(r * 1.45, -r * 0.1);
         ctx.lineTo(r * 1.4, -r * 0.25);
         ctx.stroke();
      }
      ctx.restore();
    } else if (personality === 'cosmic') {
      // Sparkling starry space dust orbiting
      ctx.save();
      ctx.fillStyle = '#00ffff';
      const p1x = -r * 1.35 + Math.sin(t * 0.02) * 6;
      const p1y = r * 0.35 + Math.cos(t * 0.02) * 6;
      ctx.beginPath();
      ctx.arc(p1x, p1y, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      
      const p2x = r * 1.35 + Math.cos(t * 0.02) * 6;
      const p2y = -r * 0.45 + Math.sin(t * 0.02) * 6;
      ctx.beginPath();
      ctx.arc(p2x, p2y, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (personality === 'happy') {
      // Floating glowing bouncy pink hearts!
      ctx.save();
      ctx.fillStyle = 'rgba(255, 100, 180, 0.75)';
      const hx = r * 1.2 + Math.sin(t * 0.035) * 4;
      const hy = -r * 0.5 + Math.cos(t * 0.035) * 4;
      ctx.translate(hx, hy);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * 0.08, -r * 0.12, -r * 0.2, -r * 0.04, 0, r * 0.12);
      ctx.bezierCurveTo(r * 0.2, -r * 0.04, r * 0.08, -r * 0.12, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // --- EVOLUTION EFFECTS ---
    const glow = bp.glow;

    // Stage 1 (Glow) — pulsating ring around body
    if (evolutionStage >= 1) {
      const ringPulse = Math.sin(t * 0.06) * 0.3 + 0.7;
      ctx.strokeStyle = glow + Math.round(ringPulse * 120).toString(16).padStart(2, '0');
      ctx.lineWidth = S * 0.018;
      ctx.shadowColor = glow;
      ctx.shadowBlur = S * 0.08;
      rr(ctx, -r * 1.12, -r * 1.12, r * 2.24, r * 2.24, br * 1.2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Stage 2 (Crystal) — orbital crystal particles
    if (evolutionStage >= 2) {
      for (let i = 0; i < 4; i++) {
        const angle = t * 0.04 + i * (Math.PI / 2);
        const ox = Math.cos(angle) * r * 1.3;
        const oy = Math.sin(angle) * r * 0.7;
        const ps = Math.sin(t * 0.08 + i) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(ox, oy, S * 0.032 * ps, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.shadowColor = glow;
        ctx.shadowBlur = S * 0.06;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Stage 3 (Ascended) — golden halo/glow + crown above head
    if (evolutionStage >= 3) {
      // Golden halo
      const goldGlow = ctx.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.2, r * 1.5);
      goldGlow.addColorStop(0, 'rgba(255,200,0,0.15)');
      goldGlow.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = goldGlow;
      ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);

      // Crown — 3 floating dots above the head
      [-r * 0.4, 0, r * 0.4].forEach((cx, i) => {
        const cy = -r * 1.2 - (i === 1 ? r * 0.18 : 0);
        const ps = Math.sin(t * 0.05 + i * 0.8) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(cx, cy, S * 0.038 * ps, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = S * 0.07;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    const tickFn = () => {
      tick++;
      drawBlob(ctx, tick, size);
      if (animate) {
        frameId = requestAnimationFrame(tickFn);
      }
    };

    tickFn();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [personality, size, animate, evolutionStage]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', width: `${size}px`, height: `${size}px` }}
    />
  );
};
