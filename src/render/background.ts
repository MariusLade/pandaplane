import { clamp, hexToRgb, invLerp, mixRgb, rgb, shade, type RGB } from '../core/math';
import { fbm1, hash, mulberry32 } from '../core/rng';
import type { World } from '../game/world';
import type { Camera } from './camera';

const SPACE_TOP = hexToRgb('#03041a');
const SPACE_BOTTOM = hexToRgb('#1d2f6b');
const PARADISE_BOTTOM = hexToRgb('#ffe2a8');

export interface SkyColors {
  top: RGB;
  bottom: RGB;
  /** 0..1, how much we are in space. */
  space: number;
}

const STORM_TOP = hexToRgb('#1c2233');
const STORM_BOTTOM = hexToRgb('#5d6b7d');

/** 0..1: how rainy and dark the weather is at x (storm maps only). */
export function storminess(world: World, x: number): number {
  if (!world.map.sky.storm) return 0;
  const b = world.biomeAt(x);
  return (b.a.rain ?? 0) * (1 - b.t) + (b.b.rain ?? 0) * b.t;
}

export function skyColors(world: World, altitude: number, x: number): SkyColors {
  const sky = world.map.sky;
  const hi = invLerp(200, 1800, altitude);
  const sp = invLerp(1500, 4000, altitude);
  let top = mixRgb(mixRgb(sky.lowTop, sky.highTop, hi), SPACE_TOP, sp);
  let bottom = mixRgb(mixRgb(sky.lowBottom, sky.highBottom, hi), SPACE_BOTTOM, sp);
  // Storm clouds darken the sky below them; climb above and it clears.
  const storm = storminess(world, x) * 0.75 * (1 - invLerp(300, 1200, altitude));
  if (storm > 0) {
    top = mixRgb(top, STORM_TOP, storm);
    bottom = mixRgb(bottom, STORM_BOTTOM, storm);
  }
  // The goal area glows warmly.
  const goalName = world.map.goalName;
  const b = world.biomeAt(x);
  const paradise = (b.a.name === goalName ? 1 : 0) * (1 - b.t) + (b.b.name === goalName ? 1 : 0) * b.t;
  if (paradise > 0) {
    bottom = mixRgb(bottom, PARADISE_BOTTOM, paradise * 0.6 * (1 - sp));
    top = mixRgb(top, hexToRgb('#69a8ee'), paradise * 0.3 * (1 - sp));
  }
  return { top, bottom, space: sp };
}

interface CloudShape {
  puffs: { dx: number; dy: number; r: number }[];
  w: number;
}

const cloudCache = new Map<number, CloudShape>();

function cloudShape(key: number): CloudShape {
  let c = cloudCache.get(key);
  if (c) return c;
  const r = mulberry32(key);
  const n = 4 + Math.floor(r() * 5);
  const puffs: CloudShape['puffs'] = [];
  let w = 0;
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * (0.55 + r() * 0.25);
    const rad = 0.5 + r() * 0.55 - Math.abs(dx) * 0.08;
    puffs.push({ dx, dy: -r() * 0.35 * rad, r: rad });
    w = Math.max(w, Math.abs(dx) + rad);
  }
  c = { puffs, w };
  if (cloudCache.size > 500) cloudCache.clear();
  cloudCache.set(key, c);
  return c;
}

function drawCloud(ctx: CanvasRenderingContext2D, shape: CloudShape, x: number, y: number, scale: number, color: string, shadow: string) {
  ctx.fillStyle = shadow;
  ctx.beginPath();
  for (const p of shape.puffs) {
    ctx.moveTo(x + p.dx * scale + p.r * scale, y + p.dy * scale + scale * 0.12);
    ctx.arc(x + p.dx * scale, y + p.dy * scale + scale * 0.12, p.r * scale, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const p of shape.puffs) {
    ctx.moveTo(x + p.dx * scale + p.r * scale, y + p.dy * scale);
    ctx.arc(x + p.dx * scale, y + p.dy * scale, p.r * scale, 0, Math.PI * 2);
  }
  ctx.fill();
}

export class Background {
  constructor(private seed: number) {}

  setSeed(seed: number): void {
    this.seed = seed;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number, world: World): void {
    const { w, h } = cam;
    const sky = skyColors(world, cam.y, cam.x);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgb(sky.top));
    g.addColorStop(1, rgb(sky.bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (sky.space > 0.01) this.drawStars(ctx, cam, sky.space, time);
    const storm = storminess(world, cam.x) * (1 - invLerp(300, 1200, cam.y));
    this.drawSun(ctx, cam, sky, world, storm);
    if (world.map.sky.volcano) this.drawVolcano(ctx, cam, sky, time);
    this.drawFarClouds(ctx, cam, sky, storm);
    if (storm > 0.25) this.drawSheetLightning(ctx, cam, time, storm);
    this.drawMountains(ctx, cam, sky, world);
  }

  private drawStars(ctx: CanvasRenderingContext2D, cam: Camera, alpha: number, time: number) {
    const r = mulberry32(this.seed ^ 0x5157);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 160; i++) {
      const x = (((r() * cam.w * 1.3 - cam.x * 0.02) % cam.w) + cam.w) % cam.w;
      const y = r() * cam.h;
      const s = r() * 1.6 + 0.4;
      const tw = 0.6 + 0.4 * Math.sin(time * (1 + r() * 3) + i);
      ctx.globalAlpha = alpha * tw;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  /** Distant flickers inside the clouds every so often. */
  private drawSheetLightning(ctx: CanvasRenderingContext2D, cam: Camera, time: number, storm: number) {
    const slot = Math.floor(time * 3);
    if (hash(this.seed, slot, 977) > 0.06 * storm) return;
    const phase = time * 3 - slot;
    const a = Math.max(0, 1 - phase * 2.5) * 0.35 * storm;
    const x = cam.w * (0.15 + hash(this.seed, slot, 978) * 0.7);
    const y = cam.h * (0.1 + hash(this.seed, slot, 979) * 0.25);
    const g = ctx.createRadialGradient(x, y, 0, x, y, cam.w * 0.35);
    g.addColorStop(0, `rgba(230,235,255,${a})`);
    g.addColorStop(1, 'rgba(230,235,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }

  private drawSun(ctx: CanvasRenderingContext2D, cam: Camera, sky: SkyColors, world: World, storm = 0) {
    ctx.globalAlpha = 1 - storm * 0.85;
    const style = world.map.sky;
    const x = cam.w * 0.8;
    const y = cam.h * 0.2 + clamp(-cam.y * 0.02, -40, 40);
    const r = Math.min(cam.w, cam.h) * 0.06;
    const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    glow.addColorStop(0, `rgba(${style.sunGlow},${0.55 * (1 - sky.space * 0.6)})`);
    glow.addColorStop(1, `rgba(${style.sunGlow},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.fillStyle = style.sun;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** A distant smoking volcano behind the mountain ranges. */
  private drawVolcano(ctx: CanvasRenderingContext2D, cam: Camera, sky: SkyColors, time: number) {
    const { w, h } = cam;
    const sink = clamp((cam.y - 40) * 0.08, -h * 0.1, h * 1.5);
    const cx = w * 0.62 - ((cam.x * 0.012) % (w * 2.4)) + w * 0.3;
    const base = h * 0.64 + sink;
    const peak = base - Math.min(w, h) * 0.42;
    const half = Math.min(w, h) * 0.75;
    if (peak > h) return;
    const color = mixRgb([70, 40, 60], sky.bottom, 0.45);
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    ctx.moveTo(cx - half, base + 40);
    ctx.quadraticCurveTo(cx - half * 0.3, base - (base - peak) * 0.55, cx - half * 0.12, peak);
    ctx.lineTo(cx + half * 0.12, peak);
    ctx.quadraticCurveTo(cx + half * 0.3, base - (base - peak) * 0.55, cx + half, base + 40);
    ctx.closePath();
    ctx.fill();
    // Lava glow in the crater and down one flank.
    const glow = ctx.createRadialGradient(cx, peak, 2, cx, peak, half * 0.3);
    glow.addColorStop(0, 'rgba(255,140,60,0.75)');
    glow.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - half * 0.3, peak - half * 0.3, half * 0.6, half * 0.6);
    ctx.strokeStyle = 'rgba(255,120,50,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + half * 0.05, peak + 2);
    ctx.quadraticCurveTo(cx + half * 0.12, peak + (base - peak) * 0.4, cx + half * 0.2, base - (base - peak) * 0.25);
    ctx.stroke();
    // Smoke plume drifting off to the right.
    for (let i = 0; i < 9; i++) {
      const t = (time * 0.05 + i / 9) % 1;
      const px = cx + t * half * 0.9 + Math.sin(t * 6 + i) * 8;
      const py = peak - t * (base - peak) * 0.9;
      const pr = half * (0.06 + t * 0.2);
      ctx.fillStyle = rgb(mixRgb([90, 80, 95], sky.top, 0.3), 0.35 * (1 - t) * (1 - sky.space));
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFarClouds(ctx: CanvasRenderingContext2D, cam: Camera, sky: SkyColors, storm = 0) {
    const p = 0.08;
    const cell = 260;
    const scale = Math.min(cam.w, cam.h) * 0.05;
    const offset = cam.x * p * 4;
    const first = Math.floor((offset - scale * 4) / cell);
    const last = Math.floor((offset + cam.w + scale * 4) / cell);
    const white = mixRgb([255, 255, 255], [96, 104, 120], storm * 0.8);
    const color = rgb(mixRgb(white, sky.bottom, 0.35), 0.85 * (1 - sky.space));
    const shadow = rgb(mixRgb(shade(sky.bottom, -0.08 - storm * 0.2), sky.top, 0.2), (0.5 + storm * 0.3) * (1 - sky.space));
    for (let i = first; i <= last; i++) {
      if (hash(this.seed, i, 41) > 0.6 + storm * 0.35) continue;
      const x = i * cell - offset + hash(this.seed, i, 42) * cell * 0.5;
      const y = cam.h * (0.12 + hash(this.seed, i, 43) * 0.3) + cam.y * 0.05;
      const s = scale * (0.7 + hash(this.seed, i, 44) * 0.8);
      drawCloud(ctx, cloudShape(Math.floor(hash(this.seed, i, 45) * 1e9)), x, y, s, color, shadow);
    }
  }

  private drawMountains(ctx: CanvasRenderingContext2D, cam: Camera, sky: SkyColors, world: World) {
    const b = world.biomeAt(cam.x);
    const hills = mixRgb(b.a.hills, b.b.hills, b.t);
    const snowy = (b.a.snowy ? 1 - b.t : 0) + (b.b.snowy ? b.t : 0);
    const layers = [
      { p: 0.03, amp: 0.3, base: 0.62, haze: 0.62, freq: 1 / 220, oct: 5, sink: 0.12 },
      { p: 0.08, amp: 0.2, base: 0.7, haze: 0.42, freq: 1 / 160, oct: 4, sink: 0.25 },
      { p: 0.18, amp: 0.13, base: 0.78, haze: 0.22, freq: 1 / 120, oct: 3, sink: 0.45 },
    ];
    const { w, h } = cam;
    const unit = Math.min(w, h);
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      // Mountains sink below the horizon as the camera climbs.
      const sink = clamp((cam.y - 40) * L.sink * 1.2, -h * 0.1, h * 1.5);
      const base = h * L.base + sink;
      if (base - unit * L.amp * 1.4 > h) continue;
      const color = mixRgb(shade(hills, -0.1 * li), sky.bottom, L.haze);
      const step = 6;
      const offset = cam.x * L.p * 8;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const tops: number[] = [];
      for (let sx = 0; sx <= w + step; sx += step) {
        const u = (sx + offset) * L.freq;
        const n = fbm1(this.seed + li * 31, u, L.oct, 2, li === 0 ? 0.55 : 0.5);
        const peak = Math.abs(fbm1(this.seed + li * 31 + 5, u * 0.5, 2));
        const y = base - (n * 0.6 + peak * 0.9) * unit * L.amp;
        tops.push(y);
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(w + step, h);
      ctx.closePath();
      ctx.fillStyle = rgb(color);
      ctx.fill();

      // Snow caps on the far ranges in the snowy biome.
      if (li < 2 && snowy > 0.05) {
        const capLine = base - unit * L.amp * 0.55;
        ctx.fillStyle = rgb(mixRgb([255, 255, 255], sky.bottom, L.haze * 0.6), snowy * 0.9);
        ctx.beginPath();
        let open = false;
        for (let i = 0; i < tops.length; i++) {
          const sx = i * step;
          const y = tops[i];
          if (y < capLine) {
            if (!open) {
              ctx.moveTo(sx, capLine);
              open = true;
            }
            ctx.lineTo(sx, y);
          } else if (open) {
            ctx.lineTo(sx, capLine);
            ctx.closePath();
            open = false;
          }
        }
        if (open) ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** World-space clouds the panda flies past. Drawn after terrain, before the panda. */
  drawNearClouds(ctx: CanvasRenderingContext2D, cam: Camera, world: World) {
    const cell = 150;
    const x0 = cam.wx(-200);
    const x1 = cam.wx(cam.w + 200);
    const first = Math.floor(x0 / cell);
    const last = Math.floor(x1 / cell);
    if (last - first > 400) return;
    const sky = skyColors(world, cam.y, cam.x);
    const storm = storminess(world, cam.x);
    const puff = mixRgb([255, 255, 255], [120, 128, 142], storm * 0.75);
    for (let i = first; i <= last; i++) {
      for (let k = 0; k < 2; k++) {
        if (hash(this.seed, i, 61 + k) > 0.45) continue;
        const alt = 35 + Math.pow(hash(this.seed, i, 71 + k), 1.6) * 1600;
        const wx = i * cell + hash(this.seed, i, 81 + k) * cell;
        const size = 8 + hash(this.seed, i, 91 + k) * 22;
        const sx = cam.sx(wx);
        const sy = cam.sy(alt);
        const s = size * cam.ppm;
        if (sx + s * 4 < 0 || sx - s * 4 > cam.w || sy + s * 2 < 0 || sy - s * 2 > cam.h) continue;
        const shape = cloudShape(Math.floor(hash(this.seed, i, 101 + k) * 1e9));
        const thin = invLerp(1800, 3200, alt);
        drawCloud(
          ctx,
          shape,
          sx,
          sy,
          s,
          rgb(puff, 0.88 * (1 - thin)),
          rgb(mixRgb(sky.bottom, [120, 140, 170], 0.3), 0.45 * (1 - thin)),
        );
      }
    }
  }
}
