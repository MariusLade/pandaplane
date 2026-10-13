import { buildRamp } from '../game/ramp';
import {
  FUELS,
  RAMPS,
  type FuelItem,
  type GadgetItem,
  type Item,
  type WeaponItem,
  type Loadout,
  type RampItem,
  type SensorItem,
  type ShopCategory,
} from '../game/upgrades';
import { mountainHeight } from '../game/world';
import { drawPanda } from './panda';

function setup(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 160;
  const h = canvas.clientHeight || 90;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const INK = '#2a2340';
const maxRamp = RAMPS[RAMPS.length - 1];
const maxFuel = FUELS.reduce((m, f) => Math.max(m, f.seconds), 0);

function drawRampPreview(ctx: CanvasRenderingContext2D, w: number, h: number, item: RampItem) {
  // Same scale for every ramp so sizes compare at a glance.
  const big = buildRamp(maxRamp);
  const s = Math.min((w * 0.86) / -big.top.x, (h * 0.8) / big.top.y);
  const ox = w * 0.92;
  const oy = h * 0.92;
  // Mountain silhouette.
  ctx.fillStyle = '#e3edf8';
  ctx.beginPath();
  ctx.moveTo(ox + 10, oy);
  for (let x = 0; x >= big.top.x - 10; x -= 2) ctx.lineTo(ox + x * s, oy - mountainHeight(x) * s);
  ctx.lineTo(0, oy);
  ctx.closePath();
  ctx.fill();
  const ramp = buildRamp(item);
  ctx.strokeStyle = '#8a5a32';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ramp.points.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * s, oy - p.y * s) : ctx.moveTo(ox + p.x * s, oy - p.y * s)));
  ctx.stroke();
  const top = ramp.top;
  ctx.fillStyle = '#e2493b';
  ctx.beginPath();
  ctx.moveTo(ox + top.x * s, oy - top.y * s - 12);
  ctx.lineTo(ox + top.x * s - 8, oy - top.y * s - 9);
  ctx.lineTo(ox + top.x * s, oy - top.y * s - 6);
  ctx.fill();
  ctx.fillRect(ox + top.x * s - 0.5, oy - top.y * s - 12, 1.5, 12);
  // Launch angle arrow at the lip.
  const a = (item.launchDeg * Math.PI) / 180;
  ctx.strokeStyle = '#2f7de1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox, oy - ramp.lip.y * s);
  ctx.lineTo(ox + Math.cos(a) * 16, oy - ramp.lip.y * s - Math.sin(a) * 16);
  ctx.stroke();
}

function drawFuelPreview(ctx: CanvasRenderingContext2D, w: number, h: number, item: FuelItem) {
  if (item.style === 'solar') {
    // A tilted solar panel with a little battery.
    const pw = w * 0.5;
    const ph = h * 0.45;
    ctx.save();
    ctx.translate(w / 2, h * 0.45);
    ctx.transform(1, 0, -0.35, 1, 0, 0);
    ctx.fillStyle = '#1f3c88';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#7fb2ff';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + (pw * i) / 4, -ph / 2);
      ctx.lineTo(-pw / 2 + (pw * i) / 4, ph / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-pw / 2, 0);
    ctx.lineTo(pw / 2, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#3a3f4b';
    ctx.fillRect(w / 2 - 3, h * 0.66, 6, h * 0.2);
    return;
  }
  if (item.style === 'nitro') {
    const tw = w * 0.18;
    const th = h * 0.72;
    const x = (w - tw) / 2;
    const y = (h - th) / 2 + 4;
    ctx.fillStyle = '#e2493b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, tw / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(x + tw * 0.25, y - 8, tw * 0.5, 9);
    ctx.save();
    ctx.translate(w / 2, h / 2 + 4);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NITRO', 0, 0);
    ctx.restore();
    return;
  }
  const frac = item.seconds / maxFuel;
  const heavy = Math.min(1, item.weight / 30);
  const tw = w * (0.22 + heavy * 0.18);
  const th = h * 0.72;
  const x = (w - tw) / 2;
  const y = (h - th) / 2 + 4;
  ctx.fillStyle = '#3a3f4b';
  ctx.beginPath();
  ctx.roundRect(x, y, tw, th, 8);
  ctx.fill();
  const fh = (th - 8) * frac;
  const g = ctx.createLinearGradient(0, y + th, 0, y);
  g.addColorStop(0, '#ff7a3d');
  g.addColorStop(1, '#ffd23d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + th - 4 - fh, tw - 8, fh, 5);
  ctx.fill();
  ctx.fillStyle = '#e2493b';
  ctx.fillRect(x + tw * 0.3, y - 6, tw * 0.4, 8);
}

/** Draws a small illustration of one shop item, worn by the panda where that makes sense. */
export function drawItemPreview(
  canvas: HTMLCanvasElement,
  category: ShopCategory,
  item: Item,
  base: Loadout,
  time: number,
): void {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  if (category === 'ramp') return drawRampPreview(ctx, w, h, item as RampItem);
  if (category === 'fuel') return drawFuelPreview(ctx, w, h, item as FuelItem);
  if (category === 'sensor') return drawSensorPreview(ctx, w, h, item as SensorItem, time);
  if (category === 'weapon') return drawWeaponPreview(ctx, w, h, item as WeaponItem, time);
  if (category === 'gadget') return badge(ctx, w / 2, h / 2, Math.min(w, h) * 0.34, (item as GadgetItem).color, GADGET_ICON[(item as GadgetItem).style], time);

  // Show the item on its own: other categories fall back to their basics.
  const gear: Loadout = {
    ...base,
    glider: category === 'glider' ? (item as Loadout['glider']) : { ...base.glider, style: 'none' },
    rocket: category === 'rocket' ? (item as Loadout['rocket']) : { ...base.rocket, style: 'none' },
    sled: category === 'sled' ? (item as Loadout['sled']) : base.sled,
  };
  const isGlider = category === 'glider' && gear.glider.style !== 'none';
  const span = isGlider ? gear.glider.span * 0.5 + 1.6 : 2.5;
  const scale = Math.min((w * 0.85) / span, h / (isGlider ? 2.4 : 1.7));
  drawPanda(ctx, w / 2 + (category === 'rocket' ? scale * 0.25 : 0), h * (isGlider ? 0.68 : 0.56), scale, gear, {
    angle: 0.08,
    time,
    speed: 10,
    boosting: category === 'rocket' && gear.rocket.style !== 'none',
    mood: 'happy',
    wind: 0.6,
  });
}


/** One sensor gadget, drawn from primitives, centred at (cx, cy) with radius r. */
export function drawSensorGadget(ctx: CanvasRenderingContext2D, item: SensorItem, cx: number, cy: number, r: number, time: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = INK;
  const wobble = Math.sin(time * 2 + cx) * 0.25;
  const dial = (face: string, needle: number) => {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
      ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e2493b';
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needle) * r * 0.6, cy + Math.sin(needle) * r * 0.6);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (item.style) {
    case 'dial':
      dial('#fff8ec', -Math.PI / 4 + wobble);
      break;
    case 'gauge': {
      // Half-moon fuel gauge with E/F marks.
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.35, r, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff8ec';
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.35, r * 0.75, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = `700 ${Math.round(r * 0.32)}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('E', cx - r * 0.5, cy + r * 0.25);
      ctx.fillText('F', cx + r * 0.5, cy + r * 0.25);
      const a = Math.PI + Math.PI * (0.65 + wobble * 0.3);
      ctx.strokeStyle = '#e2493b';
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.35);
      ctx.lineTo(cx + Math.cos(a) * r * 0.65, cy + r * 0.35 + Math.sin(a) * r * 0.65);
      ctx.stroke();
      break;
    }
    case 'level': {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(cx - r * 1.3, cy - r * 0.45, r * 2.6, r * 0.9, r * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bff0a8';
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.8, cy - r * 0.22, r * 1.6, r * 0.44, r * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx + wobble * r * 0.8, cy, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'horn': {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.9, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.8);
      ctx.lineTo(cx - r * 0.9, cy + r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(cx - r * 1.1, cy - r * 0.3, r * 0.25, r * 0.6);
      ctx.strokeStyle = '#e2493b';
      const pulse = (time * 2) % 1;
      for (let i = 0; i < 2; i++) {
        ctx.globalAlpha = 1 - ((pulse + i * 0.5) % 1);
        ctx.beginPath();
        ctx.arc(cx + r * 0.6, cy, r * (0.4 + ((pulse + i * 0.5) % 1) * 0.6), -0.7, 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'watch': {
      ctx.fillStyle = '#555a66';
      ctx.fillRect(cx - r * 0.35, cy - r * 1.3, r * 0.7, r * 2.6);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.85, cy - r * 0.75, r * 1.7, r * 1.5, r * 0.3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9fe3a0';
      ctx.fillRect(cx - r * 0.62, cy - r * 0.52, r * 1.24, r * 1.04);
      ctx.fillStyle = INK;
      ctx.font = `700 ${Math.round(r * 0.3)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('88', cx, cy - r * 0.15);
      ctx.fillText(`+${Math.round(10 + wobble * 20)}°`, cx, cy + r * 0.3);
      break;
    }
    case 'pitot': {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(cx - r * 1.3, cy - r * 0.18, r * 2.2, r * 0.36, r * 0.18);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx + r * 0.2, cy, r * 0.25, r * 0.9);
      ctx.strokeRect(cx + r * 0.2, cy + r * 0.18, r * 0.25, r * 0.72);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx - r * 1.3, cy, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,35,64,0.4)';
      for (let i = 0; i < 3; i++) {
        const x = cx - r * 1.5 - ((time * 40 + i * 12) % 30);
        ctx.beginPath();
        ctx.moveTo(x, cy - r * 0.5 + i * r * 0.5);
        ctx.lineTo(x - r * 0.4, cy - r * 0.5 + i * r * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'radar': {
      ctx.fillStyle = INK;
      ctx.fillRect(cx - r * 0.08, cy, r * 0.16, r * 0.9);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.1, r * 0.95, r * 0.45, -0.3, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = item.color;
      const pulse = (time * 1.5) % 1;
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.2, r * (0.6 + pulse * 0.7), 0.4, Math.PI - 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'ball': {
      // Attitude indicator: sky/ground ball that tilts.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(wobble * 0.6);
      ctx.fillStyle = '#7cc4ff';
      ctx.fillRect(-r, -r, r * 2, r);
      ctx.fillStyle = '#c58a52';
      ctx.fillRect(-r, 0, r * 2, r);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = r * 0.18;
      ctx.stroke();
      ctx.strokeStyle = '#ff7a3d';
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy);
      ctx.lineTo(cx - r * 0.15, cy);
      ctx.lineTo(cx, cy + r * 0.15);
      ctx.lineTo(cx + r * 0.15, cy);
      ctx.lineTo(cx + r * 0.55, cy);
      ctx.stroke();
      break;
    }
    case 'vane': {
      dial('#f3ecff', Math.PI * (1.6 + wobble * 0.4));
      ctx.fillStyle = '#e2493b';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, -0.35, 0.35);
      ctx.arc(cx, cy, r * 0.5, 0.35, -0.35, true);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Shop card illustration for a sensor. */
function drawSensorPreview(ctx: CanvasRenderingContext2D, w: number, h: number, item: SensorItem, time: number) {
  drawSensorGadget(ctx, item, w / 2, h / 2, Math.min(w, h) * 0.32, time);
}

/** The hangar tile: every equipped sensor side by side. */
export function drawSensorRack(canvas: HTMLCanvasElement, sensors: SensorItem[], time: number): void {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  if (!sensors.length) {
    ctx.fillStyle = 'rgba(42,35,64,0.45)';
    ctx.font = '600 14px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No instruments. Flying blind!', w / 2, h / 2 + 5);
    return;
  }
  const n = sensors.length;
  const cell = w / n;
  const r = Math.min(cell * 0.36, h * 0.32);
  sensors.forEach((item, i) => drawSensorGadget(ctx, item, cell * (i + 0.5), h / 2, r, time));
}

const WEAPON_ICON: Record<WeaponItem['style'], string> = {
  none: '🐾',
  peas: '🫛',
  sling: '🌰',
  crackers: '🧨',
  bees: '🐝',
  snow: '❄️',
  laser: '🧐',
};

const GADGET_ICON: Record<GadgetItem['style'], string> = {
  magnet: '🧲',
  charm: '🍀',
  belt: '🎒',
  radar: '📡',
  shield: '🫧',
  helmet: '⛑️',
  suit: '🧑‍🚒',
};

/** A round coloured badge with an icon, gently bobbing. */
function badge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, icon: string, time: number) {
  const bob = Math.sin(time * 2 + cx) * 2;
  ctx.fillStyle = 'rgba(42,35,64,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 4, r * 0.8, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy + bob - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${Math.round(r * 1.1)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(icon, cx, cy + bob + r * 0.06);
}

/** Weapon badge with a little stream of projectiles. */
function drawWeaponPreview(ctx: CanvasRenderingContext2D, w: number, h: number, item: WeaponItem, time: number) {
  const r = Math.min(w, h) * 0.32;
  const cx = w * 0.32;
  const cy = h / 2;
  if (item.rate > 0) {
    if (item.hitscan) {
      ctx.strokeStyle = `rgba(255,59,107,${0.5 + 0.5 * Math.sin(time * 12)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(w - 6, cy);
      ctx.stroke();
    } else {
      const n = Math.min(5, Math.ceil(item.rate));
      for (let i = 0; i < n; i++) {
        const t = (time * 0.8 + i / n) % 1;
        const x = cx + r + t * (w - cx - r - 8);
        const y = cy + (item.gravity ? t * t * h * 0.3 - t * h * 0.15 : item.homing ? Math.sin(t * 12 + i) * 6 : 0);
        ctx.fillStyle = item.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, item.blast ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  badge(ctx, cx, cy, r, item.rate > 0 ? item.color : '#dfe3ef', WEAPON_ICON[item.style], time);
}

/** The hangar tile: worn gadgets side by side. */
export function drawGadgetRack(canvas: HTMLCanvasElement, gadgets: GadgetItem[], time: number): void {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  if (!gadgets.length) {
    ctx.fillStyle = 'rgba(42,35,64,0.45)';
    ctx.font = '600 14px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Empty pockets', w / 2, h / 2 + 5);
    return;
  }
  const cell = w / gadgets.length;
  gadgets.forEach((g, i) => badge(ctx, cell * (i + 0.5), h / 2 - 3, Math.min(cell * 0.3, h * 0.3), g.color, GADGET_ICON[g.style], time));
}
