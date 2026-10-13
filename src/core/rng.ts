/** Deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless integer hash -> [0, 1). Same inputs always give the same output. */
export function hash(seed: number, x: number, y = 0): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(x | 0, 0xcc9e2d51), 0x1b873593);
  h = Math.imul(h ^ Math.imul(y | 0, 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(seed, i) * 2 - 1;
  const b = hash(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
}

/** Fractal (fBm) 1D noise, roughly in [-1, 1]. */
export function fbm1(seed: number, x: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(seed + o * 1013, x * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
