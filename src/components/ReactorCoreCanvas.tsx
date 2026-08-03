/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface ReactorCoreCanvasProps {
  /** 0..100 — уровень энергии внутри ядра */
  progress: number;
  /** Основной цвет фазы (hex, например '#00aaff') */
  color: string;
  /** Инкрементится при вкладе кубов — триггерит вспышку */
  flashKey?: number;
  /** Ядро вращается быстрее и ярче (фаза synthesizing) */
  spinning?: boolean;
  className?: string;
}

interface Mote {
  a: number;   // угол внутри ядра
  r: number;   // радиус от центра (0..1)
  s: number;   // размер
  sp: number;  // скорость подъёма
  op: number;
}

interface Burst {
  a: number;
  d: number;   // текущая дистанция
  v: number;   // скорость
  s: number;
  life: number;
}

interface Ring {
  d: number;
  life: number;
}

/** hex + альфа → rgba(), чтобы не плодить строковые конкатенации в цикле отрисовки */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export const ReactorCoreCanvas: React.FC<ReactorCoreCanvasProps> = ({
  progress,
  color,
  flashKey = 0,
  spinning = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Скрытое хранилище для flashKey: эффект отрисовки смотрит в ref,
  // чтобы новый burst не пересоздавал rAF-цикл
  const flashKeyRef = useRef(flashKey);
  flashKeyRef.current = flashKey;

  // Внутренние частицы (стабильные)
  const motesRef = useRef<Mote[]>(
    Array.from({ length: 26 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 0.72,
      s: Math.random() * 2.4 + 0.8,
      sp: Math.random() * 0.012 + 0.002,
      op: Math.random() * 0.5 + 0.3,
    }))
  );

  // Эфемерные эффекты — живут в ref и не триггерят ре-рендер
  const burstsRef = useRef<Burst[]>([]);
  const ringsRef = useRef<Ring[]>([]);
  const lastFlashRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let tick = 0;

    const draw = (t: number) => {
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) / 2 - 6;

      ctx.clearRect(0, 0, W, H);

      // Энергия ядра
      const pct = Math.min(100, Math.max(0, progress));
      const Rcore = Math.max(4, R * (0.42 + 0.5 * (pct / 100)));

      // Внешнее гало (свечение фазы)
      const glowPulse = 0.5 + 0.5 * Math.sin(t / 46);
      const glowA = spinning ? 0.5 : 0.34;
      const halo = ctx.createRadialGradient(cx, cy, Rcore * 0.6, cx, cy, R);
      halo.addColorStop(0, rgba(color, 0.32 * glowA));
      halo.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Внешнее вращающееся кольцо (защитное поле)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((spinning ? 1.7 : 0.5) * (t / 300));
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = 1.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      // Сегменты кольца
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.94, a0, a0 + 0.18);
        ctx.strokeStyle = rgba(color, 0.8);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Внутренние частицы (мглы) — внутри и снаружи ядра
      motesRef.current.forEach((m) => {
        m.a += m.sp;
        const mr = m.r * Rcore;
        const x = cx + Math.cos(m.a) * mr;
        const y = cy + Math.sin(m.a) * mr;
        ctx.beginPath();
        ctx.arc(x, y, m.s, 0, Math.PI * 2);
        ctx.fillStyle = rgba('#ffffff', m.op);
        ctx.fill();
      });

      // Тело ядра — тёплый градиент
      const grad = ctx.createRadialGradient(cx - Rcore * 0.3, cy - Rcore * 0.3, Rcore * 0.15, cx, cy, Rcore);
      grad.addColorStop(0, rgba('#ffffff', 0.95));
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, rgba(color, 0.15));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, Rcore, 0, Math.PI * 2);
      ctx.fill();
      // Обводка
      ctx.strokeStyle = rgba(color, 0.85);
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.stroke();

      // Кольца-вспышки
      for (let i = ringsRef.current.length - 1; i >= 0; i--) {
        const rng = ringsRef.current[i];
        rng.d += 2.2;
        rng.life -= 0.03;
        if (rng.life <= 0) {
          ringsRef.current.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, Rcore * (0.5 + rng.d * 0.18), 0, Math.PI * 2);
        ctx.strokeStyle = rgba('#ffffff', Math.max(0, rng.life) * 0.8);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Частицы вспышки
      for (let i = burstsRef.current.length - 1; i >= 0; i--) {
        const b = burstsRef.current[i];
        b.d += b.v;
        b.life -= 0.02;
        if (b.life <= 0) {
          burstsRef.current.splice(i, 1);
          continue;
        }
        const x = cx + Math.cos(b.a) * b.d;
        const y = cy + Math.sin(b.a) * b.d;
        ctx.beginPath();
        ctx.arc(x, y, b.s, 0, Math.PI * 2);
        ctx.fillStyle = rgba('#ffffff', Math.max(0, b.life) * 0.9);
        ctx.fill();
      }

      // Процент по центру ядра
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `700 ${Math.max(11, Math.round(Rcore * 0.42))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(pct)}%`, cx, cy + 1);
    };

    const resizeAndTick = () => {
      const parent = canvas.parentElement;
      const W = parent?.offsetWidth || 260;
      const H = parent?.offsetHeight || 260;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      // Вспышка при вкладе (по изменению flashKey)
      if (flashKeyRef.current !== lastFlashRef.current) {
        const count = 22;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
          burstsRef.current.push({
            a,
            d: Math.min(canvas.width, canvas.height) / 2 * 0.32,
            v: Math.random() * 3 + 2,
            s: Math.random() * 2.6 + 1.2,
            life: 1,
          });
        }
        ringsRef.current.push({ d: 0, life: 1 });
        lastFlashRef.current = flashKeyRef.current;
      }

      tick++;
      draw(tick);
      frameId = requestAnimationFrame(resizeAndTick);
    };

    resizeAndTick();
    return () => cancelAnimationFrame(frameId);
  }, [progress, color, spinning]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
};
