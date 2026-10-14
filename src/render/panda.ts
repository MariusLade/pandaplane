import type { GliderStyle, Loadout, RocketStyle, SledStyle } from '../game/upgrades';
import { HEAD, drawFace, drawPandaSprite, headAt, pandaFrame } from './pandaSprite';

export type Mood = 'happy' | 'excited' | 'scared' | 'dizzy' | 'sleepy';

export interface PandaPose {
  /** Nose angle in radians, + = nose up (world convention). */
  angle: number;
  time: number;
  speed: number;
  boosting: boolean;
  mood: Mood;
  /** 0..1, how much the scarf streams behind. */
  wind: number;
  /** 1 right after a wing beat, fading to 0. */
  flap?: number;
  /** Rocket power, 0..1, for the size of the exhaust. */
  thrust?: number;
}

const BLACK = '#1f1d24';
const INK = '#2a2340';

/**
 * Draws the panda and its gear, entirely from primitives. Local space is in
 * metres with +x forward and +y down; `scale` is pixels per metre.
 */
export function drawPanda(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  scale: number,
  gear: Loadout,
  pose: PandaPose,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-pose.angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const gs = gear.glider.style;
  // Wings drawn above the panda (the carpet goes underneath, the beanie on the head).
  const hasGlider = gs !== 'none' && gs !== 'carpet' && gs !== 'propeller';
  const hasRocket = gear.rocket.style !== 'none';
  if (gs === 'carpet') drawCarpet(ctx, gear.glider.color, pose);

  if (hasRocket && pose.boosting) drawFlame(ctx, gear.rocket.style, pose.time, pose.thrust ?? 0.5);
  drawScarf(ctx, pose);
  if (hasGlider) drawGliderBack(ctx, gear.glider.style, gear.glider.color, gear.glider.span, pose);
  if (hasRocket) drawRocket(ctx, gear.rocket.style, gear.rocket.color, pose.time);
  // The arm reaching for the glider bar goes behind the head.
  if (hasGlider) drawGliderArms(ctx);

  // Body and head: one baked sprite, squashed and stretched live around the seat.
  const frame = pandaFrame(pose.time, pose.mood);
  const flap = pose.flap ?? 0;
  const stretch = (pose.boosting ? 0.05 : 0) + flap * 0.08;
  const shiver = pose.mood === 'scared' ? Math.sin(pose.time * 55) * 0.012 : 0;
  ctx.save();
  ctx.translate(shiver, 0.35);
  ctx.scale(1 + stretch, 1 - stretch * 0.8);
  ctx.translate(0, -0.35);
  drawPandaSprite(ctx, frame);
  drawScarfBand(ctx, frame);
  drawPaw(ctx, pose, hasGlider);
  ctx.restore();
  drawSled(ctx, gear.sled.style, gear.sled.color, pose.time);
  ctx.save();
  ctx.translate(shiver, 0.35);
  ctx.scale(1 + stretch, 1 - stretch * 0.8);
  ctx.translate(0, -0.35);
  drawFace(ctx, frame, pose.mood, pose.time);
  if (gs === 'propeller') drawBeanie(ctx, gear.glider.color, pose, frame);
  ctx.restore();

  ctx.restore();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function drawScarf(ctx: CanvasRenderingContext2D, pose: PandaPose) {
  const len = 0.7 + pose.wind * 0.6;
  const amp = 0.05 + pose.wind * 0.08;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.moveTo(0.34, -0.12 + k * 0.06);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = 0.34 - t * len - k * 0.1;
      const droop = (1 - pose.wind) * t * 0.35;
      const y = -0.14 + k * 0.08 + droop + Math.sin(pose.time * 14 + t * 6 + k) * amp * t;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = k ? '#b8302a' : '#e2493b';
    ctx.lineWidth = 0.11;
    ctx.stroke();
  }
}

/** The near front paw: gripping the sled, or reaching forward under boost. */
function drawPaw(ctx: CanvasRenderingContext2D, pose: PandaPose, holdingBar: boolean) {
  if (holdingBar) return;
  const reach = pose.boosting ? 0.1 : 0;
  const wave = pose.mood === 'excited' ? Math.sin(pose.time * 14) * 0.06 : 0;
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.05;
  ellipse(ctx, 0.58 + reach, 0.2 - reach + wave, 0.24, 0.13, -0.45 + reach * 3);
  ctx.stroke();
  ctx.fill();
}

/** The red scarf wrapped round the neck, hugging the bottom of the head. */
function drawScarfBand(ctx: CanvasRenderingContext2D, frame: number) {
  const h = headAt(frame);
  const arc = () => {
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, HEAD.rx + 0.01, HEAD.ry + 0.01, 0, Math.PI * 0.55, Math.PI * 0.98);
  };
  ctx.lineCap = 'round';
  arc();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.17;
  ctx.stroke();
  ctx.strokeStyle = '#e2493b';
  ctx.lineWidth = 0.11;
  ctx.stroke();
  // A darker fold along the band.
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, HEAD.rx + 0.03, HEAD.ry + 0.03, 0, Math.PI * 0.62, Math.PI * 0.92);
  ctx.strokeStyle = '#b8302a';
  ctx.lineWidth = 0.03;
  ctx.stroke();
}

function drawSled(ctx: CanvasRenderingContext2D, style: SledStyle, color: string, time: number) {
  ctx.lineWidth = 0.04;
  switch (style) {
    case 'box': {
      // Cardboard box the panda sits in.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.62, 0.05);
      ctx.lineTo(0.55, 0.05);
      ctx.lineTo(0.52, 0.48);
      ctx.lineTo(-0.6, 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a6339';
      ctx.stroke();
      ctx.fillStyle = '#a77a47';
      ctx.beginPath();
      ctx.moveTo(-0.62, 0.05);
      ctx.lineTo(-0.85, -0.12);
      ctx.lineTo(-0.72, 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a6339';
      ctx.beginPath();
      ctx.moveTo(-0.1, 0.2);
      ctx.lineTo(0.15, 0.2);
      ctx.stroke();
      break;
    }
    case 'lid': {
      // Dented metal trash can lid with a handle.
      ctx.fillStyle = color;
      ellipse(ctx, 0, 0.42, 0.75, 0.12);
      ctx.fill();
      ctx.strokeStyle = '#6d757f';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-0.6, 0.42);
      ctx.lineTo(0.6, 0.42);
      ctx.stroke();
      ctx.strokeStyle = '#7b838d';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(-0.15, 0.53);
      ctx.quadraticCurveTo(0, 0.66, 0.15, 0.53);
      ctx.stroke();
      break;
    }
    case 'plastic': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.28);
      ctx.quadraticCurveTo(0, 0.5, 0.7, 0.36);
      ctx.quadraticCurveTo(0.95, 0.3, 0.9, 0.1);
      ctx.lineTo(0.78, 0.18);
      ctx.quadraticCurveTo(0, 0.36, -0.68, 0.16);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'toboggan': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.75, 0.32);
      ctx.lineTo(0.7, 0.32);
      ctx.arc(0.7, 0.12, 0.2, Math.PI / 2, -Math.PI / 2, true);
      ctx.lineTo(0.66, -0.02);
      ctx.arc(0.7, 0.12, 0.12, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(-0.75, 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6e3c1c';
      for (let x = -0.6; x < 0.6; x += 0.25) {
        ctx.beginPath();
        ctx.moveTo(x, 0.25);
        ctx.lineTo(x, 0.31);
        ctx.stroke();
      }
      break;
    }
    case 'racing':
    case 'iron': {
      const heavy = style === 'iron';
      ctx.strokeStyle = heavy ? '#2b2e33' : '#c9ced6';
      ctx.lineWidth = heavy ? 0.1 : 0.06;
      ctx.beginPath();
      ctx.moveTo(-0.75, 0.46);
      ctx.lineTo(0.6, 0.46);
      ctx.quadraticCurveTo(0.85, 0.46, 0.85, 0.3);
      ctx.stroke();
      ctx.lineWidth = heavy ? 0.08 : 0.04;
      ctx.beginPath();
      ctx.moveTo(-0.4, 0.46);
      ctx.lineTo(-0.35, 0.3);
      ctx.moveTo(0.35, 0.46);
      ctx.lineTo(0.3, 0.3);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-0.72, heavy ? 0.16 : 0.22, 1.4, heavy ? 0.2 : 0.12, 0.05);
      ctx.fill();
      if (heavy) {
        ctx.fillStyle = '#9ba1ab';
        for (let x = -0.6; x < 0.6; x += 0.2) {
          ellipse(ctx, x, 0.26, 0.025, 0.025);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-0.4, 0.26, 0.7, 0.03);
      }
      break;
    }
    case 'bobsled': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.75, -0.02);
      ctx.lineTo(0.35, -0.02);
      ctx.quadraticCurveTo(1.1, 0.05, 0.95, 0.38);
      ctx.quadraticCurveTo(0.8, 0.5, 0.4, 0.5);
      ctx.lineTo(-0.7, 0.5);
      ctx.quadraticCurveTo(-0.85, 0.3, -0.75, -0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-0.6, 0.08, 1.1, 0.06);
      ctx.fillStyle = '#1f1d24';
      ctx.font = 'bold 0.26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1', -0.2, 0.4);
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.6, 0.56);
      ctx.lineTo(0.7, 0.56);
      ctx.stroke();
      break;
    }
    case 'wok': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.72, 0.2);
      ctx.quadraticCurveTo(0, 0.72, 0.72, 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1b1d22';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(-0.2, 0.34, 0.3, 0.05, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Long handle sticking out the back.
      ctx.strokeStyle = '#7a5532';
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.24);
      ctx.lineTo(-1.15, 0.12);
      ctx.stroke();
      break;
    }
    case 'inflatable': {
      // Puffy striped ring with turrets.
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#ffd23d' : color;
        ellipse(ctx, -0.6 + i * 0.3, 0.42, 0.2, 0.17);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();
      }
      ctx.fillStyle = '#5dc4ff';
      ctx.fillRect(0.62, 0.05, 0.14, 0.28);
      ctx.fillRect(-0.78, 0.05, 0.14, 0.28);
      ctx.fillStyle = '#ffd23d';
      ellipse(ctx, 0.69, 0.05, 0.08, 0.05);
      ctx.fill();
      ellipse(ctx, -0.71, 0.05, 0.08, 0.05);
      ctx.fill();
      break;
    }
    case 'surfboard': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.95, 0.42);
      ctx.quadraticCurveTo(-0.9, 0.32, -0.6, 0.32);
      ctx.lineTo(0.7, 0.32);
      ctx.quadraticCurveTo(1.15, 0.33, 1.05, 0.42);
      ctx.quadraticCurveTo(0.6, 0.52, -0.95, 0.42);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.7, 0.38, 1.5, 0.035);
      ctx.fillStyle = '#ff7a3d';
      ctx.beginPath();
      ctx.moveTo(-0.75, 0.48);
      ctx.lineTo(-0.85, 0.62);
      ctx.lineTo(-0.6, 0.49);
      ctx.fill();
      break;
    }
    case 'obsidian': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.95, 0.4);
      ctx.lineTo(-0.7, 0.3);
      ctx.lineTo(0.75, 0.3);
      ctx.lineTo(1.05, 0.38);
      ctx.lineTo(0.8, 0.48);
      ctx.lineTo(-0.8, 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(190,140,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(-0.5, 0.33);
      ctx.lineTo(0.3, 0.33);
      ctx.lineTo(0.1, 0.38);
      ctx.lineTo(-0.6, 0.38);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,60,0.8)';
      ctx.fillRect(-0.7, 0.45, 1.4, 0.025);
      break;
    }
    case 'jetski': {
      // A chunky pink jet ski: hull, white stripe, handlebars and a little windscreen.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.85, 0.12);
      ctx.lineTo(0.55, 0.12);
      ctx.quadraticCurveTo(1.05, 0.14, 1.15, 0.36);
      ctx.quadraticCurveTo(0.9, 0.56, 0.3, 0.56);
      ctx.lineTo(-0.75, 0.56);
      ctx.quadraticCurveTo(-0.95, 0.4, -0.85, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2a2340';
      ctx.lineWidth = 0.035;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.32);
      ctx.lineTo(0.95, 0.32);
      ctx.lineTo(0.9, 0.39);
      ctx.lineTo(-0.8, 0.39);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a2340';
      ctx.fillRect(-0.85, 0.47, 1.7, 0.09);
      // Windscreen and handlebar.
      ctx.fillStyle = 'rgba(160,225,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0.62, 0.12);
      ctx.lineTo(0.78, -0.12);
      ctx.lineTo(0.9, 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a3f4b';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(0.6, 0.12);
      ctx.lineTo(0.66, -0.06);
      ctx.stroke();
      // Spray from the jet.
      const spray = 0.5 + 0.5 * Math.sin(time * 25);
      ctx.fillStyle = `rgba(200,235,255,${0.5 + spray * 0.3})`;
      for (let i = 0; i < 4; i++) {
        ellipse(ctx, -0.95 - i * 0.12, 0.5 - i * 0.04 - spray * 0.03, 0.07 - i * 0.012, 0.05 - i * 0.008);
        ctx.fill();
      }
      break;
    }
    case 'hover': {
      const glow = 0.5 + 0.5 * Math.sin(time * 10);
      ctx.fillStyle = `rgba(80,255,230,${0.25 + glow * 0.25})`;
      ellipse(ctx, 0, 0.62, 0.7, 0.1);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.32);
      ctx.quadraticCurveTo(0, 0.6, 0.85, 0.3);
      ctx.quadraticCurveTo(0.2, 0.22, -0.8, 0.32);
      ctx.fill();
      ctx.fillStyle = '#e8fffc';
      ellipse(ctx, -0.35, 0.42, 0.06, 0.03);
      ctx.fill();
      ellipse(ctx, 0.35, 0.42, 0.06, 0.03);
      ctx.fill();
    }
  }
}

const ROCKET_Y = -0.48;
const ROCKET_X = -0.15;

function rocketSize(style: RocketStyle): { len: number; r: number } {
  switch (style) {
    case 'firework':
      return { len: 0.8, r: 0.12 };
    case 'soda':
      return { len: 0.8, r: 0.15 };
    case 'model':
      return { len: 0.95, r: 0.15 };
    case 'twin':
      return { len: 0.9, r: 0.11 };
    case 'ion':
      return { len: 0.9, r: 0.17 };
    case 'turbo':
      return { len: 1.05, r: 0.18 };
    case 'cola':
      return { len: 0.9, r: 0.15 };
    case 'kettle':
      return { len: 0.8, r: 0.22 };
    case 'afterburner':
      return { len: 1.2, r: 0.19 };
    default:
      return { len: 1.2, r: 0.2 };
  }
}

/** Where the exhaust comes out, in panda-local coordinates. */
export function nozzleOffset(style: RocketStyle): { x: number; y: number } {
  const { len } = rocketSize(style);
  return { x: ROCKET_X - len / 2 - 0.08, y: ROCKET_Y };
}

function rocketTube(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, r: number, body: string, accent: string, window: boolean) {
  const tail = cx - len / 2;
  const head = cx + len / 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(tail + 0.15, cy - r);
  ctx.lineTo(tail - 0.08, cy - r - 0.16);
  ctx.lineTo(tail, cy - r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(tail, cy - r, len - r, r * 2, 0.04);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(tail, cy + r * 0.3, len - r, r * 0.7);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(head - r, cy - r);
  ctx.quadraticCurveTo(head + r * 0.8, cy, head - r, cy + r);
  ctx.closePath();
  ctx.fill();
  if (window) {
    ctx.fillStyle = '#9fe3ff';
    ellipse(ctx, cx + 0.05, cy - 0.01, r * 0.45, r * 0.45);
    ctx.fill();
    ctx.strokeStyle = '#b8c0cc';
    ctx.lineWidth = 0.03;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(cx - 0.05, cy - r, 0.06, r * 2);
  }
  ctx.fillStyle = '#555a66';
  ctx.fillRect(tail - 0.07, cy - r * 0.6, 0.08, r * 1.2);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(tail + 0.15, cy + r);
  ctx.lineTo(tail - 0.08, cy + r + 0.13);
  ctx.lineTo(tail, cy + r * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawRocket(ctx: CanvasRenderingContext2D, style: RocketStyle, color: string, time: number) {
  const { len, r } = rocketSize(style);
  const cx = ROCKET_X;
  const cy = ROCKET_Y;
  switch (style) {
    case 'soda': {
      // A fizzy green bottle, cap first.
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(cx - len / 2, cy - r, len * 0.7, r * 2, 0.08);
      ctx.moveTo(cx + len * 0.2, cy - r);
      ctx.quadraticCurveTo(cx + len * 0.35, cy - r * 0.4, cx + len * 0.42, cy - r * 0.4);
      ctx.lineTo(cx + len * 0.42, cy + r * 0.4);
      ctx.quadraticCurveTo(cx + len * 0.35, cy + r * 0.4, cx + len * 0.2, cy + r);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e2493b';
      ctx.fillRect(cx + len * 0.42, cy - r * 0.45, 0.07, r * 0.9);
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - len * 0.3, cy - r * 0.55, len * 0.35, r * 1.1);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 3; i++) {
        ellipse(ctx, cx - len * 0.35 + ((time * 0.6 + i * 0.3) % 0.8), cy - r * 0.6 + i * 0.07, 0.02, 0.02);
        ctx.fill();
      }
      break;
    }
    case 'cola': {
      // Brown bottle, red label, foam frothing out the back when lit.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cx - len / 2, cy - r, len * 0.68, r * 2, 0.06);
      ctx.moveTo(cx + len * 0.18, cy - r);
      ctx.quadraticCurveTo(cx + len * 0.34, cy - r * 0.4, cx + len * 0.44, cy - r * 0.38);
      ctx.lineTo(cx + len * 0.44, cy + r * 0.38);
      ctx.quadraticCurveTo(cx + len * 0.34, cy + r * 0.4, cx + len * 0.18, cy + r);
      ctx.fill();
      ctx.fillStyle = '#e2493b';
      ctx.fillRect(cx - len * 0.32, cy - r, len * 0.36, r * 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${(r * 0.9).toFixed(2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('~', cx - len * 0.14, cy + r * 0.3);
      ctx.fillStyle = '#c9ced6';
      ctx.fillRect(cx + len * 0.44, cy - r * 0.42, 0.06, r * 0.84);
      break;
    }
    case 'kettle': {
      // A round kettle riding nose-first, spout pointing back.
      ctx.fillStyle = color;
      ellipse(ctx, cx, cy, len * 0.42, r);
      ctx.fill();
      ctx.strokeStyle = '#7d8794';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.fillStyle = '#7d8794';
      ctx.beginPath();
      ctx.moveTo(cx - len * 0.3, cy + r * 0.2);
      ctx.lineTo(cx - len * 0.62, cy - r * 0.15);
      ctx.lineTo(cx - len * 0.6, cy - r * 0.32);
      ctx.lineTo(cx - len * 0.25, cy - r * 0.15);
      ctx.fill();
      ctx.strokeStyle = '#1f1d24';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.9, r * 0.6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#e2493b';
      ellipse(ctx, cx, cy - r, 0.06, 0.04);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(ctx, cx + len * 0.15, cy - r * 0.35, 0.06, 0.035);
      ctx.fill();
      break;
    }
    case 'afterburner': {
      // Jet nacelle with intake ring and glowing exhaust rings.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + len / 2, cy - r);
      ctx.lineTo(cx - len / 2 + 0.1, cy - r * 0.8);
      ctx.lineTo(cx - len / 2, cy - r * 0.55);
      ctx.lineTo(cx - len / 2, cy + r * 0.55);
      ctx.lineTo(cx - len / 2 + 0.1, cy + r * 0.8);
      ctx.lineTo(cx + len / 2, cy + r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a2d33';
      ellipse(ctx, cx + len / 2, cy, 0.06, r);
      ctx.fill();
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 0.035;
      for (const dx of [-0.38, -0.3]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy - r * 0.75);
        ctx.lineTo(cx + dx, cy + r * 0.75);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(cx - len * 0.3, cy - r * 0.7, len * 0.7, r * 0.25);
      break;
    }
    case 'twin':
      rocketTube(ctx, cx, cy - r * 1.05, len, r, color, '#e2493b', false);
      rocketTube(ctx, cx + 0.05, cy + r * 1.05, len, r, color, '#e2493b', false);
      break;
    case 'thunder': {
      rocketTube(ctx, cx, cy, len, r, color, '#2f4fd1', true);
      // A lightning bolt decal and crackling arcs between the fins.
      ctx.fillStyle = '#2f4fd1';
      ctx.beginPath();
      ctx.moveTo(cx - 0.18, cy - r * 0.8);
      ctx.lineTo(cx - 0.3, cy + r * 0.05);
      ctx.lineTo(cx - 0.22, cy + r * 0.05);
      ctx.lineTo(cx - 0.3, cy + r * 0.8);
      ctx.lineTo(cx - 0.12, cy - r * 0.1);
      ctx.lineTo(cx - 0.2, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
      if (Math.sin(time * 23) > 0.2) {
        ctx.strokeStyle = 'rgba(160,220,255,0.9)';
        ctx.lineWidth = 0.025;
        ctx.beginPath();
        ctx.moveTo(cx - len / 2, cy - r - 0.1);
        ctx.lineTo(cx - len / 2 + 0.08, cy - r * 0.3);
        ctx.lineTo(cx - len / 2 - 0.02, cy + r * 0.2);
        ctx.lineTo(cx - len / 2 + 0.06, cy + r + 0.1);
        ctx.stroke();
      }
      break;
    }
    case 'ion': {
      rocketTube(ctx, cx, cy, len, r, '#dfe7f2', '#3a4a66', false);
      const glow = 0.5 + 0.5 * Math.sin(time * 12);
      ctx.strokeStyle = `rgba(79,195,255,${0.5 + glow * 0.5})`;
      ctx.lineWidth = 0.05;
      for (const dx of [-0.2, 0, 0.2]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy - r);
        ctx.lineTo(cx + dx, cy + r);
        ctx.stroke();
      }
      break;
    }
    default:
      rocketTube(
        ctx,
        cx,
        cy,
        len,
        r,
        color,
        style === 'firework' ? '#f2b705' : '#e2493b',
        style === 'turbo' || style === 'space',
      );
  }
  // Strap.
  ctx.strokeStyle = '#5a3b20';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(cx + 0.12, cy + r);
  ctx.lineTo(0.15, -0.2);
  ctx.stroke();
}

const FLAME_PALETTES = {
  fire: { glow: '255,120,30', mid: '255,190,70', core: '255,250,225' },
  ion: { glow: '60,130,255', mid: '130,210,255', core: '235,250,255' },
  steam: { glow: '200,225,255', mid: '235,245,255', core: '255,255,255' },
  magma: { glow: '255,60,20', mid: '255,140,40', core: '255,235,160' },
  thunder: { glow: '110,140,255', mid: '255,235,120', core: '255,255,255' },
};

/** Exhaust: additive glow, flickering tongues, a white-hot core and shock diamonds. */
function drawFlame(ctx: CanvasRenderingContext2D, style: RocketStyle, time: number, power: number) {
  const { len, r } = rocketSize(style);
  const fx = ROCKET_X - len / 2 - 0.05;
  const steamy = style === 'soda' || style === 'cola' || style === 'kettle';
  const pal =
    style === 'ion'
      ? FLAME_PALETTES.ion
      : steamy
        ? FLAME_PALETTES.steam
        : style === 'magma'
          ? FLAME_PALETTES.magma
          : style === 'thunder'
            ? FLAME_PALETTES.thunder
            : FLAME_PALETTES.fire;
  const ys = style === 'twin' ? [ROCKET_Y - r * 1.05, ROCKET_Y + r * 1.05] : [ROCKET_Y];
  const L = (0.9 + power * 1.4) * (style === 'cola' ? 1.4 : style === 'firework' ? 0.8 : 1);
  const W = Math.max(0.1, r * 0.95);
  ctx.save();
  ctx.globalCompositeOperation = steamy ? 'source-over' : 'lighter';
  for (const fy of ys) {
    // Soft outer glow.
    const glow = ctx.createRadialGradient(fx - L * 0.25, fy, 0, fx - L * 0.25, fy, L * 0.9);
    glow.addColorStop(0, `rgba(${pal.glow},${steamy ? 0.25 : 0.5})`);
    glow.addColorStop(1, `rgba(${pal.glow},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(fx - L * 1.2, fy - L * 0.9, L * 1.9, L * 1.8);
    // Flickering tongues of flame.
    for (let k = 0; k < 3; k++) {
      const flick = 0.75 + 0.25 * Math.sin(time * (47 + k * 13) + k * 2.1) + 0.12 * Math.sin(time * 91 + k);
      const tl = L * flick * (1 - k * 0.18);
      const tw = W * (1.1 - k * 0.25);
      const wob = Math.sin(time * 33 + k * 1.7) * tw * 0.25;
      ctx.fillStyle = k === 0 ? `rgba(${pal.glow},0.55)` : k === 1 ? `rgba(${pal.mid},0.75)` : `rgba(${pal.core},0.95)`;
      ctx.beginPath();
      ctx.moveTo(fx + 0.02, fy - tw);
      ctx.bezierCurveTo(fx - tl * 0.35, fy - tw * 1.1, fx - tl * 0.75, fy - tw * 0.4 + wob, fx - tl, fy + wob);
      ctx.bezierCurveTo(fx - tl * 0.75, fy + tw * 0.4 + wob, fx - tl * 0.35, fy + tw * 1.1, fx + 0.02, fy + tw);
      ctx.closePath();
      ctx.fill();
    }
    // Shock diamonds in a strong exhaust.
    if (!steamy && power > 0.45) {
      const n = power > 0.75 ? 4 : 3;
      for (let i = 1; i <= n; i++) {
        const cx = fx - (i / (n + 1)) * L * 0.95;
        const dw = W * 0.55 * (1 - i / (n + 2));
        const dl = L * 0.08;
        ctx.fillStyle = `rgba(${pal.core},${0.85 - i * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(cx + dl, fy);
        ctx.lineTo(cx, fy - dw);
        ctx.lineTo(cx - dl, fy);
        ctx.lineTo(cx, fy + dw);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawGliderBack(ctx: CanvasRenderingContext2D, style: GliderStyle, color: string, span: number, pose: PandaPose) {
  const c = span * 0.5; // visual chord
  const wy = style === 'parasol' ? -1.25 : -1.1;
  const flex = Math.sin(pose.time * 8) * 0.02 * pose.wind;
  // Struts down to the panda.
  ctx.strokeStyle = style === 'carbon' || style === 'bat' ? '#22252c' : '#7d8794';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  if (style === 'parasol') {
    ctx.moveTo(0.05, wy);
    ctx.lineTo(0.26, -0.6);
  } else {
    ctx.moveTo(0.05, wy + 0.08);
    ctx.lineTo(0.0, -0.3);
    ctx.moveTo(0.05, wy + 0.08);
    ctx.lineTo(0.26, -0.6);
    ctx.moveTo(0.05, wy + 0.08);
    ctx.lineTo(-0.35, -0.48);
  }
  ctx.stroke();

  ctx.save();
  ctx.translate(0.05, wy);
  switch (style) {
    case 'leaf': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0);
      ctx.quadraticCurveTo(0, -0.45 - flex, -c * 0.55, 0.05);
      ctx.quadraticCurveTo(0, 0.25 + flex, c * 0.55, 0);
      ctx.fill();
      ctx.strokeStyle = '#3d7d2a';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0);
      ctx.lineTo(-c * 0.62, 0.06);
      for (let i = -2; i <= 2; i++) {
        const x = i * c * 0.17;
        ctx.moveTo(x, 0.02);
        ctx.lineTo(x - 0.15, -0.14);
        ctx.moveTo(x, 0.02);
        ctx.lineTo(x - 0.12, 0.12);
      }
      ctx.stroke();
      break;
    }
    case 'parasol': {
      // A frilly umbrella canopy.
      const w = c * 0.75;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-w, 0.12);
      ctx.quadraticCurveTo(-w * 0.9, -0.55 - flex, 0, -0.62);
      ctx.quadraticCurveTo(w * 0.9, -0.55 + flex, w, 0.12);
      const n = 6;
      for (let i = n; i > 0; i--) {
        const x0 = -w + ((i - 1) / n) * w * 2;
        const x1 = -w + (i / n) * w * 2;
        ctx.quadraticCurveTo((x0 + x1) / 2, -0.04, x0, 0.12);
      }
      ctx.fill();
      ctx.strokeStyle = '#c4407a';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i <= 1; i++) {
        ellipse(ctx, i * w * 0.45, -0.3 + Math.abs(i) * 0.08, 0.06, 0.06);
        ctx.fill();
      }
      ctx.fillStyle = '#7a5532';
      ellipse(ctx, 0, -0.66, 0.05, 0.05);
      ctx.fill();
      break;
    }
    case 'paper': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c * 0.6, 0.02);
      ctx.lineTo(-c * 0.5, -0.32 - flex);
      ctx.lineTo(-c * 0.45, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7aa5d6';
      ctx.lineWidth = 0.025;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c * 0.6, 0.02);
      ctx.lineTo(-c * 0.48, -0.08);
      ctx.stroke();
      break;
    }
    case 'stunt': {
      // Short swept wing with racing chevrons.
      ctx.beginPath();
      ctx.moveTo(c * 0.6, 0.02);
      ctx.lineTo(-c * 0.35, -0.3 - flex);
      ctx.lineTo(-c * 0.6, -0.3 - flex);
      ctx.lineTo(-c * 0.4, 0.08);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        const x = -c * 0.3 + i * c * 0.25;
        ctx.beginPath();
        ctx.moveTo(x, 0.1);
        ctx.lineTo(x + 0.12, -0.12);
        ctx.lineTo(x + 0.04, -0.4);
        ctx.lineTo(x - 0.04, -0.4);
        ctx.lineTo(x + 0.04, -0.12);
        ctx.lineTo(x - 0.08, 0.1);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'hang': {
      ctx.beginPath();
      ctx.moveTo(c * 0.6, 0.05);
      ctx.quadraticCurveTo(0, -0.4 - flex, -c * 0.55, -0.05);
      ctx.lineTo(-c * 0.5, 0.1);
      ctx.quadraticCurveTo(0, -0.05, c * 0.6, 0.05);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffd23d';
      for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * c * 0.12, -0.6, c * 0.12, 1);
      ctx.restore();
      ctx.strokeStyle = '#a34d1f';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      break;
    }
    case 'bat': {
      // Scalloped membrane between finger bones.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0);
      ctx.quadraticCurveTo(c * 0.1, -0.5 - flex, -c * 0.6, -0.2);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x0 = -c * 0.6 + (i / n) * c * 1.15;
        const x1 = -c * 0.6 + ((i + 1) / n) * c * 1.15;
        ctx.quadraticCurveTo((x0 + x1) / 2, -0.02, x1, i === n - 1 ? 0 : -0.14);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2d1f47';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        ctx.moveTo(c * 0.3, -0.18);
        ctx.lineTo(-c * 0.6 + (i / n) * c * 1.15, -0.14);
      }
      ctx.stroke();
      break;
    }
    case 'feathers':
    case 'dragon': {
      const dragon = style === 'dragon';
      // Wing lifts on a beat, then settles.
      const beat = (pose.flap ?? 0) * 0.5;
      ctx.rotate(-beat * 0.6);
      const n = dragon ? 5 : 7;
      // Leading edge / arm bone.
      ctx.fillStyle = dragon ? color : '#7a5232';
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0.02);
      ctx.quadraticCurveTo(c * 0.1, (dragon ? -1.0 : -0.5) - flex - beat, -c * 0.62, (dragon ? -0.45 : -0.18) - beat * 0.5);
      if (dragon) {
        // Membrane scallops between spines.
        for (let i = 0; i < n; i++) {
          const x0 = -c * 0.62 + (i / n) * c * 1.15;
          const x1 = -c * 0.62 + ((i + 1) / n) * c * 1.15;
          ctx.quadraticCurveTo((x0 + x1) / 2, 0.02, x1, i === n - 1 ? 0.02 : -0.3);
        }
      } else {
        // Overlapping primary feathers.
        for (let i = 0; i <= n; i++) {
          const x = -c * 0.62 + (i / n) * c * 1.17;
          ctx.quadraticCurveTo(x - c * 0.06, 0.3, x + c * 0.02, 0.05);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = dragon ? '#1d5c40' : '#5a3b20';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      if (dragon) {
        ctx.strokeStyle = '#1d5c40';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        for (let i = 1; i < n; i++) {
          ctx.moveTo(c * 0.3, -0.5);
          ctx.lineTo(-c * 0.62 + (i / n) * c * 1.15, -0.3);
        }
        ctx.stroke();
        // Horned claw at the wrist.
        ctx.fillStyle = '#f2e3b3';
        ctx.beginPath();
        ctx.moveTo(c * 0.26, -0.62 - beat);
        ctx.lineTo(c * 0.4, -0.9 - beat);
        ctx.lineTo(c * 0.36, -0.58 - beat);
        ctx.fill();
      } else {
        ctx.fillStyle = '#c99a5b';
        ctx.beginPath();
        ctx.moveTo(c * 0.5, 0);
        ctx.quadraticCurveTo(0, -0.35 - beat, -c * 0.4, -0.08);
        ctx.quadraticCurveTo(0, -0.12, c * 0.5, 0);
        ctx.fill();
      }
      break;
    }
    case 'kite': {
      // A big two-tone stunt kite with ribs and streaming ribbons.
      const w = c * 0.62;
      ctx.beginPath();
      ctx.moveTo(w, 0.04);
      ctx.lineTo(0.1, -0.5 - flex);
      ctx.lineTo(-w, 0.0);
      ctx.lineTo(0.05, 0.1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.moveTo(0.1, -0.6);
      ctx.lineTo(-w, 0);
      ctx.lineTo(0.05, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#1b3f73';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w, 0.04);
      ctx.lineTo(-w, 0.0);
      ctx.moveTo(0.1, -0.5 - flex);
      ctx.lineTo(0.05, 0.1);
      ctx.stroke();
      // Ribbons off the trailing tip.
      ctx.lineWidth = 0.05;
      for (let k = 0; k < 2; k++) {
        ctx.strokeStyle = k ? '#ffd23d' : '#e2493b';
        ctx.beginPath();
        ctx.moveTo(-w, 0);
        for (let i = 1; i <= 6; i++) {
          const t = i / 6;
          ctx.lineTo(-w - t * (0.7 + pose.wind * 0.5), Math.sin(pose.time * 12 + t * 5 + k) * 0.08 * t + k * 0.06 + (1 - pose.wind) * t * 0.3);
        }
        ctx.stroke();
      }
      break;
    }
    case 'carbon': {
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0.02);
      ctx.bezierCurveTo(c * 0.45, -0.22, -c * 0.2, -0.24, -c * 0.6, 0.02);
      ctx.bezierCurveTo(-c * 0.2, 0.0, c * 0.3, 0.1, c * 0.55, 0.02);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#2ee6c8';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(c * 0.4, -0.08);
      ctx.bezierCurveTo(c * 0.2, -0.17, -c * 0.2, -0.16, -c * 0.45, -0.02);
      ctx.stroke();
      break;
    }
    default: {
      // Feathered albatross wing.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0);
      ctx.quadraticCurveTo(c * 0.1, -0.42 - flex, -c * 0.6, -0.1);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = -c * 0.6 + (i / n) * c * 1.15;
        ctx.quadraticCurveTo(x - c * 0.05, 0.2, x + c * 0.03, 0.04);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c6ccd6';
      ctx.lineWidth = 0.025;
      ctx.stroke();
      ctx.fillStyle = '#4a4f5a';
      ctx.beginPath();
      ctx.moveTo(-c * 0.6, -0.1);
      ctx.quadraticCurveTo(-c * 0.45, 0.12, -c * 0.3, 0.04);
      ctx.quadraticCurveTo(-c * 0.45, -0.05, -c * 0.6, -0.1);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Flying carpet the panda rides on, rippling in the wind. */
function drawCarpet(ctx: CanvasRenderingContext2D, color: string, pose: PandaPose) {
  const n = 12;
  const len = 2.4;
  const wave = (i: number) => Math.sin(pose.time * 9 - i * 0.7) * 0.05 * (0.4 + pose.wind);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = len / 2 - (i / n) * len;
    const y = 0.56 + wave(i);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = n; i >= 0; i--) ctx.lineTo(len / 2 - (i / n) * len, 0.68 + wave(i));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Border and pattern.
  ctx.strokeStyle = '#f2b705';
  ctx.lineWidth = 0.03;
  ctx.stroke();
  ctx.fillStyle = '#f2b705';
  for (let i = 2; i < n - 1; i += 3) {
    const x = len / 2 - (i / n) * len;
    ellipse(ctx, x, 0.62 + wave(i), 0.06, 0.03);
    ctx.fill();
  }
  // Tassels.
  ctx.strokeStyle = '#f2b705';
  ctx.beginPath();
  for (const [i, sign] of [
    [0, 1],
    [n, -1],
  ] as const) {
    const x = len / 2 - (i / n) * len;
    for (let k = 0; k < 3; k++) {
      ctx.moveTo(x, 0.58 + k * 0.04 + wave(i));
      ctx.lineTo(x + sign * 0.12, 0.6 + k * 0.05 + wave(i));
    }
  }
  ctx.stroke();
}

/** Propeller beanie: a striped cap with a spinning rotor. */
function drawBeanie(ctx: CanvasRenderingContext2D, color: string, pose: PandaPose, frame: number) {
  const head = headAt(frame);
  const hx = head.x;
  const hy = head.y - 0.32;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(hx, hy + 0.05, 0.3, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e2493b';
  ctx.beginPath();
  ctx.arc(hx, hy + 0.05, 0.3, Math.PI * 1.33, Math.PI * 1.66);
  ctx.lineTo(hx, hy + 0.05);
  ctx.fill();
  ctx.fillStyle = '#2f7de1';
  ctx.fillRect(hx - 0.31, hy + 0.02, 0.62, 0.06);
  ctx.fillStyle = '#7d8794';
  ctx.fillRect(hx - 0.02, hy - 0.4, 0.04, 0.16);
  // Rotor blades seen edge-on: their visible length cycles as they spin.
  const spin = Math.cos(pose.time * 40);
  ctx.fillStyle = '#e2493b';
  ellipse(ctx, hx, hy - 0.42, 0.5 * Math.abs(spin) + 0.05, 0.04);
  ctx.fill();
  ctx.fillStyle = '#1f1d24';
  ellipse(ctx, hx, hy - 0.42, 0.04, 0.04);
  ctx.fill();
}

function drawGliderArms(ctx: CanvasRenderingContext2D) {
  // An arm reaching up from the shoulder to the control bar, behind the head.
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.12, -0.08);
  ctx.quadraticCurveTo(0.1, -0.38, 0.25, -0.58);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.27;
  ctx.stroke();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 0.19;
  ctx.stroke();
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.04;
  ellipse(ctx, 0.26, -0.61, 0.11, 0.1);
  ctx.fill();
  ctx.stroke();
}
