import type { Camera } from './camera';

export type ParticleKind = 'puff' | 'spark' | 'flame' | 'smoke' | 'text' | 'confetti' | 'ember' | 'ring';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  /** Size in metres (min-clamped in pixels when drawn). */
  size: number;
  color: string;
  gravity: number;
  drag: number;
  text?: string;
  spin?: number;
}

const MAX = 600;

export class Particles {
  readonly list: Particle[] = [];

  spawn(p: Omit<Particle, 'maxLife'> & { maxLife?: number }): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ ...p, maxLife: p.maxLife ?? p.life });
  }

  burst(x: number, y: number, n: number, kind: ParticleKind, color: string, speed: number, size: number, life = 0.8): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn({
        kind,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + speed * 0.3,
        life: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity: kind === 'puff' ? 2 : kind === 'confetti' ? 6 : 9,
        drag: kind === 'puff' ? 3 : 1,
        spin: Math.random() * 10,
      });
    }
  }

  text(x: number, y: number, text: string, color: string): void {
    this.spawn({ kind: 'text', x, y, vx: 0, vy: 3, life: 1, size: 1, color, gravity: 0, drag: 0.5, text });
  }

  update(dt: number): void {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin !== undefined) p.spin += dt * 8;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, minScale: number): void {
    const ppm = Math.max(cam.ppm, minScale);
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      const x = cam.sx(p.x);
      const y = cam.sy(p.y);
      if (x < -50 || x > cam.w + 50 || y < -50 || y > cam.h + 50) continue;
      switch (p.kind) {
        case 'puff':
        case 'smoke': {
          // Smoke billows: it keeps growing as it fades.
          const r = p.size * ppm * (p.kind === 'smoke' ? 0.8 + (1 - t) * 2.6 : 1.6 - t * 0.8);
          ctx.globalAlpha = t * (p.kind === 'smoke' ? 0.32 : 0.8);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'flame': {
          // Additive exhaust: white-hot when fresh, cooling through orange to red.
          const r = Math.max(1.5, p.size * ppm * (0.5 + (1 - t) * 1.6));
          ctx.globalCompositeOperation = 'lighter';
          const hot = p.color === 'ion' ? ['170,225,255', '80,150,255', '40,80,220'] : ['255,245,200', '255,170,60', '230,70,30'];
          const c = t > 0.65 ? hot[0] : t > 0.35 ? hot[1] : hot[2];
          ctx.fillStyle = `rgba(${c},${0.25 + t * 0.55})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${hot[0]},${t * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ember': {
          const r = Math.max(1, p.size * ppm);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ring': {
          const r = Math.max(2, p.size * ppm * (1.6 - t));
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, 0.12 * ppm);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'spark':
        case 'confetti': {
          const r = Math.max(1.5, p.size * ppm);
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.spin ?? 0);
          ctx.fillRect(-r, -r * 0.5, r * 2, r);
          ctx.restore();
          break;
        }
        case 'text': {
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.font = '700 16px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.strokeText(p.text ?? '', x, y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', x, y);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
