import type { Enemy, Shot } from '../game/combat';
import type { Flight, Strike } from '../game/flight';
import type { World } from '../game/world';
import type { Camera } from './camera';

/** Enemies, projectiles, laser beams, thermals and threat-radar arrows. */

export function drawThermals(ctx: CanvasRenderingContext2D, cam: Camera, world: World, time: number): void {
  for (const th of world.thermalsIn(cam.wx(-50), cam.wx(cam.w + 50))) {
    const base = world.rawGround(th.x);
    const x0 = cam.sx(th.x - th.halfWidth);
    const x1 = cam.sx(th.x + th.halfWidth);
    const yb = cam.sy(base);
    const yt = cam.sy(base + th.top);
    if (yb < 0 || yt > cam.h) continue;
    // A faint warm column...
    const g = ctx.createLinearGradient(0, yb, 0, yt);
    g.addColorStop(0, 'rgba(255,170,90,0.18)');
    g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, yt, x1 - x0, yb - yt);
    // ...with shimmering streaks rising through it.
    ctx.strokeStyle = 'rgba(255,230,190,0.45)';
    ctx.lineWidth = Math.max(1, 0.12 * cam.ppm);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * f;
      const t = (time * 0.35 + i * 0.37) % 1;
      const y = yb + (yt - yb) * t;
      const len = Math.min(60, (yb - yt) * 0.12);
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(time * 4 + i) * 6, y - len / 2, x, y - len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, cam: Camera, enemies: Enemy[], scale: number, time: number): void {
  for (const e of enemies) {
    const x = cam.sx(e.x);
    const y = cam.sy(e.y);
    if (x < -120 || x > cam.w + 120 || y < -120 || y > cam.h + 120) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Face the direction of travel (bandits always face the panda, to the left).
    if (e.kind === 'fish') ctx.rotate(-Math.atan2(e.vy, e.vx) + (e.vx < 0 ? Math.PI : 0));
    if (e.kind !== 'bandit' && e.vx > 0) ctx.scale(-1, 1);
    if (e.kind === 'crow') drawCrow(ctx, e, time);
    else if (e.kind === 'bat') drawBat(ctx, e, time);
    else if (e.kind === 'gull') drawGull(ctx, e, time);
    else if (e.kind === 'fish') drawFish(ctx, e, time);
    else drawBandit(ctx, e, time);
    if (e.hurt > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,255,255,${e.hurt * 5})`;
      ctx.fillRect(-4, -4, 8, 8);
    }
    ctx.restore();
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      const w = 2.4 * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - w / 2, y - 2.2 * scale, w, 4);
      ctx.fillStyle = '#ff5a3d';
      ctx.fillRect(x - w / 2, y - 2.2 * scale, (w * e.hp) / e.maxHp, 4);
    }
  }
}

/** Local units are metres; +x is the way the bird faces (left by default). */
function drawCrow(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const flap = Math.sin(time * 18 + e.id) * 0.6;
  ctx.fillStyle = '#1f1d24';
  // Wings.
  ctx.beginPath();
  ctx.moveTo(0.1, -0.1);
  ctx.quadraticCurveTo(0.3, -0.8 * flap - 0.3, 0.9, -1.0 * flap - 0.1);
  ctx.quadraticCurveTo(0.5, -0.2, 0.1, 0.1);
  ctx.fill();
  // Body and tail.
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.7, 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.6, 0);
  ctx.lineTo(1.1, -0.2);
  ctx.lineTo(1.1, 0.25);
  ctx.closePath();
  ctx.fill();
  // Head facing left with an angry eye and beak.
  ctx.beginPath();
  ctx.arc(-0.65, -0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb238';
  ctx.beginPath();
  ctx.moveTo(-0.9, -0.25);
  ctx.lineTo(-1.25, -0.1);
  ctx.lineTo(-0.9, -0.05);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-0.72, -0.27, 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e2493b';
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(-0.85, -0.42);
  ctx.lineTo(-0.58, -0.34);
  ctx.stroke();
  ctx.fillStyle = '#1f1d24';
  ctx.beginPath();
  ctx.arc(-0.74, -0.26, 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawBat(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const flap = Math.sin(time * 22 + e.id);
  // Flame trail.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(255,${120 + i * 30},40,${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(0.6 + i * 0.35, Math.sin(time * 10 + i) * 0.1, 0.3 - i * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5a1d1d';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0.2 * side, -0.9 * flap * side - 0.2);
    ctx.lineTo(0.9 * side, -0.5 * flap - 0.1);
    ctx.quadraticCurveTo(0.6 * side, 0, 0.9 * side, 0.2);
    ctx.quadraticCurveTo(0.4 * side, 0.1, 0, 0.2);
    ctx.fill();
  }
  ctx.fillStyle = '#7a2a22';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.35, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(-0.12, -0.05, 0.07, 0, Math.PI * 2);
  ctx.arc(0.08, -0.05, 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** A grumpy seagull with long bent wings. */
function drawGull(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const flap = Math.sin(time * 9 + e.id) * 0.7;
  ctx.lineJoin = 'round';
  // Far wing.
  ctx.fillStyle = '#c9d2dc';
  ctx.beginPath();
  ctx.moveTo(0, -0.1);
  ctx.lineTo(0.5, -0.5 - flap * 0.5);
  ctx.lineTo(1.4, -0.3 - flap * 0.9);
  ctx.quadraticCurveTo(0.7, -0.1, 0.3, 0.1);
  ctx.fill();
  // Body.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.75, 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9aa3ad';
  ctx.beginPath();
  ctx.moveTo(0.6, -0.05);
  ctx.lineTo(1.1, -0.2);
  ctx.lineTo(1.05, 0.15);
  ctx.closePath();
  ctx.fill();
  // Head, beak and a very judgemental eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-0.68, -0.22, 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb238';
  ctx.beginPath();
  ctx.moveTo(-0.9, -0.24);
  ctx.lineTo(-1.35, -0.16);
  ctx.lineTo(-0.9, -0.08);
  ctx.fill();
  ctx.fillStyle = '#e2493b';
  ctx.beginPath();
  ctx.arc(-1.12, -0.13, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f1d24';
  ctx.beginPath();
  ctx.arc(-0.76, -0.28, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f1d24';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.88, -0.4);
  ctx.lineTo(-0.62, -0.36);
  ctx.stroke();
  // Near wing with dark tips.
  ctx.fillStyle = '#e4e9ee';
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.05);
  ctx.lineTo(0.35, -0.55 - flap * 0.6);
  ctx.lineTo(1.25, -0.35 - flap * 1.1);
  ctx.quadraticCurveTo(0.6, -0.05, 0.2, 0.12);
  ctx.fill();
  ctx.fillStyle = '#1f1d24';
  ctx.beginPath();
  ctx.moveTo(1.25, -0.35 - flap * 1.1);
  ctx.lineTo(0.95, -0.38 - flap * 0.95);
  ctx.lineTo(1.05, -0.22 - flap * 0.8);
  ctx.fill();
}

/** A flying fish, fins spread, dripping water. */
function drawFish(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const wag = Math.sin(time * 20 + e.id) * 0.15;
  // Wing-like fins.
  ctx.fillStyle = 'rgba(140,220,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.05);
  ctx.quadraticCurveTo(0.2, -0.9, 0.7, -0.6);
  ctx.quadraticCurveTo(0.4, -0.2, 0.3, 0);
  ctx.fill();
  // Body.
  const g = ctx.createLinearGradient(0, -0.3, 0, 0.3);
  g.addColorStop(0, '#2f7de1');
  g.addColorStop(1, '#bfe6ff');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.75, 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail.
  ctx.fillStyle = '#2f7de1';
  ctx.beginPath();
  ctx.moveTo(0.65, 0);
  ctx.lineTo(1.15, -0.35 + wag);
  ctx.lineTo(1.0, 0);
  ctx.lineTo(1.15, 0.35 + wag);
  ctx.closePath();
  ctx.fill();
  // Eye and frown.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-0.45, -0.06, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f1d24';
  ctx.beginPath();
  ctx.arc(-0.48, -0.06, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1f1d24';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.arc(-0.66, 0.14, 0.08, Math.PI * 1.2, Math.PI * 1.9);
  ctx.stroke();
  // Droplets.
  ctx.fillStyle = 'rgba(200,235,255,0.8)';
  for (let i = 0; i < 3; i++) {
    const t = (time * 2 + i / 3 + e.id * 0.1) % 1;
    ctx.beginPath();
    ctx.arc(0.8 + t * 0.6, 0.2 + t * t * 0.8, 0.06 * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A red panda bandit in a patched hot-air balloon. */
function drawBandit(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const sway = Math.sin(time * 1.5 + e.id) * 0.08;
  ctx.rotate(sway);
  // Balloon.
  const stripes = ['#e2493b', '#ffd23d'];
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -2.2, 1.6, 1.9, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = stripes[(i + 3) % 2];
    ctx.fillRect(i * 0.5 - 0.25, -4.2, 0.5, 4);
  }
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(0.4, -2.8, 0.5, 0.5);
  ctx.restore();
  ctx.strokeStyle = '#5a3b20';
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(-0.9, -0.8);
  ctx.lineTo(-0.5, 0.4);
  ctx.moveTo(0.9, -0.8);
  ctx.lineTo(0.5, 0.4);
  ctx.stroke();
  // Basket.
  ctx.fillStyle = '#a0703c';
  ctx.fillRect(-0.6, 0.3, 1.2, 0.7);
  ctx.strokeStyle = '#6e4a2a';
  ctx.beginPath();
  ctx.moveTo(-0.6, 0.55);
  ctx.lineTo(0.6, 0.55);
  ctx.stroke();
  // Red panda peeking out, with a mask.
  ctx.fillStyle = '#c4532a';
  ctx.beginPath();
  ctx.arc(0, 0.12, 0.38, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#c4532a';
  ctx.beginPath();
  ctx.moveTo(-0.32, -0.1);
  ctx.lineTo(-0.38, -0.42);
  ctx.lineTo(-0.15, -0.22);
  ctx.moveTo(0.32, -0.1);
  ctx.lineTo(0.38, -0.42);
  ctx.lineTo(0.15, -0.22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(0, 0.05, 0.22, 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f1d24';
  ctx.fillRect(-0.3, -0.08, 0.6, 0.1);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-0.12, -0.03, 0.04, 0, Math.PI * 2);
  ctx.arc(0.12, -0.03, 0.04, 0, Math.PI * 2);
  ctx.fill();
}

export function drawShots(ctx: CanvasRenderingContext2D, cam: Camera, shots: Shot[], scale: number, time: number): void {
  for (const s of shots) {
    const x = cam.sx(s.x);
    const y = cam.sy(s.y);
    if (x < -20 || x > cam.w + 20 || y < -20 || y > cam.h + 20) continue;
    const r = Math.max(2.5, 0.25 * scale);
    switch (s.style) {
      case 'peas':
        dot(ctx, x, y, r, '#6dbb4b', '#3d7d2a');
        break;
      case 'snow':
        dot(ctx, x, y, r * 1.1, '#ffffff', '#b9d4ec');
        break;
      case 'sling':
      case 'pinecone': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 10);
        ctx.fillStyle = '#7a4e2b';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.5, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4d2f18';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.5);
        ctx.lineTo(r, r * 0.5);
        ctx.moveTo(-r, r * 0.5);
        ctx.lineTo(r, -r * 0.5);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'crackers': {
        const a = Math.atan2(-s.vy, s.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = '#e2493b';
        ctx.fillRect(-r * 2, -r * 0.6, r * 3, r * 1.2);
        ctx.fillStyle = '#ffd23d';
        ctx.beginPath();
        ctx.arc(-r * 2.4, 0, r * (0.6 + Math.random() * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'bees': {
        ctx.fillStyle = '#ffd23d';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(x - r * 0.3, y - r, r * 0.5, r * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(x, y - r * 1.1, r * 0.6, r * 0.4, Math.sin(time * 40) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        dot(ctx, x, y, r, '#fff', '#999');
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, edge: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Jagged lightning between screen points, deterministic per `seed`. */
function bolt(ctx: CanvasRenderingContext2D, pts: [number, number][], seed: number, jag: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  let k = seed;
  const rnd = () => {
    k = (k * 16807) % 2147483647;
    return k / 2147483647 - 0.5;
  };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / 18));
    const nx = -(by - ay) / (len || 1);
    const ny = (bx - ax) / (len || 1);
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const off = rnd() * jag * 2;
      ctx.lineTo(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off);
    }
    ctx.lineTo(bx, by);
  }
}

function strokeGlow(ctx: CanvasRenderingContext2D, layers: [number, string][]) {
  for (const [w, c] of layers) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

export function drawBeam(ctx: CanvasRenderingContext2D, cam: Camera, f: Flight): void {
  const b = f.beam;
  if (!b) return;
  const fade = 1 - b.age / 0.15;
  const x0 = cam.sx(b.x);
  const y0 = cam.sy(b.y);
  const x1 = cam.sx(b.x + Math.cos(b.a) * b.len);
  const y1 = cam.sy(b.y + Math.sin(b.a) * b.len);
  if (b.style === 'zap') {
    const pts: [number, number][] = [[x0, y0], ...(b.hops.length ? b.hops.map((h) => [cam.sx(h.x), cam.sy(h.y)] as [number, number]) : [[x1, y1] as [number, number]])];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    bolt(ctx, pts, Math.floor(b.x * 13 + b.age * 400) + 7, 9);
    strokeGlow(ctx, [
      [12, `rgba(255,210,60,${0.25 * fade})`],
      [5, `rgba(255,230,120,${0.7 * fade})`],
      [2, `rgba(255,255,255,${fade})`],
    ]);
    for (const [hx, hy] of pts.slice(1)) {
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      g.addColorStop(0, `rgba(255,240,170,${0.8 * fade})`);
      g.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(hx - 26, hy - 26, 52, 52);
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const [w, c] of [
    [10, `rgba(255,40,90,${0.35 * fade})`],
    [4, `rgba(255,90,140,${0.8 * fade})`],
    [1.5, `rgba(255,255,255,${fade})`],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Arrows at the screen edge pointing at enemies that aren't visible yet. */
export function drawThreatArrows(ctx: CanvasRenderingContext2D, cam: Camera, enemies: Enemy[], time: number): void {
  const pad = 40;
  for (const e of enemies) {
    const x = cam.sx(e.x);
    const y = cam.sy(e.y);
    if (x > 0 && x < cam.w && y > 0 && y < cam.h) continue;
    const cx = cam.w / 2;
    const cy = cam.h / 2;
    const a = Math.atan2(y - cy, x - cx);
    // Intersect the ray with the padded screen rectangle.
    const kx = (cam.w / 2 - pad) / Math.abs(Math.cos(a) || 1e-6);
    const ky = (cam.h / 2 - pad) / Math.abs(Math.sin(a) || 1e-6);
    const k = Math.min(kx, ky);
    const ax = cx + Math.cos(a) * k;
    const ay = cy + Math.sin(a) * k;
    const pulse = 0.7 + 0.3 * Math.sin(time * 8);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = e.kind === 'bandit' ? `rgba(255,160,40,${pulse})` : `rgba(255,70,60,${pulse})`;
    ctx.strokeStyle = '#2a2340';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Bands of wind: streaming lines moving the way the air blows. */
export function drawGusts(ctx: CanvasRenderingContext2D, cam: Camera, world: World, time: number): void {
  for (const g of world.gustsIn(cam.wx(-50), cam.wx(cam.w + 50))) {
    const x0 = cam.sx(g.x0);
    const x1 = cam.sx(g.x1);
    const yTop = cam.sy(g.y1);
    const yBot = cam.sy(g.y0);
    if (x1 < 0 || x0 > cam.w || yBot < 0 || yTop > cam.h) continue;
    const dir = Math.sign(g.speed);
    const tail = dir > 0;
    // A faint tinted band: blue for tailwinds, red-ish for headwinds.
    const tint = tail ? '170,225,255' : '255,190,170';
    const band = ctx.createLinearGradient(0, yTop, 0, yBot);
    band.addColorStop(0, `rgba(${tint},0)`);
    band.addColorStop(0.5, `rgba(${tint},0.22)`);
    band.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);
    // Streaks.
    ctx.lineCap = 'round';
    const lanes = 9;
    const speed = Math.abs(g.speed);
    for (let i = 0; i < lanes; i++) {
      const fy = (i + 0.5) / lanes;
      const y = yTop + (yBot - yTop) * fy;
      const len = Math.min(140, (x1 - x0) * 0.25);
      const t = (time * speed * 0.035 + i * 0.37) % 1;
      const p = dir > 0 ? t : 1 - t;
      const x = x0 + (x1 - x0 + len) * p - len;
      const a = Math.sin(t * Math.PI) * Math.min(1, (0.5 - Math.abs(fy - 0.5)) * 4);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.lineWidth = Math.max(2, 0.14 * cam.ppm);
      ctx.beginPath();
      const wob = Math.sin(time * 3 + i) * 3;
      ctx.moveTo(Math.max(x0, x), y + wob);
      ctx.quadraticCurveTo(x + len * 0.5, y - wob, Math.min(x1, x + len), y + wob * 0.5);
      ctx.stroke();
    }
    // Chevrons at the edges hint at the direction.
    const cy = (yTop + yBot) / 2;
    const ax = dir > 0 ? x0 + 14 : x1 - 14;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(time * 5)})`;
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const bx = ax + dir * k * 12;
      ctx.beginPath();
      ctx.moveTo(bx - dir * 6, cy - 8);
      ctx.lineTo(bx + dir * 4, cy);
      ctx.lineTo(bx - dir * 6, cy + 8);
      ctx.stroke();
    }
  }
}

/** Lightning: a flickering warning column, then the bolt. */
export function drawStrikes(ctx: CanvasRenderingContext2D, cam: Camera, world: World, strikes: Strike[], time: number): void {
  for (const s of strikes) {
    const x = cam.sx(s.x);
    if (x < -100 || x > cam.w + 100) continue;
    const ground = cam.sy(world.groundY(s.x));
    const top = Math.min(cam.sy(s.top), -20);
    if (s.warn > 0) {
      // Charging: a dashed column and a target ring on the ground, faster as it nears.
      const urgency = 1 - s.warn / 1.15;
      const flick = Math.sin(time * (14 + urgency * 30)) > 0 ? 1 : 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(255,236,140,${(0.25 + urgency * 0.5) * flick})`;
      ctx.lineWidth = 2 + urgency * 4;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -time * 80;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, ground);
      ctx.stroke();
      ctx.setLineDash([]);
      const rr = (3.6 * cam.ppm) * (1.4 - urgency * 0.4);
      ctx.strokeStyle = `rgba(255,220,80,${0.4 + urgency * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, ground, Math.max(10, rr), Math.max(4, rr * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    const fade = 1 - s.bolt / 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Main bolt plus a couple of forks.
    bolt(ctx, [[x + 10, top], [x, ground]], s.seed + Math.floor(s.bolt * 30), 16);
    strokeGlow(ctx, [
      [22, `rgba(160,190,255,${0.22 * fade})`],
      [9, `rgba(220,230,255,${0.6 * fade})`],
      [3, `rgba(255,255,255,${fade})`],
    ]);
    for (let k = 0; k < 2; k++) {
      const fy = top + (ground - top) * (0.35 + k * 0.2);
      bolt(ctx, [[x + 4, fy], [x + (k ? 50 : -60), fy + 90]], s.seed + k * 77, 10);
      strokeGlow(ctx, [
        [6, `rgba(200,215,255,${0.4 * fade})`],
        [1.5, `rgba(255,255,255,${0.8 * fade})`],
      ]);
    }
    const g = ctx.createRadialGradient(x, ground, 0, x, ground, 90);
    g.addColorStop(0, `rgba(255,255,230,${0.7 * fade})`);
    g.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, ground - 90, 180, 180);
    ctx.restore();
  }
}
