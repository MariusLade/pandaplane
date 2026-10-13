import { buildRamp } from '../game/ramp';
import { FUELS, RAMPS, type Category, type FuelItem, type Item, type Loadout, type RampItem } from '../game/upgrades';
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
  category: Category,
  item: Item,
  base: Loadout,
  time: number,
): void {
  const s = setup(canvas);
  if (!s) return;
  const { ctx, w, h } = s;
  if (category === 'ramp') return drawRampPreview(ctx, w, h, item as RampItem);
  if (category === 'fuel') return drawFuelPreview(ctx, w, h, item as FuelItem);

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
