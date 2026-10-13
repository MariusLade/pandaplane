import type { GliderStyle, Loadout, RocketStyle, SledStyle } from '../game/upgrades';

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
}

const BLACK = '#1f1d24';
const WHITE = '#fbfbf7';
const SHADOW = '#d9dde3';

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

  const hasGlider = gear.glider.style !== 'none';
  const hasRocket = gear.rocket.style !== 'none';

  if (hasRocket && pose.boosting) drawFlame(ctx, gear.rocket.style, pose.time);
  drawScarf(ctx, pose);
  if (hasGlider) drawGliderBack(ctx, gear.glider.style, gear.glider.color, gear.glider.span, pose);
  if (hasRocket) drawRocket(ctx, gear.rocket.style, gear.rocket.color, pose.time);
  drawBody(ctx, pose, hasGlider);
  drawSled(ctx, gear.sled.style, gear.sled.color, pose.time);
  drawHead(ctx, pose);
  if (hasGlider) drawGliderArms(ctx);

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
    ctx.moveTo(0.42, -0.12 + k * 0.06);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = 0.42 - t * len - k * 0.1;
      const droop = (1 - pose.wind) * t * 0.35;
      const y = -0.16 + k * 0.08 + droop + Math.sin(pose.time * 14 + t * 6 + k) * amp * t;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = k ? '#b8302a' : '#e2493b';
    ctx.lineWidth = 0.11;
    ctx.stroke();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, pose: PandaPose, holdingBar: boolean) {
  // Far legs.
  ctx.fillStyle = '#121116';
  ellipse(ctx, -0.5, 0.06, 0.22, 0.13, 0.3);
  ctx.fill();
  if (!holdingBar) {
    ellipse(ctx, 0.62, 0.18, 0.2, 0.11, -0.3);
    ctx.fill();
  }

  // Torso.
  ctx.fillStyle = WHITE;
  ellipse(ctx, 0, 0, 0.6, 0.38);
  ctx.fill();
  ctx.save();
  ellipse(ctx, 0, 0, 0.6, 0.38);
  ctx.clip();
  ctx.fillStyle = SHADOW;
  ellipse(ctx, -0.05, 0.28, 0.65, 0.2);
  ctx.fill();
  ctx.fillStyle = BLACK;
  ellipse(ctx, 0.3, 0.02, 0.17, 0.45, -0.15);
  ctx.fill();
  ctx.restore();

  // Tail.
  ctx.fillStyle = WHITE;
  ellipse(ctx, -0.6, -0.16, 0.09, 0.08);
  ctx.fill();

  // Near legs.
  ctx.fillStyle = BLACK;
  const kick = Math.sin(pose.time * 9) * 0.06 * (pose.mood === 'scared' ? 1 : 0.2);
  ellipse(ctx, -0.46, 0.2 + kick, 0.24, 0.14, 0.2);
  ctx.fill();
  if (!holdingBar) {
    const reach = pose.boosting ? 0.1 : 0;
    ellipse(ctx, 0.62 + reach, 0.26 - reach, 0.24, 0.12, -0.4 + reach * 3);
    ctx.fill();
  }
}

function drawHead(ctx: CanvasRenderingContext2D, pose: PandaPose) {
  const hx = 0.74;
  const hy = -0.2;
  ctx.fillStyle = BLACK;
  ellipse(ctx, hx - 0.24, hy - 0.25, 0.12, 0.11);
  ctx.fill();
  ellipse(ctx, hx + 0.24, hy - 0.25, 0.12, 0.11);
  ctx.fill();

  ctx.fillStyle = WHITE;
  ellipse(ctx, hx, hy, 0.36, 0.32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.03;
  ctx.stroke();

  // Eye patches.
  ctx.fillStyle = BLACK;
  ellipse(ctx, hx - 0.13, hy - 0.01, 0.09, 0.12, 0.5);
  ctx.fill();
  ellipse(ctx, hx + 0.13, hy - 0.01, 0.09, 0.12, -0.5);
  ctx.fill();

  // Eyes.
  if (pose.mood === 'dizzy') {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.035;
    for (const ex of [hx - 0.12, hx + 0.12]) {
      ctx.beginPath();
      ctx.moveTo(ex - 0.04, hy - 0.05);
      ctx.lineTo(ex + 0.04, hy + 0.03);
      ctx.moveTo(ex + 0.04, hy - 0.05);
      ctx.lineTo(ex - 0.04, hy + 0.03);
      ctx.stroke();
    }
  } else if (pose.mood === 'sleepy') {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.03;
    for (const ex of [hx - 0.12, hx + 0.12]) {
      ctx.beginPath();
      ctx.arc(ex, hy - 0.02, 0.035, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  } else {
    const big = pose.mood === 'scared' ? 0.05 : 0.04;
    for (const ex of [hx - 0.115, hx + 0.125]) {
      ctx.fillStyle = WHITE;
      ellipse(ctx, ex, hy - 0.02, big, big * 1.1);
      ctx.fill();
      ctx.fillStyle = BLACK;
      ellipse(ctx, ex + 0.012, hy - 0.015, big * 0.55, big * 0.6);
      ctx.fill();
      ctx.fillStyle = WHITE;
      ellipse(ctx, ex + 0.002, hy - 0.035, big * 0.2, big * 0.2);
      ctx.fill();
    }
  }

  // Cheeks.
  ctx.fillStyle = 'rgba(255,130,150,0.45)';
  ellipse(ctx, hx - 0.21, hy + 0.12, 0.06, 0.04);
  ctx.fill();
  ellipse(ctx, hx + 0.21, hy + 0.12, 0.06, 0.04);
  ctx.fill();

  // Nose & mouth.
  ctx.fillStyle = BLACK;
  ellipse(ctx, hx, hy + 0.1, 0.05, 0.035);
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 0.025;
  if (pose.mood === 'scared') {
    ctx.fillStyle = '#5b1f2a';
    ellipse(ctx, hx, hy + 0.2, 0.04, 0.055);
    ctx.fill();
  } else if (pose.mood === 'excited') {
    ctx.fillStyle = '#5b1f2a';
    ctx.beginPath();
    ctx.moveTo(hx - 0.08, hy + 0.15);
    ctx.quadraticCurveTo(hx, hy + 0.3, hx + 0.08, hy + 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7f8f';
    ellipse(ctx, hx, hy + 0.21, 0.035, 0.02);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx, hy + 0.13);
    ctx.lineTo(hx, hy + 0.16);
    ctx.moveTo(hx - 0.06, hy + 0.15);
    ctx.quadraticCurveTo(hx - 0.03, hy + 0.19, hx, hy + 0.16);
    ctx.quadraticCurveTo(hx + 0.03, hy + 0.19, hx + 0.06, hy + 0.15);
    ctx.stroke();
  }
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
    case 'twin':
      rocketTube(ctx, cx, cy - r * 1.05, len, r, color, '#e2493b', false);
      rocketTube(ctx, cx + 0.05, cy + r * 1.05, len, r, color, '#e2493b', false);
      break;
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

function drawFlame(ctx: CanvasRenderingContext2D, style: RocketStyle, time: number) {
  const { len, r } = rocketSize(style);
  const fx = ROCKET_X - len / 2 - 0.05;
  const f = 0.8 + Math.sin(time * 60) * 0.15 + Math.sin(time * 37) * 0.1;
  const ion = style === 'ion';
  const soda = style === 'soda';
  const layers: [string, number, number][] = ion
    ? [
        ['rgba(60,140,255,0.7)', 1.1, 0.16],
        ['rgba(140,220,255,0.9)', 0.75, 0.1],
        ['rgba(235,250,255,1)', 0.4, 0.05],
      ]
    : soda
      ? [
          ['rgba(220,255,230,0.75)', 0.9, 0.16],
          ['rgba(255,255,255,0.95)', 0.5, 0.09],
        ]
      : [
          ['rgba(255,90,40,0.85)', 1.0, 0.2],
          ['rgba(255,180,60,0.95)', 0.7, 0.14],
          ['rgba(255,250,200,1)', 0.4, 0.08],
        ];
  const ys = style === 'twin' ? [ROCKET_Y - r * 1.05, ROCKET_Y + r * 1.05] : [ROCKET_Y];
  const size = style === 'space' ? 1.3 : style === 'firework' ? 0.8 : 1;
  for (const fy of ys) {
    for (const [c, l, w] of layers) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(fx, fy - w * size);
      ctx.quadraticCurveTo(fx - l * f * 0.6 * size, fy - w * 0.8 * size, fx - l * f * size, fy);
      ctx.quadraticCurveTo(fx - l * f * 0.6 * size, fy + w * 0.8 * size, fx, fy + w * size);
      ctx.closePath();
      ctx.fill();
    }
  }
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
    ctx.lineTo(0.5, -0.45);
  } else {
    ctx.moveTo(0.05, wy + 0.08);
    ctx.lineTo(0.0, -0.3);
    ctx.moveTo(0.05, wy + 0.08);
    ctx.lineTo(0.55, -0.5);
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

function drawGliderArms(ctx: CanvasRenderingContext2D) {
  // Arms reaching up to the control bar.
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(0.35, -0.05);
  ctx.lineTo(0.5, -0.45);
  ctx.stroke();
  ctx.fillStyle = BLACK;
  ellipse(ctx, 0.52, -0.5, 0.1, 0.1);
  ctx.fill();
}
