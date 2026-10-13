import { clamp, lerp } from '../core/math';
import { DECK_CLEARANCE, KICKER_LENGTH } from './constants';
import type { RampItem } from './upgrades';
import { mountainHeight, mountainDistanceForHeight } from './world';

export interface RampPoint {
  x: number;
  y: number;
  /** Direction of travel, radians (negative = downhill). */
  angle: number;
  /** Arc length from the top. */
  s: number;
}

export interface Ramp {
  /** Points evenly spaced by arc length. */
  points: RampPoint[];
  step: number;
  length: number;
  top: RampPoint;
  lip: RampPoint;
  /** Where the kicker starts rising off the mountain. */
  kickerStart: number;
  item: RampItem;
}

const STEP = 0.5;

/**
 * The ramp is laid along the mountainside: it starts `height` metres up the
 * slope, follows the hill down, and ends in a kicker at the foot of the
 * mountain that curves up to the launch angle. The lip is always at x = 0.
 */
export function buildRamp(item: RampItem): Ramp {
  const tan = Math.tan((item.launchDeg * Math.PI) / 180);
  const K = KICKER_LENGTH;
  const hill = (x: number) => mountainHeight(x) + DECK_CLEARANCE;
  // Kicker: a cubic Hermite curve that leaves the hillside tangentially and
  // reaches the lip at exactly the launch angle.
  const y0 = hill(-K);
  const m0 = (hill(-K + 0.01) - hill(-K - 0.01)) / 0.02;
  const y1 = DECK_CLEARANCE + (tan * K) / 2;
  const m1 = tan;
  const deckY = (x: number): number => {
    if (x <= -K) return hill(x);
    const t = (x + K) / K;
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * K * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * K * m1;
    return Math.max(hill(x) - 0.4, y);
  };

  const xTop = -mountainDistanceForHeight(item.height);
  // Dense polyline, then resample evenly by arc length.
  const dense: { x: number; y: number; s: number }[] = [];
  let s = 0;
  let px = xTop;
  let py = deckY(xTop);
  dense.push({ x: px, y: py, s: 0 });
  const n = Math.ceil(-xTop / 0.1);
  for (let i = 1; i <= n; i++) {
    const x = xTop * (1 - i / n);
    const y = deckY(x);
    s += Math.hypot(x - px, y - py);
    dense.push({ x, y, s });
    px = x;
    py = y;
  }
  const length = s;
  // Evenly spaced by arc length so rampAt can index directly.
  const count = Math.max(2, Math.ceil(length / STEP));
  const step = length / count;
  const points: RampPoint[] = [];
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const d = k * step;
    while (j < dense.length - 2 && dense[j + 1].s < d) j++;
    const a = dense[j];
    const b = dense[j + 1];
    const t = clamp((d - a.s) / (b.s - a.s || 1), 0, 1);
    points.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: 0, s: d });
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    points[i].angle = Math.atan2(b.y - a.y, b.x - a.x);
  }
  // The lip leaves at exactly the designed angle.
  points[points.length - 1].angle = Math.atan(tan);

  return {
    points,
    step,
    length,
    top: points[0],
    lip: points[points.length - 1],
    kickerStart: -K,
    item,
  };
}

/** Position and direction at arc length `s`. */
export function rampAt(ramp: Ramp, s: number): RampPoint {
  const pts = ramp.points;
  const f = clamp(s / ramp.step, 0, pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const t = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: lerp(a.angle, b.angle, t), s };
}
