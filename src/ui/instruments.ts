import { clamp, damp } from '../core/math';
import type { Flight } from '../game/flight';
import { sensorFeatures } from '../game/upgrades';
import { $ } from './dom';

/**
 * Cockpit instruments, tucked into the two bottom corners of the screen.
 * Each equipped sensor becomes its own chunky cartoon dial — paper face, ink
 * outline, sticker shadow and a name tag — matching the rest of the UI. There
 * is no shared panel behind them. Flight-attitude gauges sit bottom-left,
 * height and energy gauges bottom-right.
 */
type Gauge = 'asi' | 'vsi' | 'alt' | 'radar' | 'pitch' | 'attitude' | 'aoa' | 'fuel' | 'lcd' | 'wind';
type Lamp = 'stall' | 'terrain';
type Side = 'left' | 'right';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const INK = '#2a2340';
const INK_SOFT = '#5b5577';
const PAPER = '#fff8ec';
const PAPER_2 = '#f6e7cb';
const NEEDLE = '#ff7a3d';
const GOOD = '#5aa54a';
const WARN = '#ffc93c';
const BAD = '#e2493b';
const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';

/** Which corner each gauge lives in, nearest-the-corner first. */
const LEFT: Gauge[] = ['lcd', 'asi', 'attitude', 'pitch', 'aoa'];
const RIGHT: Gauge[] = ['alt', 'radar', 'vsi', 'fuel', 'wind'];

const TAG: Record<Gauge, [string, string]> = {
  asi: ['SPEED', '#4aa3ee'],
  vsi: ['CLIMB', GOOD],
  alt: ['ALTITUDE', '#ff7a3d'],
  radar: ['HEIGHT', '#20c5b5'],
  pitch: ['PITCH', '#f2b705'],
  attitude: ['HORIZON', '#4a6fd1'],
  aoa: ['STALL', '#9b5de5'],
  fuel: ['FUEL', BAD],
  lcd: ['WRIST', '#3a3f4b'],
  wind: ['WIND', '#20a4f3'],
};

/** Small gauges drop their dial numbers to stay readable. */
let compact = false;

interface Cluster {
  side: Side;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gauges: Gauge[];
  lamp: Lamp | null;
  /** Gauge centres in canvas pixels. */
  slots: { g: Gauge; x: number; y: number }[];
  lampAt: { x: number; y: number; w: number } | null;
  w: number;
  h: number;
}

export class InstrumentPanel {
  private clusters: Cluster[];
  private size = 100;
  private dpr = 1;
  private visible = false;
  /** Needles lag a little, like real instruments. */
  private smooth = new Map<string, number>();

  constructor() {
    this.clusters = (['left', 'right'] as Side[]).map((side) => {
      const canvas = $(`#instruments-${side}`) as HTMLCanvasElement;
      return { side, canvas, ctx: canvas.getContext('2d')!, gauges: [], lamp: null, slots: [], lampAt: null, w: 0, h: 0 };
    });
  }

  configure(f: Flight): void {
    const has = sensorFeatures(f.gear);
    const wrist = f.gear.sensors.some((s) => s.style === 'watch');
    const g = new Set<Gauge>();
    if (wrist) g.add('lcd');
    if (has.has('speed') && !wrist) g.add('asi');
    if (has.has('climb')) g.add('vsi');
    if (has.has('horizon')) g.add('attitude');
    else if (has.has('pitch') && !wrist) g.add('pitch');
    if (has.has('altitude') && !wrist) g.add('alt');
    if (has.has('agl')) g.add('radar');
    if (has.has('aoa')) g.add('aoa');
    if (has.has('fuel') && f.maxFuel > 0) g.add('fuel');
    if (has.has('wind')) g.add('wind');
    const [left, right] = this.clusters;
    left.gauges = LEFT.filter((x) => g.has(x));
    right.gauges = RIGHT.filter((x) => g.has(x));
    left.lamp = has.has('stallHorn') ? 'stall' : null;
    right.lamp = has.has('proximity') ? 'terrain' : null;
    this.smooth.clear();
    this.layout();
  }

  show(visible: boolean): void {
    this.visible = visible;
    for (const c of this.clusters) c.canvas.hidden = !visible || (c.gauges.length === 0 && !c.lamp);
    if (visible) this.layout();
  }

  layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const touch = !($('#touch') as HTMLElement).hidden || matchMedia('(pointer: coarse)').matches;
    // Portrait phones: lift the clusters above the thumb buttons.
    const narrow = touch && vw < 640;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const D = clamp(Math.min(vw * 0.11, vh * 0.17), 58, 112);
    this.size = D;
    const gap = Math.round(D * 0.12);
    const tagH = D * 0.2;
    const cell = D + gap;
    const rowH = D + tagH + gap * 0.6;
    // Each corner may use a bit over a third of the width.
    const avail = vw * (narrow ? 0.48 : 0.36) - (touch && !narrow ? 120 : 0);
    const perRow = Math.max(1, Math.min(3, Math.floor((avail + gap) / cell)));
    for (const c of this.clusters) {
      const n = c.gauges.length;
      const cols = Math.min(n, perRow) || 1;
      const rows = Math.ceil(n / perRow);
      const lampH = c.lamp ? D * 0.3 + gap : 0;
      const pad = 6;
      c.w = Math.max(cols * cell - gap, c.lamp ? D * 1.1 : 0) + pad * 2;
      c.h = rows * rowH + lampH + pad * 2;
      c.slots = c.gauges.map((g, i) => {
        // Fill from the corner outward and upward.
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const x = c.side === 'left' ? pad + col * cell + D / 2 : c.w - pad - col * cell - D / 2;
        const y = c.h - pad - row * rowH - tagH - D / 2;
        return { g, x, y };
      });
      const lw = D * 1.1;
      c.lampAt = c.lamp ? { x: c.side === 'left' ? pad : c.w - pad - lw, y: pad, w: lw } : null;
      c.canvas.width = Math.round(c.w * this.dpr);
      c.canvas.height = Math.round(c.h * this.dpr);
      c.canvas.style.width = `${c.w}px`;
      c.canvas.style.height = `${c.h}px`;
      c.canvas.classList.toggle('raised', narrow);
      c.canvas.classList.toggle('beside-pad', touch && !narrow);
    }
  }

  private value(key: string, target: number, dt: number, rate = 8): number {
    const prev = this.smooth.get(key);
    const v = prev === undefined ? target : damp(prev, target, rate, dt);
    this.smooth.set(key, v);
    return v;
  }

  draw(f: Flight, time: number, dt: number): void {
    if (!this.visible) return;
    const D = this.size;
    compact = D < 76;
    const flying = f.phase === 'air' && !f.onGround;
    for (const c of this.clusters) {
      if (c.canvas.hidden) continue;
      const ctx = c.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, c.w, c.h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (c.lamp && c.lampAt) {
        const agl = f.altitudeAboveGround - 0.45;
        const on = c.lamp === 'stall' ? flying && f.stalled : flying && agl < 25 && f.vy < -8;
        lamp(ctx, c.lampAt.x, c.lampAt.y, c.lampAt.w, D * 0.3, c.lamp === 'stall' ? 'STALL!' : 'TERRAIN!', on, time);
      }
      c.slots.forEach((s, i) => {
        // A slight sticker tilt, alternating, so the cluster feels hand-placed.
        const tilt = (i % 2 ? 1 : -1) * (c.side === 'left' ? 1 : -1) * 0.035;
        this.drawGauge(s.g, ctx, s.x, s.y, D, tilt, f, time, dt);
      });
    }
  }

  private drawGauge(g: Gauge, ctx: CanvasRenderingContext2D, cx: number, cy: number, D: number, tilt: number, f: Flight, time: number, dt: number) {
    const r = D * 0.4;
    const [name, color] = TAG[g];
    if (g === 'lcd') {
      lcd(ctx, cx, cy, D, f, color);
      tag(ctx, cx, cy + D * 0.43, name, color, D, tilt);
      return;
    }
    dial(ctx, cx, cy, r, color);
    const kmh = f.speed * 3.6;
    switch (g) {
      case 'asi': {
        const a = (v: number) => 0.75 * Math.PI + (clamp(v, 0, 600) / 600) * 1.5 * Math.PI;
        const minGlide = f.gear.glider.design.minSpeed * 3.6 || 60;
        band(ctx, cx, cy, r * 0.8, a(minGlide), a(350), GOOD);
        band(ctx, cx, cy, r * 0.8, a(350), a(520), WARN);
        band(ctx, cx, cy, r * 0.8, a(520), a(600), BAD);
        ticks(ctx, cx, cy, r, 0, 600, 0.75 * Math.PI, 2.25 * Math.PI, 100, 50, (v) => String(v / 100));
        small(ctx, cx, cy - r * 0.3, '×100 km/h', r);
        readout(ctx, cx, cy + r * 0.5, String(Math.round(kmh)), r);
        needle(ctx, cx, cy, a(this.value('asi', kmh, dt)), r * 0.78);
        break;
      }
      case 'vsi': {
        const vy = f.phase === 'air' ? f.vy : 0;
        const a = (v: number) => Math.PI + (clamp(v, -30, 30) / 30) * 0.8 * Math.PI;
        band(ctx, cx, cy, r * 0.8, a(-30), a(-12), BAD);
        band(ctx, cx, cy, r * 0.8, a(2), a(30), GOOD);
        ticks(ctx, cx, cy, r, -30, 30, Math.PI - 0.8 * Math.PI, Math.PI + 0.8 * Math.PI, 10, 5, (v) => String(Math.abs(v)));
        small(ctx, cx + r * 0.3, cy - r * 0.38, '▲ up', r);
        small(ctx, cx + r * 0.3, cy + r * 0.4, '▼ down', r);
        needle(ctx, cx, cy, a(this.value('vsi', vy, dt, 5)), r * 0.8);
        break;
      }
      case 'alt': {
        const alt = Math.max(0, f.y);
        ticks(ctx, cx, cy, r, 0, 1000, -Math.PI / 2, 1.5 * Math.PI, 100, 50, (v) => (v < 1000 ? String(v / 100) : ''));
        readout(ctx, cx, cy + r * 0.42, `${Math.round(alt)} m`, r);
        const smooth = this.value('alt', alt, dt, 6);
        needle(ctx, cx, cy, -Math.PI / 2 + (smooth / 10000) * TAU, r * 0.5, INK_SOFT, 1.5);
        needle(ctx, cx, cy, -Math.PI / 2 + ((smooth % 1000) / 1000) * TAU, r * 0.8);
        break;
      }
      case 'radar': {
        const agl = Math.max(0, f.altitudeAboveGround - 0.45);
        // Square-root scale: fine detail near the ground.
        const a = (v: number) => 0.75 * Math.PI + Math.sqrt(clamp(v, 0, 300) / 300) * 1.5 * Math.PI;
        band(ctx, cx, cy, r * 0.8, a(0), a(15), BAD);
        band(ctx, cx, cy, r * 0.8, a(15), a(40), WARN);
        for (const v of [0, 10, 25, 50, 100, 200, 300]) {
          tick(ctx, cx, cy, r, a(v), 0.17, 2);
          label(ctx, cx, cy, r * 0.58, a(v), String(v), r, v === 0 || v === 300);
        }
        readout(ctx, cx, cy + r * 0.5, agl > 999 ? '999+' : `${Math.round(agl)} m`, r);
        needle(ctx, cx, cy, a(this.value('radar', agl, dt, 6)), r * 0.78);
        break;
      }
      case 'pitch': {
        for (let d = -90; d <= 90; d += 15) {
          const ang = (-d * Math.PI) / 180;
          const major = d % 45 === 0;
          tick(ctx, cx, cy, r, ang, major ? 0.2 : 0.11, major ? 2.2 : 1.4);
          tick(ctx, cx, cy, r, Math.PI - ang, major ? 0.2 : 0.11, major ? 2.2 : 1.4);
        }
        ctx.strokeStyle = 'rgba(42,35,64,0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, cy);
        ctx.lineTo(cx + r * 0.75, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        const p = this.value('pitch', f.pitch, dt, 10);
        plane(ctx, cx, cy, r * 0.55, -p);
        readout(ctx, cx, cy + r * 0.52, signed(p * DEG), r);
        break;
      }
      case 'attitude': {
        const p = this.value('att', f.pitch, dt, 10);
        const path = f.phase === 'air' && Math.hypot(f.vx, f.vy) > 1 ? Math.atan2(f.vy, f.vx) : f.pitch;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.94, 0, TAU);
        ctx.clip();
        ctx.translate(cx, cy);
        ctx.rotate(p);
        const sky = ctx.createLinearGradient(0, -r, 0, 0);
        sky.addColorStop(0, '#4aa3ee');
        sky.addColorStop(1, '#a8dcff');
        ctx.fillStyle = sky;
        ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 1.5);
        const ground = ctx.createLinearGradient(0, 0, 0, r);
        ground.addColorStop(0, '#8fcf6a');
        ground.addColorStop(1, '#4f9a3c');
        ctx.fillStyle = ground;
        ctx.fillRect(-r * 1.5, 0, r * 3, r * 1.5);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-r * 1.5, 0);
        ctx.lineTo(r * 1.5, 0);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(42,35,64,0.55)';
        ctx.lineWidth = 1.5;
        for (const d of [-20, -10, 10, 20]) {
          const yy = (-d / 30) * r;
          const half = Math.abs(d) === 10 ? r * 0.16 : r * 0.28;
          ctx.beginPath();
          ctx.moveTo(-half, yy);
          ctx.lineTo(half, yy);
          ctx.stroke();
        }
        ctx.restore();
        // Fixed symbol: wings with a little panda head in the middle.
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(3, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy);
        ctx.lineTo(cx - r * 0.2, cy);
        ctx.moveTo(cx + r * 0.2, cy);
        ctx.lineTo(cx + r * 0.6, cy);
        ctx.stroke();
        ctx.strokeStyle = NEEDLE;
        ctx.lineWidth = Math.max(1.5, r * 0.05);
        ctx.stroke();
        miniPanda(ctx, cx, cy, r * 0.17);
        // Flight path marker: where the panda is actually going, relative to the nose.
        const rel = this.value('fpm', Math.atan2(Math.sin(path - p), Math.cos(path - p)), dt, 10);
        const mx = cx + Math.cos(-rel) * r * 0.62;
        const my = cy + Math.sin(-rel) * r * 0.62;
        for (const [w, col] of [
          [4, INK],
          [2, '#ffffff'],
        ] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.arc(mx, my, r * 0.09, 0, TAU);
          ctx.moveTo(mx - r * 0.22, my);
          ctx.lineTo(mx - r * 0.09, my);
          ctx.moveTo(mx + r * 0.09, my);
          ctx.lineTo(mx + r * 0.22, my);
          ctx.moveTo(mx, my - r * 0.09);
          ctx.lineTo(mx, my - r * 0.18);
          ctx.stroke();
        }
        break;
      }
      case 'aoa': {
        const stall = f.gear.glider.stallDeg;
        const max = Math.ceil((stall * 1.4) / 5) * 5;
        const a = (v: number) => Math.PI + (clamp(v, 0, max) / max) * Math.PI;
        band(ctx, cx, cy, r * 0.8, a(0), a(stall * 0.7), GOOD);
        band(ctx, cx, cy, r * 0.8, a(stall * 0.7), a(stall), WARN);
        band(ctx, cx, cy, r * 0.8, a(stall), a(max), BAD);
        ticks(ctx, cx, cy, r, 0, max, Math.PI, TAU, 10, 5, (v) => String(v));
        const aoa = f.phase === 'air' && !f.onGround ? Math.abs(f.angleOfAttack) * DEG : 0;
        readout(ctx, cx, cy + r * 0.42, `${Math.round(aoa)}°`, r);
        needle(ctx, cx, cy, a(this.value('aoa', aoa, dt, 10)), r * 0.8);
        break;
      }
      case 'fuel': {
        const frac = f.maxFuel > 0 ? f.fuel / f.maxFuel : 0;
        const a = (v: number) => 1.2 * Math.PI + v * 0.6 * Math.PI;
        band(ctx, cx, cy, r * 0.8, a(0), a(0.2), BAD);
        band(ctx, cx, cy, r * 0.8, a(0.2), a(1), GOOD);
        for (let i = 0; i <= 4; i++) tick(ctx, cx, cy, r, a(i / 4), i % 2 ? 0.11 : 0.2, i % 2 ? 1.4 : 2.2);
        label(ctx, cx, cy, r * 0.56, a(0), 'E', r, true);
        label(ctx, cx, cy, r * 0.56, a(1), 'F', r, true);
        // A little fuel-pump icon.
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(cx - r * 0.09, cy + r * 0.08, r * 0.18, r * 0.2, r * 0.03);
        ctx.fill();
        readout(ctx, cx, cy + r * 0.5, `${f.fuel.toFixed(1)}s`, r);
        needle(ctx, cx, cy, a(this.value('fuel', frac, dt, 10)), r * 0.74);
        if (frac < 0.2 && f.maxFuel > 0 && Math.sin(time * 10) > 0) {
          ctx.fillStyle = BAD;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy - r * 0.52, r * 0.08, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        break;
      }
      case 'wind': {
        const w = this.value('wind', f.wind, dt, 4);
        for (let i = 0; i < 12; i++) tick(ctx, cx, cy, r, (i / 12) * TAU, i % 3 ? 0.08 : 0.16, i % 3 ? 1.2 : 2);
        windsock(ctx, cx, cy - r * 0.08, r, w, time);
        readout(ctx, cx, cy + r * 0.5, `${w >= 0 ? '▶' : '◀'} ${Math.abs(Math.round(w))}`, r);
        break;
      }
    }
    gloss(ctx, cx, cy, r);
    tag(ctx, cx, cy + r * 1.08, name, color, D, tilt);
  }
}

const signed = (deg: number) => {
  const d = Math.round(deg);
  return `${d > 0 ? '+' : ''}${d}°`;
};

// ------------------------------------------------------------ drawing kit

/** Bezel, sticker shadow and paper face. */
function dial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const R = r * 1.12;
  // Offset "sticker" shadow, like the cards and buttons.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + 3, cy + 3, R, 0, TAU);
  ctx.fill();
  // Coloured bezel.
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Bezel shine.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.06, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  // Paper face.
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, PAPER);
  g.addColorStop(1, PAPER_2);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

/** A cartoon glass glint over the face. */
function gloss(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, Math.PI * 1.12, Math.PI * 1.32);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(Math.PI * 1.4) * r * 0.78, cy + Math.sin(Math.PI * 1.4) * r * 0.78, r * 0.035, 0, TAU);
  ctx.fill();
}

/** A name sticker under the dial, slightly tilted. */
function tag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, D: number, tilt: number) {
  const size = clamp(D * 0.12, 9, 13);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.55;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(text, 1, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function tick(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number, len: number, width: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * r * (0.86 - len), cy + Math.sin(a) * r * (0.86 - len));
  ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, cx: number, cy: number, rr: number, a: number, text: string, r: number, keep = false) {
  if (compact && !keep) return;
  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.max(9, r * 0.22)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 1);
}

function ticks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  min: number,
  max: number,
  a0: number,
  a1: number,
  major: number,
  minor: number,
  fmt: (v: number) => string,
) {
  for (let v = min; v <= max + 1e-6; v += minor) {
    const a = a0 + ((v - min) / (max - min)) * (a1 - a0);
    const m = (v - min) % major;
    const isMajor = Math.abs(m) < 1e-6 || Math.abs(m - major) < 1e-6;
    tick(ctx, cx, cy, r, a, isMajor ? 0.2 : 0.1, isMajor ? 2.4 : 1.3);
    if (isMajor) label(ctx, cx, cy, r * 0.56, a, fmt(v), r, v === min || v === max);
  }
}

function band(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, color: string) {
  if (a1 <= a0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
  ctx.lineCap = 'round';
}

/** A chunky outlined needle with a hub cap. */
function needle(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, len: number, color = NEEDLE, width = 1) {
  const w = Math.max(3, len * 0.13) * width;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-len * 0.2, 0);
  ctx.quadraticCurveTo(-len * 0.2, -w / 2, 0, -w / 2);
  ctx.lineTo(len, 0);
  ctx.lineTo(0, w / 2);
  ctx.quadraticCurveTo(-len * 0.2, w / 2, -len * 0.2, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, len * 0.13), 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 1, Math.max(1.5, len * 0.045), 0, TAU);
  ctx.fill();
}

function small(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, r: number) {
  if (compact) return;
  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 ${Math.max(8, r * 0.17)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Number in a little ink pill. */
function readout(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, r: number) {
  const size = Math.max(10, r * 0.26);
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 0.8;
  const h = size * 1.3;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#ffd86b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

/** Paper-plane symbol for the pitch gauge, rotated by the nose angle. */
function plane(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, angle: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = NEEDLE;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(-len * 0.8, -len * 0.42);
  ctx.lineTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.8, len * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb27a';
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.8, len * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A tiny panda face, the "aircraft" in the artificial horizon. */
function miniPanda(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = INK;
  for (const ex of [-0.75, 0.75]) {
    ctx.beginPath();
    ctx.arc(x + ex * s, y - 0.75 * s, s * 0.42, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const ex of [-0.38, 0.38]) {
    ctx.beginPath();
    ctx.ellipse(x + ex * s, y - 0.05 * s, s * 0.24, s * 0.32, ex * 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(x, y + 0.38 * s, s * 0.15, s * 0.1, 0, 0, TAU);
  ctx.fill();
}

/** A striped windsock that streams with the wind. */
function windsock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, wind: number, time: number) {
  const dir = wind >= 0 ? 1 : -1;
  const strength = clamp(Math.abs(wind) / 18, 0, 1);
  const pole = cx - dir * r * 0.42;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pole, cy + r * 0.32);
  ctx.lineTo(pole, cy - r * 0.32);
  ctx.stroke();
  const len = r * 0.82;
  const droop = (1 - strength) * 0.9;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const pt = (t: number) => {
      const a = droop * t * 1.2;
      const wob = Math.sin(time * 12 + t * 5) * r * 0.03 * strength;
      return [pole + dir * Math.cos(a) * len * t, cy - r * 0.28 + Math.sin(a) * len * t + wob];
    };
    const w0 = r * 0.16 * (1 - t0 * 0.45);
    const w1 = r * 0.16 * (1 - t1 * 0.45);
    const [x0, y0] = pt(t0);
    const [x1, y1] = pt(t1);
    ctx.fillStyle = i % 2 ? '#ffffff' : BAD;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - w0);
    ctx.lineTo(x1, y1 - w1);
    ctx.lineTo(x1, y1 + w1);
    ctx.lineTo(x0, y0 + w0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Warning light: an outlined pill that glows and wobbles when lit. */
function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, on: boolean, time: number) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 14);
  ctx.save();
  const jx = on ? Math.sin(time * 40) * 1.2 : 0;
  ctx.translate(jx, 0);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 3, h - 3, h / 2);
  ctx.fill();
  if (on) {
    ctx.shadowColor = `rgba(255,70,50,${0.5 + 0.5 * pulse})`;
    ctx.shadowBlur = 10 + 10 * pulse;
  }
  ctx.fillStyle = on ? BAD : '#efe1c8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w - 3, h - 3, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.font = `700 ${h * 0.5}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#ffffff' : 'rgba(42,35,64,0.35)';
  ctx.fillText(text, x + (w - 3) / 2, y + (h - 3) / 2 + 1);
  ctx.restore();
}

/** The Wrist Computer: a chunky toy watch with a green LCD. */
function lcd(ctx: CanvasRenderingContext2D, cx: number, cy: number, D: number, f: Flight, color: string) {
  const w = D;
  const h = D * 0.72;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Strap stubs.
  ctx.fillStyle = '#ff7a3d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  for (const sy of [y - h * 0.18, y + h * 0.86]) {
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.28, sy, w * 0.56, h * 0.32, 4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w, h, h * 0.22);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h * 0.22);
  ctx.fill();
  ctx.stroke();
  const ix = x + h * 0.12;
  const iy = y + h * 0.13;
  const iw = w - h * 0.24;
  const ih = h * 0.74;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, '#c4e39a');
  g.addColorStop(1, '#93b866');
  ctx.fillStyle = g;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 6);
  ctx.fill();
  ctx.stroke();
  const rows: [string, string][] = [
    ['SPD', `${Math.round(f.speed * 3.6)}`],
    ['ALT', `${Math.round(Math.max(0, f.y))}`],
    ['PIT', signed(f.pitch * DEG)],
  ];
  const size = ih * 0.22;
  ctx.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'middle';
  rows.forEach(([k, v], i) => {
    const ry = iy + ih * (0.2 + i * 0.3);
    ctx.fillStyle = 'rgba(40,60,20,0.12)';
    ctx.textAlign = 'right';
    ctx.fillText('8888', ix + iw - size * 0.4, ry);
    ctx.fillStyle = '#20301a';
    ctx.textAlign = 'left';
    ctx.fillText(k, ix + size * 0.4, ry);
    ctx.textAlign = 'right';
    ctx.fillText(v, ix + iw - size * 0.4, ry);
  });
}
