/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  sp: number;
  ph: number;
}

interface BackgroundCanvasProps {
  currentScreen: string;
}

export const BackgroundCanvas: React.FC<BackgroundCanvasProps> = ({ currentScreen }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-generate stars so they are stable
  const starsRef = useRef<Star[]>(
    Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      sp: Math.random() * 0.006 + 0.003,
      ph: Math.random() * Math.PI * 2,
    }))
  );

  const drawBackground = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number) => {
    if (currentScreen === 'home') {
      // Deep tech space gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#04091a');
      g.addColorStop(1, '#02040b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
 
      // Summoning station central radial glowing aura
      const ng = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.7);
      ng.addColorStop(0, 'rgba(0, 110, 255, 0.15)');
      ng.addColorStop(0.5, 'rgba(0, 40, 150, 0.05)');
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
 
      // Stars twinkling
      starsRef.current.forEach((s) => {
        const a = Math.sin(t * s.sp + s.ph) * 0.4 + 0.55;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${a * 0.8})`;
        ctx.fill();
      });

      // Holographic Concentric Summoning Circles (radar rings pulsing out)
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const rFactor = ((t * 0.8 + i * 120) % 360) / 360;
        const radius = rFactor * W * 0.45;
        ctx.strokeStyle = `rgba(0, 150, 255, ${0.12 * (1 - rFactor)})`;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.38, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Little dynamic ticks on the circle
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.18 * (1 - rFactor)})`;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.38, radius, t * 0.01 + i, t * 0.01 + i + 0.4);
        ctx.stroke();
      }

      // Orbital Stardust/Energy fragments rotating around the pedestal
      for (let i = 0; i < 6; i++) {
        const angle = t * 0.006 + (i * Math.PI) / 3;
        const orbitRadiusX = W * 0.32;
        const orbitRadiusY = W * 0.12;
        const pX = W / 2 + Math.cos(angle) * orbitRadiusX;
        const pY = H * 0.38 + Math.sin(angle) * orbitRadiusY;
        
        ctx.fillStyle = 'rgba(0, 220, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(pX, pY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing secondary halo
        ctx.strokeStyle = 'rgba(0, 180, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(pX, pY, 5 + Math.sin(t * 0.05 + i) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // High-tech perspectives grid lines under the platform
      ctx.strokeStyle = 'rgba(0, 100, 255, 0.04)';
      ctx.lineWidth = 0.5;
      const gridStartY = H * 0.45;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2, gridStartY);
        ctx.lineTo(W / 2 + i * (W * 0.18), H);
        ctx.stroke();
      }
      for (let y = gridStartY; y < H; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

    } else if (currentScreen === 'expeditions') {
      // Deep purple/indigo space gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#02050e');
      g.addColorStop(1, '#080824');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Tech nebula glow center
      const ng = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, W * 0.8);
      ng.addColorStop(0, 'rgba(88, 30, 200, 0.12)');
      ng.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);

      // Stars twinkling
      starsRef.current.forEach((s) => {
        const a = Math.sin(t * s.sp + s.ph) * 0.3 + 0.5;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${a * 0.7})`;
        ctx.fill();
      });

      // Futuristic digital network pathways (curves) representing Base network
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.07)';
      ctx.lineWidth = 1.2;
      
      // Let's draw 3 dynamic paths running vertically/curved
      for (let i = 0; i < 3; i++) {
        const shiftX = Math.sin(t * 0.005 + i * 2) * 20;
        ctx.beginPath();
        ctx.moveTo(W * 0.2 + i * 30 + shiftX, 0);
        ctx.bezierCurveTo(
          W * 0.8 - i * 40, H * 0.3,
          W * 0.1 + i * 50, H * 0.7,
          W * 0.5 + shiftX, H
        );
        ctx.stroke();
      }

      // Drawing cute floating data packets/nodes slowly traveling along the map paths
      ctx.fillStyle = 'rgba(0, 170, 255, 0.13)';
      for (let i = 0; i < 4; i++) {
        const speed = 0.002 + i * 0.001;
        const progress = ((t * speed) + (i * 0.25)) % 1;
        const nodeY = progress * H;
        const nodeX = W * 0.5 + Math.sin(progress * Math.PI * 2 + i) * (W * 0.3);
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Outer pulsing ring
        ctx.strokeStyle = 'rgba(0, 170, 255, 0.06)';
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 8 + Math.sin(t * 0.05) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (currentScreen === 'cards') {
      // Dark cyber laboratory/workshop
      ctx.fillStyle = '#060710';
      ctx.fillRect(0, 0, W, H);
 
      // Beautiful neon-cyan blueprint blueprint grid
      ctx.strokeStyle = 'rgba(0, 207, 255, 0.015)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
 
      // Diagnostics ambient light
      const lamp = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.9);
      lamp.addColorStop(0, 'rgba(0, 150, 255, 0.08)');
      lamp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, W, H);

      // Cute circuit-board track lines that run on the background
      ctx.strokeStyle = 'rgba(0, 190, 255, 0.03)';
      ctx.lineWidth = 1;
      const points = [
        { x: 30, y: 0, x2: 30, y2: 150, x3: 120, y3: 240 },
        { x: W - 30, y: H, x2: W - 30, y2: H - 180, x3: W - 100, y3: H - 250 },
        { x: W * 0.3, y: 0, x2: W * 0.3, y2: 80, x3: W * 0.1, y3: 130 }
      ];
      points.forEach((pt) => {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x2, pt.y2);
        ctx.lineTo(pt.x3, pt.y3);
        ctx.stroke();

        // Dot at end of circuit
        ctx.fillStyle = 'rgba(0, 210, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(pt.x3, pt.y3, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Dynamic diagnostic laser scanner bar sweeping vertically
      const scanY = (Math.sin(t * 0.008) * 0.5 + 0.5) * H;
      const laserGradient = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12);
      laserGradient.addColorStop(0, 'rgba(0, 170, 255, 0)');
      laserGradient.addColorStop(0.5, 'rgba(0, 170, 255, 0.05)');
      laserGradient.addColorStop(1, 'rgba(0, 170, 255, 0)');
      ctx.fillStyle = laserGradient;
      ctx.fillRect(0, scanY - 12, W, 24);

      // Draw horizontal sharp laser line
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(W, scanY);
      ctx.stroke();

      // Floating holographic upgrade nodes moving upwards
      ctx.fillStyle = 'rgba(0, 180, 255, 0.12)';
      for (let i = 0; i < 6; i++) {
        const floatY = ((H + 50) - (t * (0.4 + i * 0.1) + i * 80) % (H + 100));
        const floatX = (i * 70 + Math.sin(t * 0.02 + i) * 15) % (W - 20) + 10;
        ctx.beginPath();
        // Draw cross/schematic dot
        ctx.arc(floatX, floatY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (currentScreen === 'shop') {
      // Luxury black & copper/gold gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0d0a04');
      g.addColorStop(1, '#030201');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
 
      // Radiant golden spotlights beams from top
      const beamX = W / 2 + Math.sin(t * 0.004) * 50;
      const goldBeam = ctx.createRadialGradient(beamX, -30, 10, W / 2, 200, W * 0.7);
      goldBeam.addColorStop(0, 'rgba(255, 170, 0, 0.14)');
      goldBeam.addColorStop(0.5, 'rgba(255, 140, 0, 0.04)');
      goldBeam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = goldBeam;
      ctx.fillRect(0, 0, W, H);

      // Draw subtle falling golden stardust (coins/gems outlines)
      starsRef.current.forEach((s, idx) => {
        const speed = 0.5 + (idx % 3) * 0.2;
        const progressY = (s.y * H + t * speed) % H;
        const wiggleX = s.x * W + Math.sin(t * 0.01 + idx) * 12;
        
        // Soft golden glow
        ctx.fillStyle = `rgba(255, 180, 0, ${0.1 + Math.sin(t * 0.05 + idx) * 0.05})`;
        ctx.beginPath();
        ctx.arc(wiggleX, progressY, s.r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Occasional golden ring (gem/coin symbol)
        if (idx % 12 === 0) {
          ctx.strokeStyle = 'rgba(255, 180, 0, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wiggleX, progressY, 4 + Math.sin(t * 0.03) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Golden sparkle effects (bursting stars)
      for (let i = 0; i < 3; i++) {
        const progress = ((t * 0.003 + i * 0.33) % 1);
        const radius = progress * 60;
        const sX = W * 0.2 + i * 110;
        const sY = H * 0.3 + Math.sin(i) * 150;
        ctx.strokeStyle = `rgba(255, 200, 50, ${0.1 * (1 - progress)})`;
        ctx.lineWidth = 0.5;
        
        ctx.beginPath();
        ctx.moveTo(sX - radius, sY);
        ctx.lineTo(sX + radius, sY);
        ctx.moveTo(sX, sY - radius);
        ctx.lineTo(sX, sY + radius);
        ctx.stroke();
      }

    } else if (currentScreen === 'quests') {
      // Deep tactical cyber green/teal backdrop
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#02090b');
      g.addColorStop(1, '#000305');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Radar screen circular scanning sweep from the top corner
      const radarCenterX = 30;
      const radarCenterY = 50;
      const radarRadius = W * 0.9;
      
      // Draw radar grid rings
      ctx.strokeStyle = 'rgba(0, 180, 140, 0.025)';
      ctx.lineWidth = 1;
      for (let r = 80; r < radarRadius; r += 80) {
        ctx.beginPath();
        ctx.arc(radarCenterX, radarCenterY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar scanning sweep sector line
      const sweepAngle = (t * 0.004) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 150, 0.05)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.lineTo(radarCenterX + Math.cos(sweepAngle) * radarRadius, radarCenterY + Math.sin(sweepAngle) * radarRadius);
      ctx.stroke();

      // Radar sweep glow trail
      const sweepGlow = ctx.createRadialGradient(radarCenterX, radarCenterY, 0, radarCenterX, radarCenterY, radarRadius);
      sweepGlow.addColorStop(0, 'rgba(0, 200, 150, 0.03)');
      sweepGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sweepGlow;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY);
      ctx.arc(radarCenterX, radarCenterY, radarRadius, sweepAngle - 0.35, sweepAngle);
      ctx.lineTo(radarCenterX, radarCenterY);
      ctx.fill();

      // Matrix binary code trickle down on margins
      ctx.fillStyle = 'rgba(0, 210, 130, 0.12)';
      ctx.font = '7px monospace';
      for (let col = 0; col < 6; col++) {
        // We place columns near the outer left and right edges
        const posX = col < 3 ? 10 + col * 12 : W - 45 + col * 12;
        const progress = ((t * (0.8 + col * 0.2) + col * 120) % (H + 50));
        
        ctx.fillText(Math.random() > 0.5 ? '1' : '0', posX, progress);
        ctx.fillText(Math.random() > 0.5 ? '0' : '1', posX, progress - 15);
        ctx.fillText(Math.random() > 0.5 ? '1' : '1', posX, progress - 30);
      }

      // Mission target brackets (HUD) corners
      ctx.strokeStyle = 'rgba(0, 180, 140, 0.12)';
      ctx.lineWidth = 1;
      const inset = 18;
      // Top Left Corner
      ctx.beginPath();
      ctx.moveTo(inset + 10, inset); ctx.lineTo(inset, inset); ctx.lineTo(inset, inset + 10);
      ctx.stroke();
      // Top Right Corner
      ctx.beginPath();
      ctx.moveTo(W - inset - 10, inset); ctx.lineTo(W - inset, inset); ctx.lineTo(W - inset, inset + 10);
      ctx.stroke();
      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(inset + 10, H - inset); ctx.lineTo(inset, H - inset); ctx.lineTo(inset, H - inset - 10);
      ctx.stroke();
      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(W - inset - 10, H - inset); ctx.lineTo(W - inset, H - inset); ctx.lineTo(W - inset, H - inset - 10);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    const resizeAndTick = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const W = parent.clientWidth;
      const H = parent.clientHeight;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      tick++;
      drawBackground(ctx, tick, W, H);
      frameId = requestAnimationFrame(resizeAndTick);
    };

    resizeAndTick();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [currentScreen]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
};
