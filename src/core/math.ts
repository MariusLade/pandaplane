export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Frame-rate independent exponential approach. `rate` is roughly 1/seconds. */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export const rgb = (c: RGB, alpha = 1): string =>
  alpha >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

export function shade(c: RGB, amount: number): RGB {
  return amount >= 0 ? mixRgb(c, [255, 255, 255], amount) : mixRgb(c, [0, 0, 0], -amount);
}
