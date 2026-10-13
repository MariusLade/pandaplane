import { mixRgb, rgb, shade } from '../core/math';
import { hash } from '../core/rng';
import { CLIFF_HEIGHT, GOAL_DISTANCE } from '../game/constants';
import type { Ramp } from '../game/ramp';
import { biomeAt, type Decor, type World } from '../game/world';
import type { Camera } from './camera';

const DECOR_CELL = 6;
const SIGN_EVERY = 250;

export function drawTerrain(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void {
  const { w, h } = cam;
  const step = 5;
  const xs: number[] = [];
  const ys: number[] = [];
  let minY = Infinity;
  for (let sx = -step; sx <= w + step; sx += step) {
    const gy = cam.sy(world.groundY(cam.wx(sx)));
    xs.push(sx);
    ys.push(gy);
    if (gy < minY) minY = gy;
  }
  if (minY > h) return;

  // Horizontal gradient carries the biome colours across the screen.
  const ground = ctx.createLinearGradient(0, 0, w, 0);
  const deep = ctx.createLinearGradient(0, 0, w, 0);
  const lip = ctx.createLinearGradient(0, 0, w, 0);
  const STOPS = 8;
  for (let i = 0; i <= STOPS; i++) {
    const t = i / STOPS;
    const b = biomeAt(cam.wx(t * w));
    ground.addColorStop(t, rgb(mixRgb(b.a.ground, b.b.ground, b.t)));
    deep.addColorStop(t, rgb(mixRgb(b.a.groundDeep, b.b.groundDeep, b.t)));
    lip.addColorStop(t, rgb(mixRgb(b.a.lip, b.b.lip, b.t)));
  }

  const trace = (offset: number) => {
    ctx.beginPath();
    ctx.moveTo(xs[0], h + 10);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i] + offset);
    ctx.lineTo(xs[xs.length - 1], h + 10);
    ctx.closePath();
  };

  trace(0);
  ctx.fillStyle = ground;
  ctx.fill();

  const band = Math.max(10, 4 * cam.ppm);
  trace(band);
  ctx.fillStyle = deep;
  ctx.fill();

  // Soft darkening with depth.
  trace(band * 2.5);
  const shadeG = ctx.createLinearGradient(0, minY, 0, h);
  shadeG.addColorStop(0, 'rgba(0,0,0,0.05)');
  shadeG.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shadeG;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i]);
  ctx.strokeStyle = lip;
  ctx.lineWidth = Math.max(3, Math.min(10, 0.7 * cam.ppm));
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawDecor(ctx: CanvasRenderingContext2D, cam: Camera, world: World, seed: number): void {
  const x0 = cam.wx(-60);
  const x1 = cam.wx(cam.w + 60);
  const ppm = cam.ppm;
  if (ppm < 0.8) return;
  const c0 = Math.floor(x0 / DECOR_CELL);
  const c1 = Math.floor(x1 / DECOR_CELL);
  const stride = Math.max(1, Math.floor(3 / ppm));
  for (let c = c0; c <= c1; c++) {
    if (c % stride !== 0) continue;
    const r = hash(seed, c, 7);
    if (c * DECOR_CELL > -8 && c * DECOR_CELL < 50) continue; // keep the cliff clear
    const x = c * DECOR_CELL + hash(seed, c, 8) * DECOR_CELL;
    const b = biomeAt(x);
    const biome = hash(seed, c, 9) < b.t ? b.b : b.a;
    const density = biome.decor === 'flowers' ? 0.6 : biome.decor === 'bamboo' ? 0.55 : 0.32;
    if (r > density) continue;
    const gy = world.groundY(x);
    const sx = cam.sx(x);
    const sy = cam.sy(gy);
    if (sy - 20 * ppm > cam.h) continue;
    const size = 0.7 + hash(seed, c, 10) * 0.6;
    const kind: Decor = biome.decor;
    const tint = mixRgb(biome.groundDeep, biome.lip, hash(seed, c, 11) * 0.4);
    const roll = hash(seed, c, 12);
    if (kind === 'flowers' && roll < 0.15) drawTree(ctx, sx, sy, ppm, size, 'round', tint);
    else if (kind === 'flowers') drawFlowers(ctx, sx, sy, ppm, size, c, seed);
    else if (kind === 'bamboo') drawBamboo(ctx, sx, sy, ppm, size, c, seed);
    else if (roll < 0.08) drawRock(ctx, sx, sy, ppm, size, biome.groundDeep);
    else drawTree(ctx, sx, sy, ppm, size, kind === 'snowpine' ? 'snowpine' : 'pine', tint);
  }
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  ppm: number,
  size: number,
  kind: 'pine' | 'snowpine' | 'round',
  tint: [number, number, number],
) {
  const hgt = (kind === 'round' ? 6 : 8) * size * ppm;
  const trunkW = Math.max(1, 0.5 * size * ppm);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(sx - trunkW / 2, sy - hgt * 0.3, trunkW, hgt * 0.32);
  if (kind === 'round') {
    ctx.fillStyle = rgb(shade(tint, -0.2));
    ctx.beginPath();
    ctx.arc(sx, sy - hgt * 0.6, hgt * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(shade(tint, -0.05));
    ctx.beginPath();
    ctx.arc(sx - hgt * 0.08, sy - hgt * 0.68, hgt * 0.22, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const green = kind === 'snowpine' ? '#3f6b5a' : rgb(shade([58, 110, 70], -0.05));
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const top = sy - hgt * (0.55 + t * 0.15) - hgt * 0.3 * (1 - t) * 0.4 - hgt * 0.25 * t;
    const half = hgt * (0.34 - t * 0.08);
    const base = sy - hgt * (0.18 + t * 0.24);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(sx - half, base);
    ctx.lineTo(sx, top - hgt * 0.15);
    ctx.lineTo(sx + half, base);
    ctx.closePath();
    ctx.fill();
    if (kind === 'snowpine') {
      ctx.fillStyle = '#f4f9ff';
      ctx.beginPath();
      ctx.moveTo(sx - half * 0.45, base - (base - top) * 0.55);
      ctx.lineTo(sx, top - hgt * 0.15);
      ctx.lineTo(sx + half * 0.45, base - (base - top) * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRock(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: [number, number, number]) {
  const r = 1.2 * size * ppm;
  ctx.fillStyle = rgb(shade(c, -0.15));
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * 1.3, r, 0, Math.PI, 0);
  ctx.fill();
}

const FLOWER_COLORS = ['#ff6b8b', '#ffd34d', '#ffffff', '#b07cff', '#ff8f3d'];

function drawFlowers(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number) {
  const n = 2 + Math.floor(hash(seed, c, 20) * 4);
  const r = Math.max(1.2, 0.25 * size * ppm);
  for (let i = 0; i < n; i++) {
    const fx = sx + (hash(seed, c, 21 + i) - 0.5) * 4 * ppm;
    const fh = (0.6 + hash(seed, c, 31 + i) * 0.8) * ppm;
    ctx.strokeStyle = '#3c8a3a';
    ctx.lineWidth = Math.max(1, 0.08 * ppm);
    ctx.beginPath();
    ctx.moveTo(fx, sy + 2);
    ctx.lineTo(fx, sy - fh);
    ctx.stroke();
    ctx.fillStyle = FLOWER_COLORS[Math.floor(hash(seed, c, 41 + i) * FLOWER_COLORS.length)];
    ctx.beginPath();
    ctx.arc(fx, sy - fh, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBamboo(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number) {
  const n = 1 + Math.floor(hash(seed, c, 50) * 3);
  for (let i = 0; i < n; i++) {
    const bx = sx + (hash(seed, c, 51 + i) - 0.5) * 3 * ppm;
    const hgt = (7 + hash(seed, c, 61 + i) * 8) * size * ppm;
    const wd = Math.max(1.5, 0.35 * ppm);
    const lean = (hash(seed, c, 71 + i) - 0.5) * 0.12;
    const segs = Math.max(2, Math.round(hgt / (1.6 * ppm)));
    const segH = hgt / segs;
    for (let s = 0; s < segs; s++) {
      const y = sy - s * segH;
      const x = bx + lean * s * segH;
      ctx.fillStyle = s % 2 ? '#7cbf4a' : '#6cb043';
      ctx.fillRect(x - wd / 2, y - segH, wd, segH - Math.max(0.5, 0.06 * ppm));
      if (s > segs * 0.4 && hash(seed, c * 13 + s, 80 + i) < 0.4) {
        const dir = hash(seed, c * 13 + s, 90 + i) < 0.5 ? -1 : 1;
        ctx.fillStyle = '#4f9a3a';
        ctx.beginPath();
        ctx.ellipse(x + dir * 0.7 * ppm, y - segH, 0.9 * ppm, 0.22 * ppm, dir * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function drawSigns(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void {
  const ppm = cam.ppm;
  const x0 = cam.wx(-80);
  const x1 = cam.wx(cam.w + 80);
  const scale = Math.max(ppm, 4);
  for (let d = Math.max(SIGN_EVERY, Math.ceil(x0 / SIGN_EVERY) * SIGN_EVERY); d <= x1; d += SIGN_EVERY) {
    if (d === GOAL_DISTANCE) continue;
    const sx = cam.sx(d);
    const sy = cam.sy(world.groundY(d));
    const postH = 2.2 * scale;
    ctx.fillStyle = '#7a5532';
    ctx.fillRect(sx - 0.12 * scale, sy - postH, 0.24 * scale, postH);
    const bw = 2.6 * scale;
    const bh = 1 * scale;
    ctx.fillStyle = '#c99a5b';
    ctx.strokeStyle = '#7a5532';
    ctx.lineWidth = Math.max(1, 0.1 * scale);
    ctx.beginPath();
    ctx.roundRect(sx - bw / 2, sy - postH - bh * 0.6, bw, bh, 0.15 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3d2814';
    ctx.font = `700 ${Math.round(0.6 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d} m`, sx, sy - postH - bh * 0.1);
  }
  ctx.textBaseline = 'alphabetic';

  // The goal gate.
  const gx = cam.sx(GOAL_DISTANCE);
  if (gx > -40 * scale && gx < cam.w + 40 * scale) drawGoalGate(ctx, gx, cam.sy(world.groundY(GOAL_DISTANCE)), Math.max(ppm, 2));
}

function drawGoalGate(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number) {
  const hgt = 16 * ppm;
  const half = 7 * ppm;
  const post = 1 * ppm;
  ctx.fillStyle = '#d6372b';
  ctx.fillRect(sx - half - post / 2, sy - hgt, post, hgt);
  ctx.fillRect(sx + half - post / 2, sy - hgt, post, hgt);
  ctx.fillRect(sx - half - 2 * ppm, sy - hgt * 0.78, half * 2 + 4 * ppm, 0.8 * ppm);
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.moveTo(sx - half - 3.5 * ppm, sy - hgt - 0.2 * ppm);
  ctx.quadraticCurveTo(sx, sy - hgt + 1.2 * ppm, sx + half + 3.5 * ppm, sy - hgt - 0.2 * ppm);
  ctx.lineTo(sx + half + 3 * ppm, sy - hgt + 1.2 * ppm);
  ctx.quadraticCurveTo(sx, sy - hgt + 2.4 * ppm, sx - half - 3 * ppm, sy - hgt + 1.2 * ppm);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe28a';
  ctx.font = `800 ${Math.round(1.3 * ppm)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('PANDA PARADISE', sx, sy - hgt * 0.88);
}

export function drawRamp(ctx: CanvasRenderingContext2D, cam: Camera, ramp: Ramp): void {
  const ppm = cam.ppm;
  const pts = ramp.points;
  if (cam.sx(pts[0].x) > cam.w + 50 || cam.sx(ramp.lip.x) < -50) return;
  const plank = Math.max(3, 0.5 * ppm);
  const ground = CLIFF_HEIGHT;

  // Trestle supports.
  ctx.strokeStyle = '#6e4a2a';
  ctx.lineWidth = Math.max(1.5, 0.22 * ppm);
  const every = Math.max(1, Math.round(3.5 / pts[1].s));
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i < pts.length; i += every) {
    const p = pts[i];
    const sx = cam.sx(p.x);
    ctx.beginPath();
    ctx.moveTo(sx, cam.sy(p.y));
    ctx.lineTo(sx, cam.sy(ground));
    ctx.stroke();
    if (prev) {
      ctx.beginPath();
      ctx.moveTo(cam.sx(prev.x), cam.sy(prev.y - 0.5));
      ctx.lineTo(sx, cam.sy(ground + (p.y - ground) * 0.35));
      ctx.moveTo(cam.sx(prev.x), cam.sy(ground + (prev.y - ground) * 0.35));
      ctx.lineTo(sx, cam.sy(p.y - 0.5));
      ctx.stroke();
    }
    prev = p;
  }

  // Deck.
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(cam.sx(p.x), cam.sy(p.y)) : ctx.moveTo(cam.sx(p.x), cam.sy(p.y))));
  ctx.strokeStyle = '#8a5a32';
  ctx.lineWidth = plank;
  ctx.stroke();
  ctx.strokeStyle = '#e7f2ff';
  ctx.lineWidth = Math.max(1.5, plank * 0.35);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Flag at the top.
  const top = pts[0];
  const fx = cam.sx(top.x - 0.6);
  const fy = cam.sy(top.y);
  const pole = 4 * ppm;
  ctx.fillStyle = '#5a3b20';
  ctx.fillRect(fx - 1, fy - pole, Math.max(2, 0.12 * ppm), pole);
  ctx.fillStyle = '#e2493b';
  ctx.beginPath();
  ctx.moveTo(fx, fy - pole);
  ctx.lineTo(fx - 1.8 * ppm, fy - pole + 0.6 * ppm);
  ctx.lineTo(fx, fy - pole + 1.2 * ppm);
  ctx.fill();
}
