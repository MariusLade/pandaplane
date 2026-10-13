import type { Pickup } from '../game/world';
import type { Camera } from './camera';

const BALLOON_COLORS = ['#ff5d6c', '#ffc53d', '#5dc4ff', '#9b7bff', '#5fd47a'];

export function drawPickups(ctx: CanvasRenderingContext2D, cam: Camera, list: Pickup[], time: number, minScale: number): void {
  const s = Math.max(cam.ppm, minScale);
  for (const p of list) {
    if (p.taken) continue;
    const bob = Math.sin(time * 2 + p.phase) * 0.25;
    const x = cam.sx(p.x);
    const y = cam.sy(p.y + bob);
    const r = p.radius * s;
    if (x < -r * 3 || x > cam.w + r * 3 || y < -r * 4 || y > cam.h + r * 3) continue;
    switch (p.kind) {
      case 'coin':
      case 'bigcoin': {
        const squash = Math.abs(Math.cos(time * 3 + p.phase));
        const rx = Math.max(1, r * (0.25 + squash * 0.75));
        ctx.fillStyle = '#c98a12';
        ctx.beginPath();
        ctx.ellipse(x, y, rx, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.kind === 'bigcoin' ? '#ffe066' : '#ffd23d';
        ctx.beginPath();
        ctx.ellipse(x, y, rx * 0.78, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        if (squash > 0.5) {
          ctx.fillStyle = '#c98a12';
          if (p.kind === 'bigcoin') drawStar(ctx, x, y, r * 0.45 * squash, r * 0.45);
          else ctx.fillRect(x - rx * 0.12, y - r * 0.45, rx * 0.24, r * 0.9);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(x - rx * 0.35, y - r * 0.35, rx * 0.15, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ring': {
        const pulse = 0.5 + 0.5 * Math.sin(time * 6 + p.phase);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.variant);
        ctx.lineWidth = Math.max(2, r * 0.16);
        ctx.strokeStyle = `rgba(80,230,255,${0.35 + pulse * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.38, r, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, r * 0.07);
        ctx.strokeStyle = '#e9fdff';
        ctx.stroke();
        ctx.fillStyle = `rgba(160,245,255,${0.6 + pulse * 0.4})`;
        for (let i = -1; i <= 1; i++) {
          const ax = r * (0.25 + i * 0.22) + pulse * r * 0.1;
          ctx.beginPath();
          ctx.moveTo(ax, 0);
          ctx.lineTo(ax - r * 0.18, -r * 0.14);
          ctx.lineTo(ax - r * 0.18, r * 0.14);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'balloon': {
        const color = BALLOON_COLORS[p.variant % BALLOON_COLORS.length];
        ctx.strokeStyle = 'rgba(60,60,60,0.6)';
        ctx.lineWidth = Math.max(1, r * 0.05);
        ctx.beginPath();
        ctx.moveTo(x, y + r * 1.1);
        ctx.quadraticCurveTo(x + r * 0.3, y + r * 1.7, x - r * 0.1, y + r * 2.4);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.85, r * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.15, y + r * 1.2);
        ctx.lineTo(x + r * 0.15, y + r * 1.2);
        ctx.lineTo(x, y + r * 1.0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.18, r * 0.3, 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? 0.45 : 1;
    ctx.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
  }
  ctx.closePath();
  ctx.fill();
}
