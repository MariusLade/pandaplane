import type { Loadout } from '../game/upgrades';
import { GLIDERS, ROCKETS, SLEDS } from '../game/upgrades';

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

  const gliderTier = GLIDERS.indexOf(gear.glider);
  const rocketTier = ROCKETS.indexOf(gear.rocket);
  const sledTier = SLEDS.indexOf(gear.sled);

  if (rocketTier > 0 && pose.boosting) drawFlame(ctx, pose.time);
  drawScarf(ctx, pose);
  if (gliderTier > 0) drawGliderBack(ctx, gliderTier, gear.glider.color, gear.glider.span, pose);
  if (rocketTier > 0) drawRocket(ctx, rocketTier, gear.rocket.color);
  drawBody(ctx, pose, gliderTier > 0);
  drawSled(ctx, sledTier, gear.sled.color, pose.time);
  drawHead(ctx, pose);
  if (gliderTier > 0) drawGliderArms(ctx);

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

function drawSled(ctx: CanvasRenderingContext2D, tier: number, color: string, time: number) {
  ctx.lineWidth = 0.04;
  switch (tier) {
    case 0: {
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
    case 1: {
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
    case 2: {
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
    case 3: {
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(-0.75, 0.46);
      ctx.lineTo(0.6, 0.46);
      ctx.quadraticCurveTo(0.85, 0.46, 0.85, 0.3);
      ctx.stroke();
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(-0.4, 0.46);
      ctx.lineTo(-0.35, 0.3);
      ctx.moveTo(0.35, 0.46);
      ctx.lineTo(0.3, 0.3);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-0.7, 0.22, 1.35, 0.12, 0.05);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.4, 0.26, 0.7, 0.03);
      break;
    }
    case 4: {
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
    default: {
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

function drawRocket(ctx: CanvasRenderingContext2D, tier: number, color: string) {
  const len = 0.8 + tier * 0.08;
  const r = 0.13 + tier * 0.015;
  const cx = -0.15;
  const cy = -0.48;
  const tail = cx - len / 2;
  const head = cx + len / 2;
  // Fins.
  ctx.fillStyle = tier === 1 ? '#f2b705' : '#e2493b';
  ctx.beginPath();
  ctx.moveTo(tail + 0.15, cy - r);
  ctx.lineTo(tail - 0.08, cy - r - 0.18);
  ctx.lineTo(tail, cy - r * 0.4);
  ctx.closePath();
  ctx.fill();
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(tail, cy - r, len - r, r * 2, 0.04);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(tail, cy + r * 0.3, len - r, r * 0.7);
  // Nose cone.
  ctx.fillStyle = tier === 1 ? '#f2f2f2' : '#e2493b';
  ctx.beginPath();
  ctx.moveTo(head - r, cy - r);
  ctx.quadraticCurveTo(head + r * 0.8, cy, head - r, cy + r);
  ctx.closePath();
  ctx.fill();
  // Window / stripe.
  if (tier >= 3) {
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
  // Nozzle & lower fin.
  ctx.fillStyle = '#555a66';
  ctx.fillRect(tail - 0.07, cy - r * 0.6, 0.08, r * 1.2);
  ctx.fillStyle = tier === 1 ? '#f2b705' : '#e2493b';
  ctx.beginPath();
  ctx.moveTo(tail + 0.15, cy + r);
  ctx.lineTo(tail - 0.08, cy + r + 0.14);
  ctx.lineTo(tail, cy + r * 0.4);
  ctx.closePath();
  ctx.fill();
  // Strap.
  ctx.strokeStyle = '#5a3b20';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(cx + 0.12, cy + r);
  ctx.lineTo(0.15, -0.2);
  ctx.stroke();
}

function drawFlame(ctx: CanvasRenderingContext2D, time: number) {
  const fx = -0.15 - 0.6 - 0.05;
  const fy = -0.48;
  const f = 0.8 + Math.sin(time * 60) * 0.15 + Math.sin(time * 37) * 0.1;
  const layers: [string, number, number][] = [
    ['rgba(255,90,40,0.85)', 1.0, 0.2],
    ['rgba(255,180,60,0.95)', 0.7, 0.14],
    ['rgba(255,250,200,1)', 0.4, 0.08],
  ];
  for (const [c, l, w] of layers) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(fx, fy - w);
    ctx.quadraticCurveTo(fx - l * f * 0.6, fy - w * 0.8, fx - l * f, fy);
    ctx.quadraticCurveTo(fx - l * f * 0.6, fy + w * 0.8, fx, fy + w);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGliderBack(ctx: CanvasRenderingContext2D, tier: number, color: string, span: number, pose: PandaPose) {
  const c = span * 0.5; // visual chord
  const wy = -1.05 - tier * 0.04;
  const flex = Math.sin(pose.time * 8) * 0.02 * pose.wind;
  // Struts down to the panda.
  ctx.strokeStyle = tier === 4 ? '#22252c' : '#7d8794';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(0.05, wy + 0.08);
  ctx.lineTo(0.0, -0.3);
  ctx.moveTo(0.05, wy + 0.08);
  ctx.lineTo(0.55, -0.5);
  ctx.moveTo(0.05, wy + 0.08);
  ctx.lineTo(-0.35, -0.48);
  ctx.stroke();

  ctx.save();
  ctx.translate(0.05, wy);
  switch (tier) {
    case 1: {
      // Leaf.
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
    case 2: {
      // Paper plane wing.
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
    case 3: {
      // Hang glider sail with stripes.
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
    case 4: {
      // Sleek carbon airfoil.
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
