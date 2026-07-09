/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface Cube {
  x: number;
  y: number;
  s: number;
  a: number;
  r: number;
  fy: number;
  fa: number;
  fs: number;
  op: number;
}

interface FloatingCubesCanvasProps {
  glowColor: string;
  className?: string;
}

export const FloatingCubesCanvas: React.FC<FloatingCubesCanvasProps> = ({
  glowColor,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize cubes only once
  const cubesRef = useRef<Cube[]>(
    Array.from({ length: 11 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.9,
      s: Math.random() * 13 + 6,
      a: Math.random() * Math.PI * 2,
      r: (Math.random() - 0.5) * 0.02,
      fy: Math.random() * Math.PI * 2,
      fa: Math.random() * 12 + 5,
      fs: Math.random() * 0.02 + 0.01,
      op: Math.random() * 0.35 + 0.22,
    }))
  );

  const drawFC = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number) => {
    ctx.clearRect(0, 0, W, H);

    cubesRef.current.forEach((c) => {
      c.a += c.r;
      const fy = Math.sin(t * c.fs + c.fy) * c.fa;

      ctx.save();
      ctx.translate(c.x * W, c.y * H + fy);
      ctx.rotate(c.a);
      ctx.globalAlpha = c.op;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = glowColor + '11';

      ctx.beginPath();
      ctx.rect(-c.s / 2, -c.s / 2, c.s, c.s);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    const resizeAndTick = () => {
      const W = canvas.parentElement?.offsetWidth || 230;
      const H = canvas.parentElement?.offsetHeight || 280;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      tick++;
      drawFC(ctx, tick, W, H);
      frameId = requestAnimationFrame(resizeAndTick);
    };

    resizeAndTick();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        pointerEvents: 'none',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
      }}
    />
  );
};
