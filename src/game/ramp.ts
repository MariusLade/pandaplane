import { clamp, lerp, smoothstep } from '../core/math';
import { CLIFF_HEIGHT } from './constants';
import type { RampTier } from './upgrades';

export interface RampPoint {
  x: number;
  y: number;
  /** Direction of travel, radians (negative = downhill). */
  angle: number;
  /** Arc length from the top. */
  s: number;
}

export interface Ramp {
  points: RampPoint[];
  length: number;
  top: RampPoint;
  lip: RampPoint;
  /** Lowest y along the ramp, used for drawing supports. */
  minY: number;
  baseY: number;
}

const START_DEG = -44;
const STEPS = 80;

/**
 * Builds a ramp procedurally by integrating a direction curve: steep at the top,
 * bending smoothly up to the launch angle. The result is scaled so its vertical
 * drop matches the tier height, then placed so the lip sits at x = 0.
 */
export function buildRamp(tier: RampTier, baseY = CLIFF_HEIGHT): Ramp {
  const raw: RampPoint[] = [];
  let x = 0;
  let y = 0;
  const end = (tier.launchDeg * Math.PI) / 180;
  const start = (START_DEG * Math.PI) / 180;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const k = smoothstep(clamp((t - 0.62) / 0.38, 0, 1));
    const angle = lerp(start, end, k);
    raw.push({ x, y, angle, s: i });
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  const minRaw = Math.min(...raw.map((p) => p.y));
  const scale = tier.height / (raw[0].y - minRaw);
  const lipRaw = raw[raw.length - 1];
  const lift = 0.8; // gap between the lowest ramp point and the plateau
  const points = raw.map((p) => ({
    x: (p.x - lipRaw.x) * scale,
    y: (p.y - minRaw) * scale + baseY + lift,
    angle: p.angle,
    s: p.s * scale,
  }));
  return {
    points,
    length: points[points.length - 1].s,
    top: points[0],
    lip: points[points.length - 1],
    minY: baseY + lift,
    baseY,
  };
}

/** Position and direction at arc length `s`. */
export function rampAt(ramp: Ramp, s: number): RampPoint {
  const pts = ramp.points;
  const step = pts[1].s;
  const f = clamp(s / step, 0, pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const t = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: lerp(a.angle, b.angle, t), s };
}
