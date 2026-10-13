import { clamp, invLerp, smoothstep } from '../core/math';
import { fbm1, hash, mulberry32 } from '../core/rng';
import { MOUNTAIN_BEND, MOUNTAIN_FOOT, MOUNTAIN_PEAK, MOUNTAIN_SLOPE } from './constants';
import { VALLEY, type Biome, type MapDef, type PondKind } from './maps';

export type { Biome } from './maps';

const BIOME_BLEND = 220;

export interface BiomeSample {
  a: Biome;
  b: Biome;
  t: number;
}

/** Which biome(s) x falls in, with a blend factor across boundaries. */
export function biomeIn(biomes: Biome[], x: number): BiomeSample {
  let i = 0;
  while (i + 1 < biomes.length && x >= biomes[i + 1].start) i++;
  const next = biomes[i + 1];
  if (next && x > next.start - BIOME_BLEND) {
    return { a: biomes[i], b: next, t: smoothstep(invLerp(next.start - BIOME_BLEND, next.start, x)) };
  }
  return { a: biomes[i], b: biomes[i], t: 0 };
}

/** The dominant biome at x. */
export const mainBiome = (s: BiomeSample): Biome => (s.t > 0.5 ? s.b : s.a);

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
export type Surface = 'ground' | PondKind;

/** A pond filling a dip in the hills: water, ice or lava depending on the biome. */
export interface Pond {
  x0: number;
  x1: number;
  level: number;
  kind: PondKind;
}

/** A column of rising hot air. */
export interface Thermal {
  x: number;
  halfWidth: number;
  /** Updraft speed at the core, m/s. */
  strength: number;
  /** How high above the ground it reaches. */
  top: number;
}

const THERMAL_CELL = 170;

const POND_CELL = 280;
const POND_MAX_HALF_WIDTH = 90;

export class World {
  private chunks = new Map<number, Pickup[]>();
  private ponds = new Map<number, Pond | null>();
  private thermals = new Map<number, Thermal | null>();
  readonly seed: number;

  constructor(
    seed: number,
    readonly pickupSeed: number,
    readonly map: MapDef = VALLEY,
  ) {
    this.seed = seed + map.seedSalt;
  }

  biomeAt(x: number): BiomeSample {
    return biomeIn(this.map.biomes, x);
  }

  /** Rolling hills (or terraced mesas) beyond the launch site. */
  private valley(x: number): number {
    const s = this.seed;
    const t = this.map.terrain;
    // Hills grow taller the further you go, so later flights need altitude.
    const amp = t.amp0 + Math.min(t.ampMax, x / t.ampGrowth);
    const broad = fbm1(s, x / 260, 4) * amp;
    const ridge = Math.max(0, fbm1(s + 99, x / 620, 2)) * amp * t.ridge;
    let v = broad + ridge;
    if (t.terrace > 0) {
      // Flat mesa tops joined by steep cliffs.
      const k = v / t.terrace;
      const f = k - Math.floor(k);
      v = (Math.floor(k) + smoothstep(clamp((f - 0.62) / 0.38, 0, 1))) * t.terrace;
    }
    return v + fbm1(s + 7, x / 34, 2) * t.detail;
  }

  /** Vertical wind at a point (thermals), m/s. */
  updraft(x: number, y: number): number {
    const c = Math.floor(x / THERMAL_CELL);
    let w = 0;
    for (let k = c - 1; k <= c + 1; k++) {
      const th = this.thermal(k);
      if (!th) continue;
      const d = Math.abs(x - th.x) / th.halfWidth;
      if (d >= 1) continue;
      const h = y - this.rawGround(th.x);
      if (h < -5 || h > th.top) continue;
      const fade = h > th.top * 0.7 ? 1 - (h - th.top * 0.7) / (th.top * 0.3) : 1;
      w += th.strength * (1 - d * d) * fade;
    }
    return w;
  }

  thermalsIn(x0: number, x1: number): Thermal[] {
    const out: Thermal[] = [];
    for (let k = Math.floor(x0 / THERMAL_CELL) - 1; k <= Math.floor(x1 / THERMAL_CELL) + 1; k++) {
      const th = this.thermal(k);
      if (th && th.x + th.halfWidth >= x0 && th.x - th.halfWidth <= x1) out.push(th);
    }
    return out;
  }

  private thermal(cell: number): Thermal | null {
    let th = this.thermals.get(cell);
    if (th !== undefined) return th;
    th = null;
    if (cell >= 2) {
      const x = (cell + 0.2 + hash(this.seed, cell, 601) * 0.6) * THERMAL_CELL;
      const odds = mainBiome(this.biomeAt(x)).thermals ?? 0;
      if (hash(this.seed, cell, 602) < odds) {
        th = {
          x,
          halfWidth: 9 + hash(this.seed, cell, 603) * 12,
          strength: 7 + hash(this.seed, cell, 604) * 9,
          top: 120 + hash(this.seed, cell, 605) * 260,
        };
      }
    }
    this.thermals.set(cell, th);
    return th;
  }

  /** Walkable surface height: the terrain, or a pond's surface where one fills a dip. */
  groundY(x: number): number {
    const raw = this.rawGround(x);
    const pond = this.pondAt(x);
    return pond && raw < pond.level ? pond.level : raw;
  }

  /** What the panda would land on at x. */
  surfaceAt(x: number): Surface {
    const pond = this.pondAt(x);
    return pond && this.rawGround(x) < pond.level ? pond.kind : 'ground';
  }

  pondAt(x: number): Pond | null {
    const c = Math.floor(x / POND_CELL);
    for (let k = c - 1; k <= c + 1; k++) {
      const p = this.pond(k);
      if (p && x >= p.x0 && x <= p.x1) return p;
    }
    return null;
  }

  /** Ponds overlapping [x0, x1], for drawing. */
  pondsIn(x0: number, x1: number): Pond[] {
    const out: Pond[] = [];
    for (let k = Math.floor(x0 / POND_CELL) - 1; k <= Math.floor(x1 / POND_CELL) + 1; k++) {
      const p = this.pond(k);
      if (p && p.x1 >= x0 && p.x0 <= x1) out.push(p);
    }
    return out;
  }

  private pond(cell: number): Pond | null {
    let p = this.ponds.get(cell);
    if (p !== undefined) return p;
    p = this.makePond(cell);
    this.ponds.set(cell, p);
    return p;
  }

  /** Find the lowest dip in a cell and fill it, if both banks rise above the water line. */
  private makePond(cell: number): Pond | null {
    if (cell < 2 || hash(this.seed, cell, 501) > 0.45) return null;
    const a = cell * POND_CELL + 30;
    const b = (cell + 1) * POND_CELL - 30;
    let minX = a;
    let minY = Infinity;
    for (let x = a; x <= b; x += 2) {
      const y = this.rawGround(x);
      if (y < minY) {
        minY = y;
        minX = x;
      }
    }
    const level = minY + 1.5 + hash(this.seed, cell, 502) * 2.5;
    let x0 = minX;
    while (this.rawGround(x0) < level) {
      x0 -= 0.5;
      if (minX - x0 > POND_MAX_HALF_WIDTH) return null;
    }
    let x1 = minX;
    while (this.rawGround(x1) < level) {
      x1 += 0.5;
      if (x1 - minX > POND_MAX_HALF_WIDTH) return null;
    }
    if (x1 - x0 < 8) return null;
    return { x0, x1, level, kind: mainBiome(this.biomeAt(minX)).pond };
  }

  /** Terrain height ignoring ponds. */
  rawGround(x: number): number {
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
