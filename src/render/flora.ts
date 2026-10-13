import { hexToRgb, mixRgb, rgb, shade, type RGB } from '../core/math';
import { mulberry32 } from '../core/rng';

/**
 * Procedural trees. Each tree is grown from a seed (recursive branching for
 * broadleaf trees, layered tiers for conifers, culms for bamboo), drawn once
 * into an offscreen sprite and cached per size bucket, so a whole forest costs
 * a handful of drawImage calls per frame.
 */
export type TreeKind =
  | 'pine'
  | 'snowpine'
  | 'oak'
  | 'birch'
  | 'cherry'
  | 'bamboo'
  | 'dead'
  | 'bush'
  | 'cactus'
  | 'charred'
  | 'palm'
  | 'shrub';

/** Natural height of each kind in metres (before per-tree variation). */
export const TREE_HEIGHT: Record<TreeKind, number> = {
  pine: 11,
  snowpine: 10,
  oak: 9,
  birch: 11,
  cherry: 8,
  bamboo: 13,
  dead: 7,
  bush: 1.8,
  cactus: 5,
  charred: 7,
  palm: 9,
  shrub: 1.4,
};

export const VARIANTS = 12;

interface Sprite {
  canvas: HTMLCanvasElement;
  /** Nominal tree height (CSS px) the sprite was grown at. */
  h: number;
  /** Canvas size in CSS px. */
  cw: number;
  ch: number;
  /** Trunk base position inside the canvas, CSS px. */
  ax: number;
  ay: number;
}

/** Collects the extent of everything a grower draws. */
class Bounds {
  minX = Infinity;
  maxX = -Infinity;
  minY = Infinity;
  maxY = -Infinity;
  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }
}

/** A stand-in 2D context that draws nothing and just measures, for sizing sprites. */
function measuringContext(b: Bounds): CanvasRenderingContext2D {
  const clips: boolean[] = [false];
  const clipped = () => clips[clips.length - 1];
  const box = (x: number, y: number, w: number, h: number) => {
    b.add(x, y);
    b.add(x + w, y + h);
  };
  const noop = () => {};
  const ctx = {
    moveTo: (x: number, y: number) => b.add(x, y),
    lineTo: (x: number, y: number) => b.add(x, y),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      b.add(cx, cy);
      b.add(x, y);
    },
    bezierCurveTo: (ax: number, ay: number, bx: number, by: number, x: number, y: number) => {
      b.add(ax, ay);
      b.add(bx, by);
      b.add(x, y);
    },
    arc: (x: number, y: number, r: number) => box(x - r, y - r, 2 * r, 2 * r),
    ellipse: (x: number, y: number, rx: number, ry: number) => {
      const m = Math.max(rx, ry);
      box(x - m, y - m, 2 * m, 2 * m);
    },
    rect: box,
    fillRect: (x: number, y: number, w: number, h: number) => {
      if (!clipped()) box(x, y, w, h);
    },
    save: () => clips.push(clipped()),
    restore: () => {
      if (clips.length > 1) clips.pop();
    },
    clip: () => {
      clips[clips.length - 1] = true;
    },
    beginPath: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

const cache = new Map<string, Sprite>();
const MAX_SPRITES = 360;

/** Size buckets ~19% apart: small enough that rescaling a sprite is invisible. */
const bucket = (px: number) => Math.max(0, Math.round(Math.log2(px) * 4));
const bucketSize = (b: number) => Math.pow(2, b / 4);

export function treeSprite(kind: TreeKind, variant: number, heightPx: number, dpr: number): Sprite {
  const b = bucket(heightPx);
  const key = `${kind}|${variant}|${b}|${dpr}`;
  let s = cache.get(key);
  if (s) {
    // Refresh LRU position.
    cache.delete(key);
    cache.set(key, s);
    return s;
  }
  const h = bucketSize(b);
  const seed = variant * 7919 + kind.length * 131;
  // Grow once on a measuring context to size the canvas exactly, then for real
  // with the same random sequence.
  const bounds = new Bounds();
  GROWERS[kind](measuringContext(bounds), mulberry32(seed), h);
  const pad = 2 / h;
  const ax = (-bounds.minX + pad) * h;
  const ay = (bounds.maxY + pad) * h;
  const cw = (bounds.maxX - bounds.minX + 2 * pad) * h;
  const ch = (bounds.maxY - Math.min(0, bounds.minY) + 2 * pad) * h;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(cw * dpr));
  canvas.height = Math.max(1, Math.ceil(ch * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  // Origin at the base of the trunk, +y up, in "tree units" (1 = nominal height).
  ctx.translate(ax, ay);
  ctx.scale(h, -h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  GROWERS[kind](ctx, mulberry32(seed), h);
  s = { canvas, h, cw, ch, ax, ay };
  cache.set(key, s);
  if (cache.size > MAX_SPRITES) {
    let n = 60;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (--n <= 0) break;
    }
  }
  return s;
}

/** Draw a tree with its base at (x, y) in CSS pixels, swaying gently. */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  kind: TreeKind,
  variant: number,
  x: number,
  y: number,
  heightPx: number,
  dpr: number,
  sway: number,
): void {
  if (heightPx < 3) return;
  const s = treeSprite(kind, variant, heightPx, dpr);
  const k = heightPx / s.h;
  if (Math.abs(sway) > 0.002) {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, sway, 1, 0, 0);
    ctx.drawImage(s.canvas, -s.ax * k, -s.ay * k, s.cw * k, s.ch * k);
    ctx.restore();
  } else {
    ctx.drawImage(s.canvas, x - s.ax * k, y - s.ay * k, s.cw * k, s.ch * k);
  }
}

type Rand = () => number;
type Grower = (ctx: CanvasRenderingContext2D, r: Rand, px: number) => void;

const jitter = (base: RGB, r: Rand, amount: number): RGB => shade(base, (r() - 0.5) * amount);

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) {
  ctx.moveTo(x + rad, y);
  ctx.arc(x, y, rad, 0, Math.PI * 2);
}

/** Tapered trunk/branch as a filled quad (looks better than a stroked line). */
function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
}

// ---------------------------------------------------------------- conifers

function conifer(ctx: CanvasRenderingContext2D, r: Rand, px: number, snowy: boolean) {
  const green = jitter(snowy ? hexToRgb('#2f5e4e') : hexToRgb('#2f6b3c'), r, 0.25);
  const dark = shade(green, -0.35);
  const light = shade(green, 0.18);
  const halfW = 0.27 + r() * 0.06;
  const tiers = 5 + Math.floor(r() * 4);
  const lean = (r() - 0.5) * 0.03;
  // Trunk.
  ctx.fillStyle = '#5b3d26';
  ctx.beginPath();
  limb(ctx, 0, 0, lean, 0.35, 0.035, 0.025);
  ctx.fill();
  const tiersGeo: { y: number; top: number; w: number }[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y = 0.14 + t * 0.72;
    const w = halfW * (1 - t * 0.82) * (0.9 + r() * 0.2);
    tiersGeo.push({ y, top: y + 0.2 + (1 - t) * 0.06, w });
  }
  for (const pass of [0, 1]) {
    for (const { y, top, w } of tiersGeo) {
      const cx = lean * (y / 0.35);
      const teeth = 3 + Math.floor(r() * 3);
      const droop = 0.03 + r() * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.quadraticCurveTo(cx - w * 0.45, y + (top - y) * 0.45, cx - w, y - droop);
      // Jagged lower edge.
      for (let k = 1; k <= teeth; k++) {
        const fx = cx - w + (2 * w * k) / teeth;
        const mid = cx - w + (2 * w * (k - 0.5)) / teeth;
        ctx.lineTo(mid, y + 0.02 + r() * 0.02);
        ctx.lineTo(fx, y - droop * (Math.abs(fx - cx) / w) - r() * 0.012);
      }
      ctx.quadraticCurveTo(cx + w * 0.45, y + (top - y) * 0.45, cx, top);
      ctx.closePath();
      if (pass === 0) {
        ctx.fillStyle = rgb(green);
        ctx.fill();
      } else {
        // Shade the left half for volume, highlight the sunny edge.
        ctx.save();
        ctx.clip();
        ctx.fillStyle = rgb(dark, 0.45);
        ctx.fillRect(cx - w - 0.1, y - 0.1, w + 0.1, top - y + 0.2);
        ctx.fillStyle = rgb(light, 0.5);
        ctx.fillRect(cx + w * 0.45, y - 0.1, w, top - y + 0.2);
        ctx.restore();
        if (snowy) {
          ctx.fillStyle = '#f7fbff';
          ctx.beginPath();
          ctx.moveTo(cx, top + 0.005);
          ctx.quadraticCurveTo(cx - w * 0.35, y + (top - y) * 0.55, cx - w * 0.75, y + (top - y) * 0.2);
          ctx.quadraticCurveTo(cx - w * 0.3, y + (top - y) * 0.45, cx, y + (top - y) * 0.62);
          ctx.quadraticCurveTo(cx + w * 0.35, y + (top - y) * 0.45, cx + w * 0.7, y + (top - y) * 0.22);
          ctx.quadraticCurveTo(cx + w * 0.35, y + (top - y) * 0.55, cx, top + 0.005);
          ctx.fill();
        }
      }
    }
  }
  if (px > 40 && !snowy) {
    // A few pine cones.
    ctx.fillStyle = '#7a4e2b';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) blob(ctx, (r() - 0.5) * halfW, 0.25 + r() * 0.4, 0.012);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- broadleaf

interface Tip {
  x: number;
  y: number;
  /** Foliage size: 1 at branch tips, smaller on inner forks. */
  s?: number;
}

/** Recursive branching. Collects branch tips for foliage. */
function branch(
  ctx: CanvasRenderingContext2D,
  r: Rand,
  x: number,
  y: number,
  angle: number,
  len: number,
  width: number,
  depth: number,
  spread: number,
  tips: Tip[],
) {
  const bend = (r() - 0.5) * 0.35;
  const x1 = x + Math.cos(angle + bend * 0.5) * len;
  const y1 = y + Math.sin(angle + bend * 0.5) * len;
  limb(ctx, x, y, x1, y1, width, width * 0.68);
  if (depth === 0) {
    tips.push({ x: x1, y: y1, s: 1 });
    return;
  }
  // Inner forks carry foliage too, so canopies read as full crowns.
  if (depth <= 2) tips.push({ x: x1, y: y1, s: 0.85 });
  const kids = depth > 2 ? 2 + (r() < 0.4 ? 1 : 0) : 2;
  for (let i = 0; i < kids; i++) {
    const side = kids === 2 ? (i === 0 ? -1 : 1) : i - 1;
    const a = angle + bend + side * spread * (0.6 + r() * 0.6);
    branch(ctx, r, x1, y1, a, len * (0.66 + r() * 0.16), width * 0.66, depth - 1, spread, tips);
  }
}

interface Canopy {
  leaf: RGB;
  bark: string;
  trunkLen: number;
  spread: number;
  depth: number;
  puff: number;
  blossom?: RGB;
  birch?: boolean;
}

function broadleaf(ctx: CanvasRenderingContext2D, r: Rand, px: number, c: Canopy) {
  const tips: Tip[] = [];
  ctx.fillStyle = c.bark;
  ctx.beginPath();
  const depth = px < 30 ? Math.max(2, c.depth - 2) : px < 70 ? c.depth - 1 : c.depth;
  branch(ctx, r, 0, 0, Math.PI / 2 + (r() - 0.5) * 0.15, c.trunkLen, c.birch ? 0.028 : 0.05, depth, c.spread, tips);
  ctx.fill();
  if (c.birch && px > 25) {
    // Birch bark dashes.
    ctx.fillStyle = '#2b2b2b';
    for (let i = 0; i < 7; i++) {
      const y = 0.04 + r() * c.trunkLen * 0.95;
      ctx.fillRect(-0.02 + (r() - 0.5) * 0.01, y, 0.02 + r() * 0.015, 0.008);
    }
  }
  const rad = c.puff * (depth < c.depth ? 1.35 : 1);
  const base = c.leaf;
  const layers: [RGB, number, number, number][] = [
    [shade(base, -0.3), 1.05, -0.012, -0.018],
    [base, 0.9, 0, 0],
    [shade(base, 0.2), 0.55, 0.014, 0.02],
  ];
  for (const [color, scale, ox, oy] of layers) {
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    for (const t of tips) {
      const jr = rad * scale * (t.s ?? 1) * (0.75 + ((((t.x * 97 + t.y * 31) % 1) + 1) % 1) * 0.5);
      blob(ctx, t.x + ox, t.y + oy, jr);
    }
    ctx.fill();
  }
  if (c.blossom) {
    const petals = [c.blossom, shade(c.blossom, 0.35), shade(c.blossom, -0.12)];
    for (const t of tips) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = rgb(petals[k]);
        ctx.beginPath();
        blob(ctx, t.x + (r() - 0.5) * rad * 1.6, t.y + (r() - 0.5) * rad * 1.4, rad * (0.16 + r() * 0.12));
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- others

function bamboo(ctx: CanvasRenderingContext2D, r: Rand, px: number) {
  const culms = 3 + Math.floor(r() * 4);
  const leaf = hexToRgb('#4f9a3a');
  for (let c = 0; c < culms; c++) {
    const x0 = (r() - 0.5) * 0.4;
    const top = 0.6 + r() * 0.4;
    const lean = (r() - 0.5) * 0.12;
    const w = 0.018 + r() * 0.01;
    const green = mixRgb(hexToRgb('#6cb043'), hexToRgb('#9bcf5a'), r());
    const segs = Math.max(3, Math.round(top / 0.09));
    for (let s = 0; s < segs; s++) {
      const y0 = (s / segs) * top;
      const y1 = ((s + 1) / segs) * top - 0.006;
      const xa = x0 + lean * (y0 / top) * (y0 / top);
      const xb = x0 + lean * (y1 / top) * (y1 / top);
      ctx.fillStyle = rgb(s % 2 ? green : shade(green, -0.08));
      ctx.beginPath();
      limb(ctx, xa, y0, xb, y1, w, w * 0.95);
      ctx.fill();
      if (px > 30) {
        ctx.fillStyle = rgb(shade(green, -0.3));
        ctx.fillRect(xb - w * 1.2, y1 - 0.004, w * 2.4, 0.008);
      }
      // Leaf sprays on the upper half.
      if (s > segs * 0.45 && r() < 0.6) {
        const dir = r() < 0.5 ? -1 : 1;
        ctx.fillStyle = rgb(jitter(leaf, r, 0.3));
        for (let k = 0; k < 3; k++) {
          const a = (dir > 0 ? 0.25 : Math.PI - 0.25) + (dir * (k - 1) * 0.35) - 0.3;
          const lx = xb + Math.cos(a) * 0.09;
          const ly = y1 + Math.sin(a) * 0.09 - 0.02;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 0.08, 0.016, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

function deadTree(ctx: CanvasRenderingContext2D, r: Rand) {
  const tips: Tip[] = [];
  ctx.fillStyle = '#6d6259';
  ctx.beginPath();
  branch(ctx, r, 0, 0, Math.PI / 2 + (r() - 0.5) * 0.3, 0.32, 0.045, 4, 0.55, tips);
  ctx.fill();
  // Snow resting on the upper sides of branches.
  ctx.fillStyle = '#f7fbff';
  ctx.beginPath();
  for (const t of tips) blob(ctx, t.x, t.y + 0.008, 0.018);
  ctx.fill();
}

function bush(ctx: CanvasRenderingContext2D, r: Rand) {
  const base = jitter(hexToRgb('#4f8f3e'), r, 0.3);
  const berries = r() < 0.4;
  const puffs: Tip[] = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) puffs.push({ x: (r() - 0.5) * 1.3, y: 0.25 + r() * 0.35 });
  for (const [color, s, oy] of [
    [shade(base, -0.3), 1, -0.04],
    [base, 0.85, 0],
    [shade(base, 0.22), 0.45, 0.08],
  ] as const) {
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    for (const p of puffs) blob(ctx, p.x, p.y + oy, 0.32 * s);
    ctx.fill();
  }
  if (berries) {
    ctx.fillStyle = '#e2493b';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) blob(ctx, (r() - 0.5) * 1.2, 0.3 + r() * 0.4, 0.04);
    ctx.fill();
  }
}

/** Saguaro: a ribbed trunk with upturned arms. */
function cactus(ctx: CanvasRenderingContext2D, r: Rand) {
  const green = jitter(hexToRgb('#4f8f4a'), r, 0.2);
  const w = 0.11;
  const top = 0.85 + r() * 0.15;
  const arms: { y: number; side: number; len: number; up: number }[] = [];
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) arms.push({ y: 0.3 + r() * 0.3, side: i % 2 ? 1 : -1, len: 0.14 + r() * 0.08, up: 0.18 + r() * 0.2 });
  const capsule = (x0: number, y0: number, x1: number, y1: number, rad: number) => {
    ctx.beginPath();
    limb(ctx, x0, y0, x1, y1, rad, rad);
    ctx.fill();
    ctx.beginPath();
    blob(ctx, x1, y1, rad);
    ctx.fill();
  };
  for (const [color, dw] of [
    [shade(green, -0.25), 0],
    [green, -0.025],
  ] as const) {
    ctx.fillStyle = rgb(color);
    capsule(0, 0, 0, top - w, w + dw);
    for (const a of arms) {
      const ax = a.side * (w + a.len);
      capsule(0, a.y, ax, a.y, w * 0.75 + dw);
      capsule(ax, a.y, ax, a.y + a.up, w * 0.75 + dw);
    }
  }
  // Ribs and a flower on top.
  ctx.strokeStyle = rgb(shade(green, 0.2));
  ctx.lineWidth = 0.01;
  ctx.beginPath();
  for (const dx of [-0.04, 0.03]) {
    ctx.moveTo(dx, 0.02);
    ctx.lineTo(dx, top - w * 1.2);
  }
  ctx.stroke();
  if (r() < 0.5) {
    ctx.fillStyle = '#ff6fa8';
    ctx.beginPath();
    blob(ctx, 0, top - 0.01, 0.035);
    ctx.fill();
  }
}

/** A burnt tree with smouldering tips. */
function charred(ctx: CanvasRenderingContext2D, r: Rand) {
  const tips: Tip[] = [];
  ctx.fillStyle = '#2b2326';
  ctx.beginPath();
  branch(ctx, r, 0, 0, Math.PI / 2 + (r() - 0.5) * 0.3, 0.34, 0.05, 4, 0.5, tips);
  ctx.fill();
  ctx.fillStyle = '#ff7a3d';
  ctx.beginPath();
  for (const t of tips) if (r() < 0.4) blob(ctx, t.x, t.y, 0.012);
  ctx.fill();
}

/** Oasis palm: a curved trunk and drooping fronds. */
function palm(ctx: CanvasRenderingContext2D, r: Rand) {
  const lean = (r() - 0.5) * 0.4;
  const tx = lean * 0.6;
  const ty = 0.82;
  ctx.fillStyle = '#8a6a44';
  for (let i = 0; i < 9; i++) {
    const t0 = i / 9;
    const t1 = (i + 1) / 9;
    const x0 = lean * 0.6 * t0 * t0;
    const x1 = lean * 0.6 * t1 * t1;
    ctx.beginPath();
    limb(ctx, x0, t0 * ty, x1, t1 * ty - 0.01, 0.035 - t0 * 0.01, 0.033 - t1 * 0.01);
    ctx.fill();
  }
  const frond = jitter(hexToRgb('#4f9a3a'), r, 0.2);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI / 2 + (k - 3) * 0.48 + (r() - 0.5) * 0.2;
    const len = 0.32 + r() * 0.08;
    ctx.fillStyle = rgb(k % 2 ? frond : shade(frond, -0.15));
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 - Math.abs(Math.cos(a)) * 0.15;
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + 0.12, ex, ey);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + 0.03, tx, ty);
    ctx.fill();
  }
  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath();
  blob(ctx, tx - 0.02, ty - 0.02, 0.025);
  blob(ctx, tx + 0.02, ty - 0.03, 0.025);
  ctx.fill();
}

/** Dry desert tumbleweed shrub. */
function shrub(ctx: CanvasRenderingContext2D, r: Rand) {
  ctx.strokeStyle = '#8a6a44';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.1 + r() * 0.8);
    const len = 0.5 + r() * 0.5;
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * len * 0.4, Math.sin(a) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len * 0.7);
  }
  ctx.stroke();
  ctx.fillStyle = '#b5a05a';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) blob(ctx, (r() - 0.5) * 1.2, 0.3 + r() * 0.35, 0.08);
  ctx.fill();
}

const GROWERS: Record<TreeKind, Grower> = {
  pine: (ctx, r, px) => conifer(ctx, r, px, false),
  snowpine: (ctx, r, px) => conifer(ctx, r, px, true),
  oak: (ctx, r, px) =>
    broadleaf(ctx, r, px, {
      leaf: jitter(hexToRgb('#4f9a3c'), r, 0.3),
      bark: '#6b4a2f',
      trunkLen: 0.3 + r() * 0.08,
      spread: 0.48,
      depth: 5,
      puff: 0.1,
    }),
  birch: (ctx, r, px) =>
    broadleaf(ctx, r, px, {
      leaf: jitter(hexToRgb('#9ccf4f'), r, 0.25),
      bark: '#efece4',
      trunkLen: 0.42,
      spread: 0.4,
      depth: 5,
      puff: 0.075,
      birch: true,
    }),
  cherry: (ctx, r, px) =>
    broadleaf(ctx, r, px, {
      leaf: jitter(hexToRgb('#f7a8c4'), r, 0.15),
      bark: '#4d3326',
      trunkLen: 0.26,
      spread: 0.6,
      depth: 5,
      puff: 0.085,
      blossom: hexToRgb('#ffd1e0'),
    }),
  bamboo: (ctx, r, px) => bamboo(ctx, r, px),
  dead: (ctx, r) => deadTree(ctx, r),
  bush: (ctx, r) => bush(ctx, r),
  cactus: (ctx, r) => cactus(ctx, r),
  charred: (ctx, r) => charred(ctx, r),
  palm: (ctx, r) => palm(ctx, r),
  shrub: (ctx, r) => shrub(ctx, r),
};
