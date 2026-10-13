import { clamp, hexToRgb, invLerp, smoothstep, type RGB } from '../core/math';
import { fbm1, hash, mulberry32 } from '../core/rng';
import { GOAL_DISTANCE, MOUNTAIN_BEND, MOUNTAIN_FOOT, MOUNTAIN_PEAK, MOUNTAIN_SLOPE } from './constants';

export type Decor = 'snowpine' | 'pine' | 'flowers' | 'bamboo';

export interface Biome {
  name: string;
  start: number;
  ground: RGB;
  groundDeep: RGB;
  lip: RGB;
  hills: RGB;
  decor: Decor;
}

const biome = (
  name: string,
  start: number,
  ground: string,
  groundDeep: string,
  lip: string,
  hills: string,
  decor: Decor,
): Biome => ({
  name,
  start,
  ground: hexToRgb(ground),
  groundDeep: hexToRgb(groundDeep),
  lip: hexToRgb(lip),
  hills: hexToRgb(hills),
  decor,
});

export const BIOMES: Biome[] = [
  biome('Snowy Peaks', -Infinity, '#e3edf8', '#9fb2cc', '#ffffff', '#b8c9e2', 'snowpine'),
  biome('Pine Valley', 1400, '#9cc386', '#55794f', '#d6ecc4', '#8fb3a0', 'pine'),
  biome('Flower Meadows', 3000, '#86cf62', '#3f8a3a', '#b4ec86', '#97c98c', 'flowers'),
  biome('Bamboo Forest', 4800, '#62b25a', '#2e6b35', '#93d86e', '#7fb88a', 'bamboo'),
  biome('Panda Paradise', GOAL_DISTANCE - 200, '#a5e06a', '#4f9a3c', '#e4f79a', '#b5d58a', 'bamboo'),
];

const BIOME_BLEND = 220;

export interface BiomeSample {
  a: Biome;
  b: Biome;
  t: number;
}

export function biomeAt(x: number): BiomeSample {
  let i = 0;
  while (i + 1 < BIOMES.length && x >= BIOMES[i + 1].start) i++;
  const next = BIOMES[i + 1];
  if (next && x > next.start - BIOME_BLEND) {
    return { a: BIOMES[i], b: next, t: smoothstep(invLerp(next.start - BIOME_BLEND, next.start, x)) };
  }
  return { a: BIOMES[i], b: BIOMES[i], t: 0 };
}

export type PickupKind = 'coin' | 'bigcoin' | 'ring' | 'balloon';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  radius: number;
  value: number;
  taken: boolean;
  /** Random phase for bobbing animations. */
  phase: number;
  /** Balloon colour index / ring tilt etc. */
  variant: number;
}

export const PICKUP_VALUE: Record<PickupKind, number> = { coin: 4, bigcoin: 25, ring: 0, balloon: 2 };

const CHUNK = 60;

/**
 * Height of the launch mountain at x <= 0 (the valley floor is at 0). It is a
 * smooth shape so the ramp built on it rides without bumps: flat at the foot,
 * steepening into a ~40 degree slope, rounding off at the summit.
 */
export function mountainHeight(x: number): number {
  const d = -x - MOUNTAIN_FOOT;
  if (d <= 0) return 0;
  const L = MOUNTAIN_BEND;
  const k = d / L;
  const raw = d < L ? MOUNTAIN_SLOPE * L * (k * k * k - (k * k * k * k) / 2) : MOUNTAIN_SLOPE * (d - L / 2);
  const shoulder = MOUNTAIN_PEAK - 20;
  if (raw <= shoulder) return raw;
  return MOUNTAIN_PEAK - 20 * Math.exp(-(raw - shoulder) / 20);
}

/** Horizontal distance from the lip to where the mountain reaches `h`. */
export function mountainDistanceForHeight(h: number): number {
  let lo = 0;
  let hi = 2000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mountainHeight(-mid) < h) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The procedural world. Terrain depends only on `seed`, so the landscape is the
 * same every day; pickups depend on `pickupSeed`, so they move around between
 * flights.
 */
export class World {
  private chunks = new Map<number, Pickup[]>();

  constructor(
    readonly seed: number,
    readonly pickupSeed: number,
  ) {}

  /** Rolling hills beyond the launch site. */
  private valley(x: number): number {
    const s = this.seed;
    // Hills grow taller the further you go, so later flights need altitude.
    const amp = 10 + Math.min(34, x / 180);
    const broad = fbm1(s, x / 260, 4) * amp;
    const ridge = Math.max(0, fbm1(s + 99, x / 620, 2)) * amp * 1.6;
    const detail = fbm1(s + 7, x / 34, 2) * 1.6;
    return broad + ridge + detail;
  }

  groundY(x: number): number {
    if (x <= 0) {
      const m = mountainHeight(x);
      // Rocky bumps far up the mountain, well away from any ramp.
      const rough = clamp((-x - 170) / 40, 0, 1);
      return m + (rough > 0 ? fbm1(this.seed + 3, x / 25, 3) * 6 * rough : 0);
    }
    // A gentle downhill run-out first, so short hops still slide a fair way,
    // then the procedural hills fade in.
    const runout = -14 * smoothstep(clamp(x / 200, 0, 1));
    const hills = smoothstep(clamp((x - 40) / 260, 0, 1));
    return runout + this.valley(x) * hills;
  }

  slope(x: number): number {
    const e = 0.25;
    return (this.groundY(x + e) - this.groundY(x - e)) / (2 * e);
  }

  /** Pickups whose chunk overlaps [x0, x1]. Generated lazily and cached. */
  pickupsIn(x0: number, x1: number, out: Pickup[] = []): Pickup[] {
    const c0 = Math.floor(x0 / CHUNK);
    const c1 = Math.floor(x1 / CHUNK);
    for (let c = c0; c <= c1; c++) {
      const list = this.chunk(c);
      for (const p of list) out.push(p);
    }
    return out;
  }

  private chunk(c: number): Pickup[] {
    let list = this.chunks.get(c);
    if (list) return list;
    list = c < 1 ? [] : this.generateChunk(c);
    this.chunks.set(c, list);
    return list;
  }

  private generateChunk(c: number): Pickup[] {
    const rand = mulberry32(Math.floor(hash(this.pickupSeed, c, 17) * 2 ** 31));
    const out: Pickup[] = [];
    const x0 = c * CHUNK;
    let id = c * 1000;
    const add = (kind: PickupKind, x: number, y: number, radius: number, variant = 0) => {
      out.push({ id: id++, kind, x, y, radius, value: PICKUP_VALUE[kind], taken: false, phase: rand() * 6.28, variant });
    };
    const reach = 18 + Math.min(260, x0 * 0.06); // how high above ground things may appear

    // Coin trails: lines, arcs or waves.
    if (rand() < 0.55) {
      const n = 5 + Math.floor(rand() * 7);
      const gap = 3.2;
      const startX = x0 + rand() * (CHUNK - n * gap);
      const baseH = 3 + rand() * reach;
      const shape = Math.floor(rand() * 3);
      const amp = 2 + rand() * 4;
      for (let i = 0; i < n; i++) {
        const x = startX + i * gap;
        const t = i / (n - 1);
        const off = shape === 0 ? 0 : shape === 1 ? Math.sin(t * Math.PI) * amp : Math.sin(t * Math.PI * 2) * amp * 0.6;
        const y = Math.max(this.groundY(x) + 1.6, this.groundY(startX) + baseH + off);
        add('coin', x, y, 0.5);
      }
    }
    if (rand() < 0.07) {
      const x = x0 + rand() * CHUNK;
      add('bigcoin', x, this.groundY(x) + 10 + rand() * reach * 1.4, 0.9);
    }
    if (c > 2 && rand() < 0.13) {
      const x = x0 + rand() * CHUNK;
      add('ring', x, this.groundY(x) + 8 + rand() * reach, 3.2, (rand() - 0.5) * 0.6);
    }
    if (c > 1 && rand() < 0.12) {
      const x = x0 + rand() * CHUNK;
      add('balloon', x, this.groundY(x) + 5 + rand() * reach * 0.8, 1.1, Math.floor(rand() * 5));
    }
    // Sky treasure for rocket pilots.
    if (c > 4 && rand() < 0.22) {
      const n = 4 + Math.floor(rand() * 5);
      const x = x0 + rand() * (CHUNK - 20);
      const y = 150 + rand() * Math.min(1400, 200 + x0 * 0.25);
      for (let i = 0; i < n; i++) add('coin', x + i * 3.4, y + Math.sin(i * 0.9) * 2, 0.5);
      if (rand() < 0.3) add('bigcoin', x + n * 3.4 + 4, y, 0.9);
    }
    return out;
  }
}
