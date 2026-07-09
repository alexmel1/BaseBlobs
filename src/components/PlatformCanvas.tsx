/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { PersonalityType } from '../types';
import { P } from '../data';

interface PlatformCanvasProps {
  personality: PersonalityType;
  className?: string;
}

export const PlatformCanvas: React.FC<PlatformCanvasProps> = ({
  personality,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPlat = (ctx: CanvasRenderingContext2D, t: number) => {
    const bp = P[personality] || P.happy;
    const W = 320;
    const H = 80;
    const cx = 160;
    const cy = 40;

    ctx.clearRect(0, 0, W, H);

    // Platform glow gradient
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 115);
    g.addColorStop(0, bp.glow + '22');
    g.addColorStop(1, bp.glow + '00');

    ctx.beginPath();
    ctx.ellipse(cx, cy, 115, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Pulse effect
    const pulse = Math.sin(t * 0.04) * 0.15 + 0.5;
    ctx.strokeStyle = bp.glow;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = bp.glow;
    ctx.shadowBlur = 12;

    // Stroke the elliptical pedestal edge
    ctx.beginPath();
    ctx.ellipse(cx, cy, 115, 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Concentric ripple rings
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 115 + i * 9, 18 + i * 4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = bp.glow;
      ctx.globalAlpha = 0.05 - i * 0.01;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
      drawPlat(ctx, tick);
      frameId = requestAnimationFrame(tickFn);
    };

    tickFn();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [personality]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className={className}
      style={{ display: 'block', width: '320px', height: '80px', margin: '0 auto' }}
    />
  );
};
