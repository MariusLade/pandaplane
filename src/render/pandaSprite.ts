import type { Mood } from './panda';

/**
 * The panda's body and head as one big procedural sprite.
 *
 * Torso, neck, head, ears, tail and hind legs are unioned into a single
 * silhouette with one continuous ink outline, then shaded and patched. Each
 * size is rendered once per animation frame into an offscreen canvas and
 * cached, so drawing it is a single drawImage. The baked cycle breathes,
 * bobs the head, wiggles the ears and paddles the feet; the face (eyes,
 * blinks, mouth) is drawn live on top so moods change instantly.
 *
 * Local space is metres, +x forward, +y down — the same as the gear.
 */
export const FRAMES = 8;

/** Head centre and radii at rest. */
export const HEAD = { x: 0.72, y: -0.3, rx: 0.42, ry: 0.38 };

const INK = '#2a2340';
const BLACK = '#1f1d24';
const WHITE = '#fbfbf7';
const SHADE = '#dde1e8';
const MUZZLE = '#fff4e6';

/** Sprite bounds in metres (with room for the outline and ear wiggle). */
const BX0 = -1.0;
const BY0 = -0.95;
const BW = 2.35;
const BH = 1.55;

interface FrameShape {
  breath: number;
  headDx: number;
  headDy: number;
  ear: number;
  kick: number;
  tail: number;
}

/** The pose of the baked cycle at frame `f`. */
export function frameShape(f: number): FrameShape {
  const a = (f / FRAMES) * Math.PI * 2;
  return {
    breath: Math.sin(a),
    headDx: Math.sin(a + 0.4) * 0.008,
    headDy: Math.sin(a + 0.8) * 0.02,
    ear: Math.sin(a * 2) * 0.12,
    kick: Math.sin(a),
    tail: Math.sin(a * 2 + 1),
  };
}

type Ell = [number, number, number, number, number];

/** The silhouette pieces (x, y, rx, ry, rotation) for one frame. */
function silhouette(s: FrameShape): { body: Ell[]; ears: Ell[]; legs: Ell[]; head: Ell; torso: Ell } {
  const hx = HEAD.x + s.headDx;
  const hy = HEAD.y + s.headDy;
  const torso: Ell = [-0.05, 0.02, 0.62 * (1 - s.breath * 0.012), 0.4 * (1 + s.breath * 0.03), 0];
  const head: Ell = [hx, hy, HEAD.rx, HEAD.ry, 0];
  const neck: Ell = [0.36, -0.1 + s.headDy * 0.5, 0.34, 0.32, -0.4];
  const tail: Ell = [-0.66 + s.tail * 0.01, -0.12 - s.tail * 0.015, 0.11, 0.1, 0];
  const ears: Ell[] = [
    [hx - 0.27, hy - 0.29, 0.15, 0.14, -0.3 + s.ear],
    [hx + 0.26, hy - 0.31, 0.15, 0.14, 0.3 - s.ear * 0.7],
  ];
  const legs: Ell[] = [
    // Far hind leg, then the near one, paddling out of phase.
    [-0.5 + s.kick * 0.03, 0.14 - s.kick * 0.02, 0.24, 0.14, 0.3],
    [-0.4 - s.kick * 0.03, 0.24 + s.kick * 0.02, 0.27, 0.16, 0.2],
  ];
  return { body: [torso, neck, head, tail], ears, legs, head, torso };
}

function ell(ctx: CanvasRenderingContext2D, e: Ell) {
  ctx.moveTo(e[0] + e[2] * Math.cos(e[4]), e[1] + e[2] * Math.sin(e[4]));
  ctx.ellipse(e[0], e[1], e[2], e[3], e[4], 0, Math.PI * 2);
}

/** Paint one frame at `res` pixels per metre into a fresh canvas. */
function bake(res: number, frame: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(BW * res);
  canvas.height = Math.ceil(BH * res);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  ctx.translate(-BX0, -BY0);
  ctx.lineJoin = 'round';
  const s = frameShape(frame);
  const { body, ears, legs, head, torso } = silhouette(s);
  // Outline thick enough to read when small, thin enough to stay cute when big.
  const line = Math.max(0.035, 1.6 / res);

  const [farLeg, nearLeg] = legs;
  // 1. Ink outline of the whole union: stroke every piece, fill on top.
  ctx.strokeStyle = INK;
  ctx.lineWidth = line * 2;
  ctx.beginPath();
  for (const e of [...ears, farLeg, ...body]) ell(ctx, e);
  ctx.stroke();

  // 2. Black parts that sit behind the white: ears and the far leg.
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  for (const e of [...ears, farLeg]) ell(ctx, e);
  ctx.fill();
  // Inner ear.
  ctx.fillStyle = '#4a3f55';
  for (const e of ears) {
    ctx.beginPath();
    ctx.ellipse(e[0], e[1] + 0.02, e[2] * 0.5, e[3] * 0.45, e[4], 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. White body + head as one shape (no seams).
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  for (const e of body) ell(ctx, e);
  ctx.fill();

  // 4. Shading and patches, clipped to the white silhouette.
  ctx.save();
  ctx.beginPath();
  for (const e of body) ell(ctx, e);
  ctx.clip();
  // Soft belly shadow and a rim light along the back.
  ctx.fillStyle = SHADE;
  ctx.beginPath();
  ctx.ellipse(torso[0] - 0.05, torso[1] + 0.3, 0.75, 0.22, 0, 0, Math.PI * 2);
  ctx.ellipse(head[0] + 0.05, head[1] + 0.34, 0.38, 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(torso[0] - 0.1, torso[1] - 0.3, 0.4, 0.08, -0.1, 0, Math.PI * 2);
  ctx.ellipse(head[0] - 0.05, head[1] - 0.28, 0.2, 0.06, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // The black saddle across the shoulders (it wraps into the front legs).
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  ctx.ellipse(0.22, 0.02 + s.breath * 0.005, 0.2, 0.62, -0.32, 0, Math.PI * 2);
  ctx.fill();
  // Eye patches: tilted teardrops.
  const hx = head[0];
  const hy = head[1];
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + side * 0.15, hy + 0.0, 0.1, 0.14, side * -0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Muzzle and nose.
  ctx.fillStyle = MUZZLE;
  ctx.beginPath();
  ctx.ellipse(hx, hy + 0.17, 0.15, 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  ctx.moveTo(hx - 0.055, hy + 0.11);
  ctx.quadraticCurveTo(hx, hy + 0.09, hx + 0.055, hy + 0.11);
  ctx.quadraticCurveTo(hx + 0.03, hy + 0.165, hx, hy + 0.165);
  ctx.quadraticCurveTo(hx - 0.03, hy + 0.165, hx - 0.055, hy + 0.11);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(hx - 0.018, hy + 0.115, 0.016, 0.008, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. The near hind leg sits in front of the body, with its own outline.
  ctx.beginPath();
  ell(ctx, nearLeg);
  ctx.strokeStyle = INK;
  ctx.lineWidth = line * 2;
  ctx.stroke();
  ctx.fillStyle = BLACK;
  ctx.fill();
  // Toe beans.
  const foot = nearLeg;
  ctx.fillStyle = '#5a4a5e';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(foot[0] - 0.16 + i * 0.05, foot[1] + 0.04 + Math.abs(i - 1) * 0.02, 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHED = 96;

/** Cache sizes in ~10% steps so a smooth zoom only bakes a handful of sprites. */
function bucket(res: number): number {
  return Math.round(Math.log(Math.max(4, Math.min(420, res))) / Math.log(1.1));
}

function sprite(res: number, frame: number): HTMLCanvasElement {
  const b = bucket(res);
  const key = `${b}:${frame}`;
  let c = cache.get(key);
  if (c) {
    // Refresh for LRU order.
    cache.delete(key);
    cache.set(key, c);
    return c;
  }
  c = bake(Math.pow(1.1, b), frame);
  cache.set(key, c);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return c;
}

/** Which baked frame to show: calm pandas breathe slowly, excited or scared ones pant. */
export function pandaFrame(time: number, mood: Mood): number {
  const rate = mood === 'scared' || mood === 'excited' ? 2.6 : mood === 'sleepy' ? 0.6 : 1.3;
  return Math.floor(time * rate * FRAMES) % FRAMES;
}

/**
 * Draw the body+head sprite into the current transform (metres, +y down).
 * The device-pixel resolution is read off the transform, so it stays crisp in
 * the game, the hangar and the shop previews alike.
 */
export function drawPandaSprite(ctx: CanvasRenderingContext2D, frame: number): void {
  const m = ctx.getTransform();
  const res = Math.hypot(m.a, m.b);
  const img = sprite(res, frame);
  ctx.drawImage(img, BX0, BY0, img.width / Math.pow(1.1, bucket(res)), img.height / Math.pow(1.1, bucket(res)));
}

/** Head centre for a frame, so live features follow the baked bob. */
export function headAt(frame: number): { x: number; y: number } {
  const s = frameShape(frame);
  return { x: HEAD.x + s.headDx, y: HEAD.y + s.headDy };
}

/**
 * The live face: eyes (with blinks and moods), cheeks and mouth. Drawn over
 * the sprite in the same transform.
 */
export function drawFace(ctx: CanvasRenderingContext2D, frame: number, mood: Mood, time: number): void {
  const { x: hx, y: hy } = headAt(frame);
  const ey = hy - 0.02;
  // Blink for a moment every few seconds (sleepy pandas mostly keep them shut).
  const blink = (time % 3.7) < 0.12 || mood === 'sleepy';
  ctx.lineCap = 'round';
  if (mood === 'dizzy') {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.035;
    for (const side of [-1, 1]) {
      const ex = hx + side * 0.14;
      ctx.beginPath();
      // Spiral eyes.
      for (let k = 0; k <= 16; k++) {
        const a = k * 0.8 + time * 8 * side;
        const r = 0.005 + k * 0.0035;
        const px = ex + Math.cos(a) * r;
        const py = ey + Math.sin(a) * r;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  } else if (blink) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.03;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + side * 0.14, ey - 0.01, 0.04, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  } else {
    const big = mood === 'scared' ? 0.058 : mood === 'excited' ? 0.052 : 0.047;
    for (const side of [-1, 1]) {
      const ex = hx + side * 0.14 + 0.008;
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(ex, ey, big, big * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupils look forward; scared pupils shrink and shake.
      const shake = mood === 'scared' ? Math.sin(time * 40 + side) * 0.006 : 0;
      const pr = mood === 'scared' ? 0.45 : 0.62;
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.ellipse(ex + big * 0.25 + shake, ey + big * 0.05, big * pr, big * pr * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(ex + big * 0.05, ey - big * 0.35, big * 0.25, 0, Math.PI * 2);
      ctx.fill();
      if (mood === 'excited') {
        // Starry sparkle.
        ctx.beginPath();
        ctx.arc(ex + big * 0.45, ey + big * 0.3, big * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Cheeks.
  ctx.fillStyle = mood === 'excited' ? 'rgba(255,110,140,0.6)' : 'rgba(255,130,150,0.42)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + side * 0.25, hy + 0.13, 0.065, 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth under the nose.
  const my = hy + 0.17;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 0.024;
  if (mood === 'scared') {
    ctx.fillStyle = '#5b1f2a';
    ctx.beginPath();
    ctx.ellipse(hx, my + 0.06, 0.04, 0.05 + Math.sin(time * 30) * 0.006, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sweat drop.
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    const sy = hy - 0.18 + ((time * 0.8) % 1) * 0.12;
    ctx.moveTo(hx + 0.36, sy - 0.06);
    ctx.quadraticCurveTo(hx + 0.41, sy + 0.01, hx + 0.36, sy + 0.03);
    ctx.quadraticCurveTo(hx + 0.31, sy + 0.01, hx + 0.36, sy - 0.06);
    ctx.fill();
  } else if (mood === 'excited') {
    ctx.fillStyle = '#5b1f2a';
    ctx.beginPath();
    ctx.moveTo(hx - 0.09, my);
    ctx.quadraticCurveTo(hx, my + 0.16, hx + 0.09, my);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7f8f';
    ctx.beginPath();
    ctx.ellipse(hx, my + 0.065, 0.04, 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'dizzy') {
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const x = hx - 0.07 + k * 0.0175;
      const y = my + 0.03 + Math.sin(k * 1.6 + time * 6) * 0.012;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else {
    // A little cat-like "w".
    ctx.beginPath();
    ctx.moveTo(hx - 0.065, my - 0.005);
    ctx.quadraticCurveTo(hx - 0.032, my + 0.045, hx, my + 0.005);
    ctx.quadraticCurveTo(hx + 0.032, my + 0.045, hx + 0.065, my - 0.005);
    ctx.stroke();
    if (mood === 'sleepy') {
      ctx.fillStyle = 'rgba(42,35,64,0.6)';
      ctx.font = '700 0.16px Fredoka, system-ui, sans-serif';
      const z = (time * 0.6) % 1;
      ctx.globalAlpha = 1 - z;
      ctx.fillText('z', hx + 0.3 + z * 0.15, hy - 0.35 - z * 0.25);
      ctx.globalAlpha = 1;
    }
  }
}
