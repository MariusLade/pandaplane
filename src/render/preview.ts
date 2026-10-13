import { buildRamp } from '../game/ramp';
import { CATALOG, FUELS, loadoutFor, type Category, type Levels } from '../game/upgrades';
import { drawPanda } from './panda';

/** Draws a small illustration of an upgrade tier into a canvas (hangar cards). */
export function drawPreview(canvas: HTMLCanvasElement, category: Category, tier: number, levels: Levels, time: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 160;
  const h = canvas.clientHeight || 90;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  tier = Math.min(tier, CATALOG[category].length - 1);

  if (category === 'ramp') {
    const tierData = loadoutFor({ ...levels, ramp: tier }).ramp;
    const ramp = buildRamp(tierData, 0);
    const s = Math.min((w * 0.8) / (ramp.lip.x - ramp.top.x), (h * 0.72) / ramp.top.y);
    const ox = w * 0.5 + ((ramp.lip.x - ramp.top.x) * s) / 2;
    const oy = h * 0.9;
    ctx.strokeStyle = '#8a5a32';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < ramp.points.length; i += 6) {
      const p = ramp.points[i];
      ctx.beginPath();
      ctx.moveTo(ox + p.x * s, oy - p.y * s);
      ctx.lineTo(ox + p.x * s, oy);
      ctx.stroke();
    }
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ramp.points.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * s, oy - p.y * s) : ctx.moveTo(ox + p.x * s, oy - p.y * s)));
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, oy, w, h - oy);
    ctx.fillStyle = '#1d2340';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${tierData.height} m drop`, w - 8, 18);
    return;
  }

  if (category === 'fuel') {
    const frac = FUELS[tier].seconds / FUELS[FUELS.length - 1].seconds;
    const tw = w * 0.34;
    const th = h * 0.7;
    const x = (w - tw) / 2;
    const y = (h - th) / 2;
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
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${FUELS[tier].seconds}s`, w / 2, y + th / 2 + 5);
    return;
  }

  const gear = loadoutFor({ ...levels, [category]: tier });
  if (category !== 'glider') gear.glider = loadoutFor({ ...levels, glider: 0 }).glider;
  if (category !== 'rocket') gear.rocket = loadoutFor({ ...levels, rocket: 0 }).rocket;
  const span = category === 'glider' ? gear.glider.span * 0.5 + 1.6 : 2.4;
  const scale = Math.min((w * 0.85) / span, h / (category === 'glider' ? 2.3 : 1.7));
  drawPanda(ctx, w / 2, h * (category === 'glider' ? 0.66 : 0.55), scale, gear, {
    angle: 0.08,
    time,
    speed: 10,
    boosting: category === 'rocket' && tier > 0,
    mood: 'happy',
    wind: 0.6,
  });
}
