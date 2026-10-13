import { mixRgb, rgb, shade, type RGB } from '../core/math';
import { fbm1, hash } from '../core/rng';
import type { Ramp } from '../game/ramp';
import { mainBiome, type World } from '../game/world';
import type { Camera } from './camera';
import { drawTree, TREE_HEIGHT, VARIANTS, type TreeKind } from './flora';

const DECOR_CELL = 4;
const SIGN_EVERY = 250;
/** No scenery on the ramp line or the kicker run-out. */
const CLEAR_FROM = -175;
const CLEAR_TO = 14;

export function drawTerrain(ctx: CanvasRenderingContext2D, cam: Camera, world: World, time: number): void {
  const { w, h } = cam;
  const step = 5;
  const xs: number[] = [];
  const ys: number[] = [];
  const wxs: number[] = [];
  let minY = Infinity;
  for (let sx = -step; sx <= w + step; sx += step) {
    const wx = cam.wx(sx);
    // The raw terrain: pond beds are filled with water afterwards.
    const gy = cam.sy(world.rawGround(wx));
    xs.push(sx);
    ys.push(gy);
    wxs.push(wx);
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
    const b = world.biomeAt(cam.wx(t * w));
    ground.addColorStop(t, rgb(mixRgb(b.a.ground, b.b.ground, b.t)));
    deep.addColorStop(t, rgb(mixRgb(b.a.groundDeep, b.b.groundDeep, b.t)));
    lip.addColorStop(t, rgb(mixRgb(b.a.lip, b.b.lip, b.t)));
  }

  const trace = (offset: (i: number) => number) => {
    ctx.beginPath();
    ctx.moveTo(xs[0], h + 10);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i] + offset(i));
    ctx.lineTo(xs[xs.length - 1], h + 10);
    ctx.closePath();
  };

  trace(() => 0);
  ctx.fillStyle = ground;
  ctx.fill();

  // Rock strata: wavy bands that follow the surface at depth.
  const band = Math.max(10, 4 * cam.ppm);
  trace((i) => band * (1 + 0.35 * Math.sin(wxs[i] * 0.045)));
  ctx.fillStyle = deep;
  ctx.fill();
  trace((i) => band * (2.4 + 0.5 * Math.sin(wxs[i] * 0.03 + 1.7)));
  ctx.fillStyle = 'rgba(40,30,60,0.12)';
  ctx.fill();
  trace((i) => band * (4 + 0.8 * Math.sin(wxs[i] * 0.021 + 4)));
  const shadeG = ctx.createLinearGradient(0, minY, 0, h);
  shadeG.addColorStop(0, 'rgba(0,0,0,0.06)');
  shadeG.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = shadeG;
  ctx.fill();

  drawPebbles(ctx, cam, world);

  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i]);
  ctx.strokeStyle = lip;
  ctx.lineWidth = Math.max(3, Math.min(10, 0.7 * cam.ppm));
  ctx.lineJoin = 'round';
  ctx.stroke();

  drawPonds(ctx, cam, world, time);
  drawGroundDetail(ctx, cam, world, time);
}

/** Stones embedded in the soil, visible when zoomed in. */
function drawPebbles(ctx: CanvasRenderingContext2D, cam: Camera, world: World) {
  const ppm = cam.ppm;
  if (ppm < 3) return;
  const cell = 2.5;
  const c0 = Math.floor(cam.wx(0) / cell);
  const c1 = Math.floor(cam.wx(cam.w) / cell);
  for (let c = c0; c <= c1; c++) {
    if (hash(world.seed, c, 301) > 0.45) continue;
    const x = (c + hash(world.seed, c, 302)) * cell;
    const depth = 0.8 + hash(world.seed, c, 303) * 7;
    const sy = cam.sy(world.rawGround(x) - depth);
    if (sy > cam.h + 10) continue;
    const r = (0.15 + hash(world.seed, c, 304) * 0.45) * ppm;
    const b = world.biomeAt(x);
    const base = mixRgb(b.a.groundDeep, b.b.groundDeep, b.t);
    ctx.fillStyle = rgb(shade(base, hash(world.seed, c, 305) > 0.5 ? -0.25 : 0.18));
    ctx.beginPath();
    ctx.ellipse(cam.sx(x), sy, r * 1.4, r, hash(world.seed, c, 306) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPonds(ctx: CanvasRenderingContext2D, cam: Camera, world: World, time: number) {
  for (const pond of world.pondsIn(cam.wx(0), cam.wx(cam.w))) {
    const top = cam.sy(pond.level);
    if (top > cam.h + 5) continue;
    const step = Math.max(0.5, 4 / cam.ppm);
    ctx.beginPath();
    ctx.moveTo(cam.sx(pond.x0), top);
    ctx.lineTo(cam.sx(pond.x1), top);
    for (let x = pond.x1; x >= pond.x0; x -= step) ctx.lineTo(cam.sx(x), cam.sy(Math.min(pond.level, world.rawGround(x))));
    ctx.closePath();
    const bottom = cam.sy(pond.level - 6);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    if (pond.kind === 'lava') {
      g.addColorStop(0, '#ffd24a');
      g.addColorStop(0.25, '#ff7a1f');
      g.addColorStop(1, '#8c1d0e');
    } else if (pond.kind === 'ice') {
      g.addColorStop(0, 'rgba(214,240,255,0.95)');
      g.addColorStop(1, 'rgba(150,200,235,0.9)');
    } else {
      g.addColorStop(0, 'rgba(90,175,235,0.85)');
      g.addColorStop(1, 'rgba(30,90,160,0.9)');
    }
    ctx.fillStyle = g;
    ctx.fill();
    const x0 = cam.sx(pond.x0);
    const x1 = cam.sx(pond.x1);
    ctx.lineWidth = Math.max(2, 0.25 * cam.ppm);
    ctx.strokeStyle = pond.kind === 'lava' ? '#fff3b0' : pond.kind === 'ice' ? '#ffffff' : 'rgba(220,245,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x1, top);
    ctx.stroke();
    const span = pond.x1 - pond.x0;
    if (pond.kind === 'lava') {
      drawLavaSurface(ctx, cam, world, pond.x0, span, top, time);
      continue;
    }
    if (pond.kind === 'ice') {
      // Cracks and glints.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1, 0.06 * cam.ppm);
      ctx.beginPath();
      for (let i = 0; i < Math.min(8, span / 5); i++) {
        const cx = pond.x0 + hash(world.seed, i, Math.floor(pond.x0)) * span;
        const sx = cam.sx(cx);
        const d = (0.5 + hash(world.seed, i + 9, Math.floor(pond.x0))) * cam.ppm;
        ctx.moveTo(sx, top + 1);
        ctx.lineTo(sx + d, top + d * 0.6);
        ctx.lineTo(sx + d * 0.4, top + d * 1.3);
      }
      ctx.stroke();
    } else if (cam.ppm > 2) {
      // Ripples drifting across, and lily pads.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(1, 0.08 * cam.ppm);
      for (let i = 0; i < Math.min(6, span / 6); i++) {
        const t = (time * 0.15 + hash(world.seed, i, 77)) % 1;
        const cx = pond.x0 + 2 + t * (span - 4);
        const rw = (0.6 + hash(world.seed, i, 78)) * cam.ppm;
        ctx.globalAlpha = Math.sin(t * Math.PI);
        ctx.beginPath();
        ctx.ellipse(cam.sx(cx), top + 2, rw, rw * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (mainBiome(world.biomeAt(pond.x0)).grass) {
        for (let i = 0; i < Math.min(5, span / 8); i++) {
          const cx = pond.x0 + 1 + hash(world.seed, i, 79) * (span - 2);
          const r = 0.5 * cam.ppm;
          ctx.fillStyle = '#4f9a3c';
          ctx.beginPath();
          ctx.ellipse(cam.sx(cx), top, r, r * 0.3, 0, 0.3, Math.PI * 2);
          ctx.lineTo(cam.sx(cx), top);
          ctx.fill();
          if (hash(world.seed, i, 80) < 0.4) {
            ctx.fillStyle = '#ff9ec4';
            ctx.beginPath();
            ctx.arc(cam.sx(cx) + r * 0.2, top - r * 0.25, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
}

/** Heat glow, bubbles and crust plates on a lava pool. */
function drawLavaSurface(ctx: CanvasRenderingContext2D, cam: Camera, world: World, x0: number, span: number, top: number, time: number) {
  const ppm = cam.ppm;
  const left = cam.sx(x0);
  const width = span * ppm;
  const glow = ctx.createLinearGradient(0, top - 6 * ppm, 0, top);
  glow.addColorStop(0, 'rgba(255,120,40,0)');
  glow.addColorStop(1, 'rgba(255,120,40,0.35)');
  ctx.fillStyle = glow;
  ctx.fillRect(left, top - 6 * ppm, width, 6 * ppm);
  if (ppm < 1.5) return;
  const seed = Math.floor(x0);
  // Dark crust plates drifting slowly.
  ctx.fillStyle = 'rgba(60,20,15,0.55)';
  for (let i = 0; i < Math.min(10, span / 4); i++) {
    const t = (hash(world.seed, i, seed) + time * 0.02) % 1;
    const cx = left + t * width;
    const w = (1 + hash(world.seed, i + 20, seed) * 2.5) * ppm;
    ctx.beginPath();
    ctx.ellipse(cx, top + 0.25 * ppm, w, 0.25 * ppm, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bubbles that swell and pop.
  for (let i = 0; i < Math.min(8, span / 5); i++) {
    const phase = (time * (0.6 + hash(world.seed, i + 40, seed)) + hash(world.seed, i + 50, seed)) % 1;
    const cx = left + hash(world.seed, i + 60, seed) * width;
    const r = phase * 0.6 * ppm;
    ctx.fillStyle = `rgba(255,220,120,${0.9 - phase * 0.6})`;
    ctx.beginPath();
    ctx.arc(cx, top, r, Math.PI, 0);
    ctx.fill();
  }
}

/** Glowing cracks in volcanic ground. */
function drawEmbers(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, c: number, seed: number, time: number) {
  if (hash(seed, c, 420) > 0.35) return;
  const flicker = 0.55 + 0.45 * Math.sin(time * (2 + hash(seed, c, 421) * 3) + c);
  ctx.strokeStyle = `rgba(255,${120 + flicker * 80},50,${0.5 + flicker * 0.5})`;
  ctx.lineWidth = Math.max(1, 0.1 * ppm);
  ctx.beginPath();
  const w = (0.6 + hash(seed, c, 422) * 1.2) * ppm;
  ctx.moveTo(sx - w, sy + 0.2 * ppm);
  ctx.lineTo(sx - w * 0.3, sy + 0.5 * ppm);
  ctx.lineTo(sx + w * 0.2, sy + 0.25 * ppm);
  ctx.lineTo(sx + w, sy + 0.6 * ppm);
  ctx.stroke();
}

/** Grass tufts on green ground, glitter on snow. */
function drawGroundDetail(ctx: CanvasRenderingContext2D, cam: Camera, world: World, time: number) {
  const ppm = cam.ppm;
  if (ppm < 4) return;
  const cell = 1.2;
  const c0 = Math.floor(cam.wx(0) / cell);
  const c1 = Math.floor(cam.wx(cam.w) / cell);
  ctx.lineWidth = Math.max(1, 0.07 * ppm);
  ctx.lineCap = 'round';
  for (let c = c0; c <= c1; c++) {
    const x = (c + hash(world.seed, c, 401)) * cell;
    if (x > CLEAR_FROM && x < CLEAR_TO) continue;
    if (world.surfaceAt(x) !== 'ground') continue;
    const b = world.biomeAt(x);
    const biome = hash(world.seed, c, 402) < b.t ? b.b : b.a;
    const sx = cam.sx(x);
    const sy = cam.sy(world.groundY(x)) + ppm * 0.1;
    if (biome.embers) {
      drawEmbers(ctx, sx, sy, ppm, c, world.seed, time);
      continue;
    }
    if (!biome.grass && !biome.snowy) continue;
    if (biome.snowy) {
      const tw = Math.sin(time * 3 + c * 1.7);
      if (hash(world.seed, c, 403) < 0.3 && tw > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${(tw - 0.6) * 2.5})`;
        const r = 0.12 * ppm;
        ctx.fillRect(sx - r, sy - r * 2, r * 2, r * 0.6);
        ctx.fillRect(sx - r * 0.3, sy - r * 2.7, r * 0.6, r * 2);
      }
      continue;
    }
    if (hash(world.seed, c, 404) > 0.55) continue;
    const blades = 3 + Math.floor(hash(world.seed, c, 405) * 3);
    const hgt = (0.35 + hash(world.seed, c, 406) * 0.45) * ppm;
    const sway = Math.sin(time * 2 + x * 0.3) * 0.25;
    ctx.strokeStyle = rgb(shade(biome.lip, -0.25 - hash(world.seed, c, 407) * 0.2));
    ctx.beginPath();
    for (let k = 0; k < blades; k++) {
      const off = (k - (blades - 1) / 2) * 0.12 * ppm;
      ctx.moveTo(sx + off, sy);
      ctx.quadraticCurveTo(sx + off + sway * hgt * 0.3, sy - hgt * 0.6, sx + off * 1.8 + sway * hgt, sy - hgt);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

type Prop = TreeKind | 'rock' | 'flowers' | 'mushroom' | 'snowman' | 'lantern' | 'drift' | 'crystal' | 'basalt';

function pickProp(scenery: [string, number][], roll: number): Prop | null {
  let acc = 0;
  for (const [prop, weight] of scenery) {
    acc += weight;
    if (roll < acc) return prop as Prop;
  }
  return null;
}

/**
 * Scenery along the ground. `layer` 'back' is drawn before the terrain with
 * sunken bases, so those trees read as standing behind the ridge.
 */
export function drawDecor(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  world: World,
  time: number,
  dpr: number,
  layer: 'back' | 'front',
): void {
  const ppm = cam.ppm;
  if (ppm < 0.6) return;
  const back = layer === 'back';
  const salt = back ? 1000 : 0;
  const x0 = cam.wx(-80);
  const x1 = cam.wx(cam.w + 80);
  const c0 = Math.floor(x0 / DECOR_CELL);
  const c1 = Math.floor(x1 / DECOR_CELL);
  // Thin out when zoomed far out.
  const stride = Math.max(1, Math.floor(2.5 / ppm));
  const seed = world.seed + salt;
  for (let c = c0; c <= c1; c++) {
    if (c % stride !== 0) continue;
    const x = (c + hash(seed, c, 8) * 0.8) * DECOR_CELL;
    if (x > CLEAR_FROM && x < CLEAR_TO) continue;
    if (world.surfaceAt(x) !== 'ground') continue;
    const b = world.biomeAt(x);
    const biome = hash(seed, c, 9) < b.t ? b.b : b.a;
    // Groves and clearings: density follows a slow noise.
    const grove = 0.35 + 1.3 * Math.max(0, fbm1(seed + 55, x / 140, 2) + 0.35);
    const prop = pickProp(biome.scenery, hash(seed, c, 7) / grove);
    if (!prop) continue;
    const isTree = prop in TREE_HEIGHT;
    if (back && !isTree) continue;
    const gy = world.groundY(x);
    const sink = back ? 0.8 + hash(seed, c, 12) * 2.5 : 0;
    const sx = cam.sx(x);
    const sy = cam.sy(gy - sink);
    if (sy - 20 * ppm > cam.h || sy < -30 * ppm) continue;
    const size = (back ? 0.75 : 0.85) + hash(seed, c, 10) * 0.5;
    if (isTree) {
      const kind = prop as TreeKind;
      const hpx = TREE_HEIGHT[kind] * size * ppm;
      const variant = Math.floor(hash(seed, c, 11) * VARIANTS);
      const sway = kind === 'bush' ? 0 : Math.sin(time * 1.3 + x * 0.07) * 0.025;
      if (back) ctx.globalAlpha = 0.88;
      drawTree(ctx, kind, variant, sx, sy + ppm * 0.15, hpx, dpr, sway);
      ctx.globalAlpha = 1;
      continue;
    }
    if (ppm < 1.5) continue;
    switch (prop) {
      case 'rock':
        drawRock(ctx, sx, sy, ppm, size, biome.groundDeep, biome.snowy);
        break;
      case 'flowers':
        drawFlowers(ctx, sx, sy, ppm, size, c, seed, time);
        break;
      case 'mushroom':
        drawMushrooms(ctx, sx, sy, ppm, size, c, seed);
        break;
      case 'snowman':
        drawSnowman(ctx, sx, sy, ppm);
        break;
      case 'lantern':
        drawLantern(ctx, sx, sy, ppm, time + c);
        break;
      case 'crystal':
        drawCrystals(ctx, sx, sy, ppm, size, c, seed, time);
        break;
      case 'basalt':
        drawBasalt(ctx, sx, sy, ppm, size, c, seed);
        break;
      case 'drift':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sx, sy + ppm * 0.2, 2.2 * size * ppm, 0.7 * size * ppm, 0, Math.PI, 0);
        ctx.fill();
        break;
    }
  }
}

function drawRock(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: RGB, snowy: boolean) {
  const r = 1.1 * size * ppm;
  const body = shade(mixRgb(c, [120, 120, 130], 0.5), -0.1);
  ctx.fillStyle = rgb(body);
  ctx.beginPath();
  ctx.moveTo(sx - r * 1.4, sy + r * 0.2);
  ctx.lineTo(sx - r * 1.1, sy - r * 0.55);
  ctx.lineTo(sx - r * 0.3, sy - r * 0.95);
  ctx.lineTo(sx + r * 0.6, sy - r * 0.75);
  ctx.lineTo(sx + r * 1.3, sy - r * 0.1);
  ctx.lineTo(sx + r * 1.4, sy + r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(shade(body, 0.25));
  ctx.beginPath();
  ctx.moveTo(sx - r * 1.1, sy - r * 0.55);
  ctx.lineTo(sx - r * 0.3, sy - r * 0.95);
  ctx.lineTo(sx + r * 0.6, sy - r * 0.75);
  ctx.lineTo(sx + r * 0.1, sy - r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = snowy ? '#f7fbff' : 'rgba(90,150,70,0.8)';
  ctx.beginPath();
  ctx.moveTo(sx - r * 1.05, sy - r * 0.5);
  ctx.quadraticCurveTo(sx - r * 0.3, sy - r * 1.15, sx + r * 0.65, sy - r * 0.72);
  ctx.quadraticCurveTo(sx - r * 0.2, sy - r * 0.75, sx - r * 1.05, sy - r * 0.5);
  ctx.fill();
}

const FLOWER_COLORS = ['#ff6b8b', '#ffd34d', '#ffffff', '#b07cff', '#ff8f3d', '#5dc4ff'];

function drawFlowers(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number, time: number) {
  const n = 3 + Math.floor(hash(seed, c, 20) * 5);
  const r = Math.max(1.2, 0.2 * size * ppm);
  for (let i = 0; i < n; i++) {
    const fx = sx + (hash(seed, c, 21 + i) - 0.5) * 3.5 * ppm;
    const fh = (0.5 + hash(seed, c, 31 + i) * 0.9) * ppm;
    const sway = Math.sin(time * 2.5 + fx * 0.05) * fh * 0.12;
    ctx.strokeStyle = '#3c8a3a';
    ctx.lineWidth = Math.max(1, 0.07 * ppm);
    ctx.beginPath();
    ctx.moveTo(fx, sy + 2);
    ctx.quadraticCurveTo(fx, sy - fh * 0.5, fx + sway, sy - fh);
    ctx.stroke();
    const color = FLOWER_COLORS[Math.floor(hash(seed, c, 41 + i) * FLOWER_COLORS.length)];
    ctx.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + sway + Math.cos(a) * r * 0.6, sy - fh + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(fx + sway, sy - fh, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMushrooms(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number) {
  const n = 1 + Math.floor(hash(seed, c, 60) * 3);
  for (let i = 0; i < n; i++) {
    const mx = sx + (i - (n - 1) / 2) * 0.6 * ppm;
    const s = (0.6 + hash(seed, c, 61 + i) * 0.6) * size * ppm;
    ctx.fillStyle = '#f4eadb';
    ctx.fillRect(mx - s * 0.12, sy - s * 0.55, s * 0.24, s * 0.6);
    ctx.fillStyle = '#e2493b';
    ctx.beginPath();
    ctx.ellipse(mx, sy - s * 0.55, s * 0.42, s * 0.3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy] of [
      [-0.2, -0.68],
      [0.12, -0.75],
      [0.25, -0.6],
    ]) {
      ctx.beginPath();
      ctx.arc(mx + dx * s, sy + dy * s, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSnowman(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number) {
  const balls = [0.75, 0.55, 0.4];
  let y = sy;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(80,100,140,0.35)';
  ctx.lineWidth = Math.max(1, 0.06 * ppm);
  const centers: number[] = [];
  for (const r of balls) {
    y -= r * ppm;
    centers.push(y);
    ctx.beginPath();
    ctx.arc(sx, y, r * ppm, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    y -= r * ppm * 0.75;
  }
  const hy = centers[2];
  ctx.fillStyle = '#1f1d24';
  ctx.beginPath();
  ctx.arc(sx - 0.13 * ppm, hy - 0.08 * ppm, 0.05 * ppm, 0, Math.PI * 2);
  ctx.arc(sx + 0.13 * ppm, hy - 0.08 * ppm, 0.05 * ppm, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff7a3d';
  ctx.beginPath();
  ctx.moveTo(sx, hy);
  ctx.lineTo(sx + 0.45 * ppm, hy + 0.05 * ppm);
  ctx.lineTo(sx, hy + 0.1 * ppm);
  ctx.fill();
  ctx.fillStyle = '#e2493b';
  ctx.fillRect(sx - 0.45 * ppm, centers[1] - 0.6 * ppm, 0.9 * ppm, 0.14 * ppm);
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = Math.max(1, 0.08 * ppm);
  ctx.beginPath();
  ctx.moveTo(sx + 0.5 * ppm, centers[1]);
  ctx.lineTo(sx + 1.1 * ppm, centers[1] - 0.5 * ppm);
  ctx.moveTo(sx - 0.5 * ppm, centers[1]);
  ctx.lineTo(sx - 1.0 * ppm, centers[1] - 0.3 * ppm);
  ctx.stroke();
}

function drawLantern(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, t: number) {
  const s = ppm;
  ctx.fillStyle = '#8f8a84';
  ctx.fillRect(sx - 0.15 * s, sy - 1.2 * s, 0.3 * s, 1.2 * s);
  ctx.fillRect(sx - 0.45 * s, sy - 0.2 * s, 0.9 * s, 0.2 * s);
  const glow = 0.7 + 0.3 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,200,90,${glow})`;
  ctx.fillRect(sx - 0.3 * s, sy - 1.75 * s, 0.6 * s, 0.55 * s);
  ctx.fillStyle = '#6f6a64';
  ctx.beginPath();
  ctx.moveTo(sx - 0.65 * s, sy - 1.75 * s);
  ctx.lineTo(sx, sy - 2.25 * s);
  ctx.lineTo(sx + 0.65 * s, sy - 1.75 * s);
  ctx.fill();
  const halo = ctx.createRadialGradient(sx, sy - 1.5 * s, 0, sx, sy - 1.5 * s, 1.6 * s);
  halo.addColorStop(0, `rgba(255,210,120,${0.35 * glow})`);
  halo.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sx - 1.6 * s, sy - 3.1 * s, 3.2 * s, 3.2 * s);
}

export function drawSigns(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void {
  const ppm = cam.ppm;
  const x0 = cam.wx(-80);
  const x1 = cam.wx(cam.w + 80);
  const scale = Math.max(ppm, 4);
  for (let d = Math.max(SIGN_EVERY, Math.ceil(x0 / SIGN_EVERY) * SIGN_EVERY); d <= x1; d += SIGN_EVERY) {
    if (d === world.map.goal) continue;
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
  const goal = world.map.goal;
  const gx = cam.sx(goal);
  if (gx > -40 * scale && gx < cam.w + 40 * scale)
    drawGoalGate(ctx, gx, cam.sy(world.groundY(goal)), Math.max(ppm, 2), world.map.goalName.toUpperCase());
}

function drawGoalGate(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, label: string) {
  const pagoda = label.includes('PAGODA');
  const hgt = 16 * ppm;
  const half = 7 * ppm;
  const post = 1 * ppm;
  ctx.fillStyle = pagoda ? '#c98a12' : '#d6372b';
  ctx.fillRect(sx - half - post / 2, sy - hgt, post, hgt);
  ctx.fillRect(sx + half - post / 2, sy - hgt, post, hgt);
  ctx.fillRect(sx - half - 2 * ppm, sy - hgt * 0.78, half * 2 + 4 * ppm, 0.8 * ppm);
  // Roof: one sweeping beam, or a stack of golden pagoda tiers.
  const tiers = pagoda ? 3 : 1;
  for (let i = 0; i < tiers; i++) {
    const y = sy - hgt - i * 3.2 * ppm;
    const w = half + 3.5 * ppm - i * 2.2 * ppm;
    ctx.fillStyle = pagoda ? (i % 2 ? '#ffd23d' : '#e0a020') : '#2b2b2b';
    ctx.beginPath();
    ctx.moveTo(sx - w, y - 0.2 * ppm);
    ctx.quadraticCurveTo(sx, y + 1.2 * ppm, sx + w, y - 0.2 * ppm);
    ctx.lineTo(sx + w - 0.5 * ppm, y + 1.2 * ppm);
    ctx.quadraticCurveTo(sx, y + 2.4 * ppm, sx - w + 0.5 * ppm, y + 1.2 * ppm);
    ctx.closePath();
    ctx.fill();
  }
  if (pagoda) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(sx, sy - hgt - tiers * 3.2 * ppm + 0.6 * ppm, 0.8 * ppm, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe28a';
  ctx.font = `800 ${Math.round(1.3 * ppm)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, sx, sy - hgt * 0.88);
}

/** A big coil spring (and a bamboo arm for the catapult) under the lip. */
function drawSpring(ctx: CanvasRenderingContext2D, cam: Camera, ramp: Ramp, world: World) {
  const lip = ramp.lip;
  const g = world.groundY(lip.x - 1);
  const x = cam.sx(lip.x - 1.2);
  const top = cam.sy(lip.y - 0.3);
  const bottom = cam.sy(g);
  const w = Math.max(6, 1.4 * cam.ppm);
  const coils = 6;
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = Math.max(2, 0.18 * cam.ppm);
  ctx.beginPath();
  for (let i = 0; i <= coils * 2; i++) {
    const y = bottom + ((top - bottom) * i) / (coils * 2);
    ctx.lineTo(x + (i % 2 ? w / 2 : -w / 2), y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#7d8794';
  ctx.lineWidth = Math.max(1, 0.06 * cam.ppm);
  ctx.stroke();
  if (ramp.item.style === 'catapult') {
    // Bent bamboo arm along the kicker.
    ctx.strokeStyle = '#7cbf4a';
    ctx.lineWidth = Math.max(3, 0.35 * cam.ppm);
    ctx.beginPath();
    ctx.moveTo(cam.sx(lip.x - 7), cam.sy(world.groundY(lip.x - 7) + 0.3));
    ctx.quadraticCurveTo(cam.sx(lip.x - 2), cam.sy(lip.y - 1.5), cam.sx(lip.x), cam.sy(lip.y - 0.2));
    ctx.stroke();
  }
}

export function drawRamp(ctx: CanvasRenderingContext2D, cam: Camera, ramp: Ramp, world: World): void {
  const ppm = cam.ppm;
  const pts = ramp.points;
  if (cam.sx(pts[0].x) > cam.w + 50 || cam.sx(ramp.lip.x) < -50) return;
  const plank = Math.max(6, 0.9 * ppm);

  // Posts down to the hillside, with cross-bracing where the kicker lifts off.
  ctx.strokeStyle = '#6e4a2a';
  ctx.lineWidth = Math.max(1.5, 0.2 * ppm);
  const every = Math.max(1, Math.round(3 / ramp.step));
  let prev: { x: number; y: number; g: number } | null = null;
  ctx.beginPath();
  for (let i = pts.length - 1; i >= 0; i -= every) {
    const p = pts[i];
    const g = world.groundY(p.x);
    const sx = cam.sx(p.x);
    ctx.moveTo(sx, cam.sy(p.y));
    ctx.lineTo(sx, cam.sy(g) + 2);
    if (prev && p.y - g > 1.4 && prev.y - prev.g > 1.4) {
      ctx.moveTo(cam.sx(prev.x), cam.sy(prev.y - 0.4));
      ctx.lineTo(sx, cam.sy(g + (p.y - g) * 0.3));
      ctx.moveTo(cam.sx(prev.x), cam.sy(prev.g + (prev.y - prev.g) * 0.3));
      ctx.lineTo(sx, cam.sy(p.y - 0.4));
    }
    prev = { x: p.x, y: p.y, g };
  }
  ctx.stroke();

  // Deck: wooden rails with a snowy running surface.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(cam.sx(p.x), cam.sy(p.y)) : ctx.moveTo(cam.sx(p.x), cam.sy(p.y))));
  const icy = ramp.item.style === 'ice';
  ctx.strokeStyle = icy ? '#4a7fa8' : '#5e3b1f';
  ctx.lineWidth = plank + 3;
  ctx.stroke();
  ctx.strokeStyle = icy ? '#9fd8f5' : '#a06a3c';
  ctx.lineWidth = plank;
  ctx.stroke();
  ctx.strokeStyle = icy ? '#f2fbff' : '#eef6ff';
  ctx.lineWidth = Math.max(2, plank * 0.45);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (ramp.item.kick) drawSpring(ctx, cam, ramp, world);

  // Start gate flags at the top and a striped marker on the lip.
  const flag = (x: number, y: number, color: string) => {
    const fx = cam.sx(x);
    const fy = cam.sy(y);
    const pole = 4 * ppm;
    ctx.fillStyle = '#5a3b20';
    ctx.fillRect(fx - 1, fy - pole, Math.max(2, 0.12 * ppm), pole);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(fx, fy - pole);
    ctx.lineTo(fx - 1.8 * ppm, fy - pole + 0.6 * ppm);
    ctx.lineTo(fx, fy - pole + 1.2 * ppm);
    ctx.fill();
  };
  flag(pts[0].x - 0.6, pts[0].y, '#e2493b');
  flag(ramp.lip.x + 0.4, world.groundY(ramp.lip.x + 0.4), '#2f7de1');
}

/** A cluster of glowing crystal shards. */
function drawCrystals(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number, time: number) {
  const n = 2 + Math.floor(hash(seed, c, 90) * 4);
  const hue = hash(seed, c, 91) < 0.5 ? [180, 140, 255] : [120, 220, 255];
  const pulse = 0.7 + 0.3 * Math.sin(time * 2 + c);
  const glow = ctx.createRadialGradient(sx, sy - ppm, 0, sx, sy - ppm, 3 * ppm * size);
  glow.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${0.3 * pulse})`);
  glow.addColorStop(1, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 3 * ppm * size, sy - 4 * ppm * size, 6 * ppm * size, 4 * ppm * size);
  for (let i = 0; i < n; i++) {
    const h = (1.2 + hash(seed, c, 92 + i) * 2.4) * size * ppm;
    const w = (0.25 + hash(seed, c, 100 + i) * 0.2) * size * ppm;
    const x = sx + (i - (n - 1) / 2) * 0.55 * ppm;
    const tilt = (hash(seed, c, 110 + i) - 0.5) * 0.8;
    ctx.save();
    ctx.translate(x, sy + 0.2 * ppm);
    ctx.rotate(tilt);
    ctx.fillStyle = `rgb(${hue[0] * 0.75},${hue[1] * 0.75},${hue[2] * 0.85})`;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w, -h * 0.75);
    ctx.lineTo(0, -h);
    ctx.lineTo(w, -h * 0.75);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.1);
    ctx.lineTo(-w * 0.3, -h * 0.72);
    ctx.lineTo(0, -h * 0.92);
    ctx.lineTo(0, -h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Hexagonal basalt columns of different heights. */
function drawBasalt(ctx: CanvasRenderingContext2D, sx: number, sy: number, ppm: number, size: number, c: number, seed: number) {
  const n = 2 + Math.floor(hash(seed, c, 120) * 4);
  const w = 0.7 * ppm * size;
  for (let i = 0; i < n; i++) {
    const h = (1 + hash(seed, c, 121 + i) * 3) * ppm * size;
    const x = sx + (i - n / 2) * w;
    ctx.fillStyle = i % 2 ? '#2e2a30' : '#3a353c';
    ctx.fillRect(x, sy - h, w - 1, h + 2);
    ctx.fillStyle = '#4c4650';
    ctx.fillRect(x, sy - h, w - 1, Math.max(1, 0.18 * ppm));
  }
}
