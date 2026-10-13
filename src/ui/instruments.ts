import { clamp, damp } from '../core/math';
import type { Flight } from '../game/flight';
import { sensorFeatures } from '../game/upgrades';
import { $ } from './dom';

/**
 * The cockpit instrument panel along the bottom of the screen. Each equipped
 * sensor becomes a skeuomorphic gauge drawn on one canvas: airspeed, vertical
 * speed, altimeter, radar altimeter, pitch, attitude indicator, AoA, fuel, the
 * wrist computer's LCD, and warning lamps.
 */
type Gauge = 'asi' | 'vsi' | 'alt' | 'radar' | 'pitch' | 'attitude' | 'aoa' | 'fuel' | 'lcd';
type Lamp = 'stall' | 'terrain';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const FACE = '#14151a';
const MARK = '#f2f2ee';
const LABEL_FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const DIGIT_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
/** Small gauges drop their dial numbers and titles to stay readable. */
let compact = false;

export class InstrumentPanel {
  private canvas = $('#instruments') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;
  private gauges: Gauge[] = [];
  private lamps: Lamp[] = [];
  private size = 100;
  private dpr = 1;
  private w = 0;
  private h = 0;
  /** Needles lag a little, like real instruments. */
  private smooth = new Map<string, number>();

  configure(f: Flight): void {
    const has = sensorFeatures(f.gear);
    const wrist = f.gear.sensors.some((s) => s.style === 'watch');
    const g: Gauge[] = [];
    if (wrist) g.push('lcd');
    if (has.has('speed') && !wrist) g.push('asi');
    if (has.has('climb')) g.push('vsi');
    if (has.has('horizon')) g.push('attitude');
    else if (has.has('pitch') && !wrist) g.push('pitch');
    if (has.has('altitude') && !wrist) g.push('alt');
    if (has.has('agl')) g.push('radar');
    if (has.has('aoa')) g.push('aoa');
    if (has.has('fuel') && f.maxFuel > 0) g.push('fuel');
    this.gauges = g;
    this.lamps = [];
    if (has.has('stallHorn')) this.lamps.push('stall');
    if (has.has('proximity')) this.lamps.push('terrain');
    this.smooth.clear();
    this.layout();
  }

  show(visible: boolean): void {
    this.canvas.hidden = !visible || (this.gauges.length === 0 && this.lamps.length === 0);
  }

  layout(): void {
    const n = this.gauges.reduce((s, g) => s + (g === 'lcd' ? 1.5 : 1), 0);
    const touch = matchMedia('(pointer: coarse)').matches;
    // On narrow touch screens the panel sits above the touch buttons and uses
    // the full width; otherwise it leaves the corners free for them.
    const narrow = touch && window.innerWidth < 640;
    this.canvas.classList.toggle('raised', narrow);
    const avail = Math.min(window.innerWidth - (narrow ? 16 : touch ? 250 : 32), 980);
    const gap = 8;
    this.size = n ? clamp((avail - 24) / n - gap, narrow ? 40 : 62, 118) : 0;
    const lampH = this.lamps.length ? 30 : 0;
    this.w = Math.max(n * (this.size + gap) - gap + 24, this.lamps.length * 96 + 24);
    this.h = (n ? this.size + 20 : 8) + lampH;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  private value(key: string, target: number, dt: number, rate = 8): number {
    const prev = this.smooth.get(key);
    const v = prev === undefined ? target : damp(prev, target, rate, dt);
    this.smooth.set(key, v);
    return v;
  }

  draw(f: Flight, time: number, dt: number): void {
    if (this.canvas.hidden) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    panel(ctx, 1.5, 1.5, this.w - 3, this.h - 3);

    const flying = f.phase === 'air' && !f.onGround;
    let y = 10;
    if (this.lamps.length) {
      const lw = 84;
      let x = (this.w - (this.lamps.length * (lw + 10) - 10)) / 2;
      for (const lamp of this.lamps) {
        const agl = f.altitudeAboveGround - 0.45;
        const on = lamp === 'stall' ? flying && f.stalled : flying && agl < 25 && f.vy < -8;
        annunciator(ctx, x, y, lw, 20, lamp === 'stall' ? 'STALL' : 'TERRAIN', on, 0.6 + 0.4 * Math.sin(time * 14));
        x += lw + 10;
      }
      y += 28;
    }

    const D = this.size;
    let x = 12;
    for (const g of this.gauges) {
      const wide = g === 'lcd' ? D * 1.5 : D;
      this.drawGauge(g, ctx, x, y, D, wide, f, time, dt);
      x += wide + 8;
    }
  }

  private drawGauge(g: Gauge, ctx: CanvasRenderingContext2D, x: number, y: number, D: number, wide: number, f: Flight, time: number, dt: number) {
    const cx = x + D / 2;
    const cy = y + D / 2;
    const r = D * 0.44;
    compact = D < 72;
    const kmh = f.speed * 3.6;
    switch (g) {
      case 'lcd':
        return lcd(ctx, x, y, wide, D, f);
      case 'asi': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const a = (v: number) => 0.75 * Math.PI + (clamp(v, 0, 600) / 600) * 1.5 * Math.PI;
        const minGlide = f.gear.glider.design.minSpeed * 3.6 || 60;
        band(ctx, cx, cy, r * 0.86, a(minGlide), a(350), '#3fbf5a');
        band(ctx, cx, cy, r * 0.86, a(350), a(520), '#f2c230');
        band(ctx, cx, cy, r * 0.86, a(520), a(600), '#e2493b');
        ticks(ctx, cx, cy, r, 0, 600, 0.75 * Math.PI, 2.25 * Math.PI, 100, 20, (v) => String(v / 10));
        title(ctx, cx, cy - r * 0.32, 'AIRSPEED');
        title(ctx, cx, cy - r * 0.18, 'km/h ×10', 0.8);
        digital(ctx, cx, cy + r * 0.42, String(Math.round(kmh)).padStart(3, ' '), r);
        needle(ctx, cx, cy, a(this.value('asi', kmh, dt)), r * 0.8);
        return glass(ctx, cx, cy, r);
      }
      case 'vsi': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const vy = f.phase === 'air' ? f.vy : 0;
        const a = (v: number) => Math.PI + (clamp(v, -30, 30) / 30) * 0.8 * Math.PI;
        ticks(ctx, cx, cy, r, -30, 30, Math.PI - 0.8 * Math.PI, Math.PI + 0.8 * Math.PI, 10, 5, (v) => String(Math.abs(v)));
        title(ctx, cx + r * 0.18, cy - r * 0.36, 'UP ▲', 0.85);
        title(ctx, cx + r * 0.18, cy + r * 0.46, 'DN ▼', 0.85);
        title(ctx, cx + r * 0.25, cy + r * 0.05, 'VERT m/s', 0.75);
        needle(ctx, cx, cy, a(this.value('vsi', vy, dt, 5)), r * 0.82);
        return glass(ctx, cx, cy, r);
      }
      case 'alt': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const alt = Math.max(0, f.y);
        ticks(ctx, cx, cy, r, 0, 1000, -Math.PI / 2, 1.5 * Math.PI, 100, 20, (v) => (v < 1000 ? String(v / 100) : ''));
        title(ctx, cx, cy - r * 0.3, 'ALT');
        digital(ctx, cx, cy + r * 0.38, `${String(Math.round(alt)).padStart(4, '0')}m`, r);
        const smooth = this.value('alt', alt, dt, 6);
        needle(ctx, cx, cy, -Math.PI / 2 + (smooth / 10000) * TAU, r * 0.5, 5, '#f2f2ee');
        needle(ctx, cx, cy, -Math.PI / 2 + ((smooth % 1000) / 1000) * TAU, r * 0.82);
        return glass(ctx, cx, cy, r);
      }
      case 'radar': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const agl = Math.max(0, f.altitudeAboveGround - 0.45);
        // Square-root scale: fine detail near the ground.
        const a = (v: number) => 0.75 * Math.PI + Math.sqrt(clamp(v, 0, 300) / 300) * 1.5 * Math.PI;
        band(ctx, cx, cy, r * 0.86, a(0), a(15), '#e2493b');
        band(ctx, cx, cy, r * 0.86, a(15), a(40), '#f2c230');
        for (const v of [0, 10, 25, 50, 100, 200, 300]) {
          tick(ctx, cx, cy, r, a(v), 0.16, 2);
          label(ctx, cx, cy, r * 0.62, a(v), String(v), r);
        }
        title(ctx, cx, cy - r * 0.18, 'RADAR ALT');
        digital(ctx, cx, cy + r * 0.42, agl > 999 ? '999+' : `${Math.round(agl)}m`, r);
        needle(ctx, cx, cy, a(this.value('radar', agl, dt, 6)), r * 0.8);
        return glass(ctx, cx, cy, r);
      }
      case 'pitch': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        // Reference marks every 15° around the left and right of the dial.
        for (let d = -90; d <= 90; d += 15) {
          const ang = (-d * Math.PI) / 180;
          tick(ctx, cx, cy, r, ang, d % 45 === 0 ? 0.18 : 0.1, d % 45 === 0 ? 2 : 1);
          tick(ctx, cx, cy, r, Math.PI - ang, d % 45 === 0 ? 0.18 : 0.1, d % 45 === 0 ? 2 : 1);
        }
        ctx.strokeStyle = 'rgba(242,242,238,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.8, cy);
        ctx.lineTo(cx + r * 0.8, cy);
        ctx.stroke();
        const p = this.value('pitch', f.pitch, dt, 10);
        aircraft(ctx, cx, cy, r * 0.55, -p, '#ff9f1c');
        title(ctx, cx, cy + r * 0.48, 'PITCH');
        digital(ctx, cx, cy - r * 0.48, signed(p * DEG), r * 0.8);
        return glass(ctx, cx, cy, r);
      }
      case 'attitude': {
        plate(ctx, x, y, D);
        const p = this.value('att', f.pitch, dt, 10);
        const path = f.phase === 'air' && Math.hypot(f.vx, f.vy) > 1 ? Math.atan2(f.vy, f.vx) : f.pitch;
        // Rotating sky/ground ball.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.clip();
        ctx.translate(cx, cy);
        ctx.rotate(p);
        const sky = ctx.createLinearGradient(0, -r, 0, 0);
        sky.addColorStop(0, '#1f6fd1');
        sky.addColorStop(1, '#5fb0ff');
        ctx.fillStyle = sky;
        ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 1.5);
        const ground = ctx.createLinearGradient(0, 0, 0, r);
        ground.addColorStop(0, '#9a5b2a');
        ground.addColorStop(1, '#5c3417');
        ctx.fillStyle = ground;
        ctx.fillRect(-r * 1.5, 0, r * 3, r * 1.5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 1.5, 0);
        ctx.lineTo(r * 1.5, 0);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (const d of [-20, -10, 10, 20]) {
          const yy = (-d / 30) * r;
          const half = Math.abs(d) === 10 ? r * 0.18 : r * 0.3;
          ctx.beginPath();
          ctx.moveTo(-half, yy);
          ctx.lineTo(half, yy);
          ctx.stroke();
        }
        ctx.restore();
        ring(ctx, cx, cy, r);
        // Fixed aircraft symbol.
        ctx.strokeStyle = '#ff9f1c';
        ctx.lineWidth = Math.max(2, r * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.55, cy);
        ctx.lineTo(cx - r * 0.2, cy);
        ctx.lineTo(cx - r * 0.1, cy + r * 0.1);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + r * 0.1, cy + r * 0.1);
        ctx.lineTo(cx + r * 0.2, cy);
        ctx.lineTo(cx + r * 0.55, cy);
        ctx.stroke();
        // Flight path marker: where the panda is actually going, relative to the nose.
        const rel = this.value('fpm', Math.atan2(Math.sin(path - p), Math.cos(path - p)), dt, 10);
        const mx = cx + Math.cos(-rel) * r * 0.62;
        const my = cy + Math.sin(-rel) * r * 0.62;
        ctx.strokeStyle = '#6dff8a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx, my, r * 0.09, 0, TAU);
        ctx.moveTo(mx - r * 0.22, my);
        ctx.lineTo(mx - r * 0.09, my);
        ctx.moveTo(mx + r * 0.09, my);
        ctx.lineTo(mx + r * 0.22, my);
        ctx.moveTo(mx, my - r * 0.09);
        ctx.lineTo(mx, my - r * 0.18);
        ctx.stroke();
        ctx.lineCap = 'butt';
        return glass(ctx, cx, cy, r);
      }
      case 'aoa': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const stall = f.gear.glider.stallDeg;
        const max = Math.ceil((stall * 1.4) / 5) * 5;
        const a = (v: number) => Math.PI + (clamp(v, 0, max) / max) * Math.PI;
        band(ctx, cx, cy, r * 0.86, a(0), a(stall * 0.7), '#3fbf5a');
        band(ctx, cx, cy, r * 0.86, a(stall * 0.7), a(stall), '#f2c230');
        band(ctx, cx, cy, r * 0.86, a(stall), a(max), '#e2493b');
        ticks(ctx, cx, cy, r, 0, max, Math.PI, TAU, 10, 5, (v) => String(v));
        const aoa = flyingAoa(f);
        title(ctx, cx, cy + r * 0.22, 'ANGLE OF ATTACK', 0.75);
        digital(ctx, cx, cy + r * 0.5, `${Math.round(aoa)}°`, r * 0.85);
        needle(ctx, cx, cy, a(this.value('aoa', aoa, dt, 10)), r * 0.82);
        return glass(ctx, cx, cy, r);
      }
      case 'fuel': {
        plate(ctx, x, y, D);
        face(ctx, cx, cy, r);
        const frac = f.maxFuel > 0 ? f.fuel / f.maxFuel : 0;
        const a = (v: number) => 1.2 * Math.PI + v * 0.6 * Math.PI;
        band(ctx, cx, cy, r * 0.86, a(0), a(0.2), '#e2493b');
        for (let i = 0; i <= 4; i++) tick(ctx, cx, cy, r, a(i / 4), i % 2 ? 0.1 : 0.18, i % 2 ? 1 : 2);
        label(ctx, cx, cy, r * 0.6, a(0), 'E', r);
        label(ctx, cx, cy, r * 0.6, a(1), 'F', r);
        title(ctx, cx, cy + r * 0.15, 'FUEL');
        digital(ctx, cx, cy + r * 0.45, `${f.fuel.toFixed(1)}s`, r * 0.85);
        needle(ctx, cx, cy, a(this.value('fuel', frac, dt, 10)), r * 0.75);
        if (frac < 0.2 && f.maxFuel > 0 && Math.sin(time * 10) > 0) {
          ctx.fillStyle = '#ff5a3d';
          ctx.beginPath();
          ctx.arc(cx, cy - r * 0.45, r * 0.07, 0, TAU);
          ctx.fill();
        }
        return glass(ctx, cx, cy, r);
      }
    }
  }
}

function flyingAoa(f: Flight): number {
  return f.phase === 'air' && !f.onGround ? Math.abs(f.angleOfAttack) * DEG : 0;
}

const signed = (deg: number) => {
  const d = Math.round(deg);
  return `${d > 0 ? '+' : ''}${d}°`;
};

// ------------------------------------------------------------ drawing kit

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2a2340';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 3, h - 3, 16);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3b3e48');
  g.addColorStop(1, '#25272e');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#2a2340';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w - 3, h - 3, 16);
  ctx.fill();
  ctx.stroke();
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, D: number) {
  ctx.fillStyle = '#1e2026';
  ctx.beginPath();
  ctx.roundRect(x, y, D, D, D * 0.12);
  ctx.fill();
  // Corner screws.
  const s = D * 0.07;
  for (const [sx, sy] of [
    [x + s * 1.3, y + s * 1.3],
    [x + D - s * 1.3, y + s * 1.3],
    [x + s * 1.3, y + D - s * 1.3],
    [x + D - s * 1.3, y + D - s * 1.3],
  ]) {
    ctx.fillStyle = '#6b6f7a';
    ctx.beginPath();
    ctx.arc(sx, sy, s * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2a2c33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.4, sy - s * 0.15);
    ctx.lineTo(sx + s * 0.4, sy + s * 0.15);
    ctx.stroke();
  }
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, '#9aa0ab');
  g.addColorStop(0.5, '#4a4e58');
  g.addColorStop(1, '#2a2c33');
  ctx.strokeStyle = g;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.02, 0, TAU);
  ctx.stroke();
}

function face(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#24262d');
  g.addColorStop(1, FACE);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ring(ctx, cx, cy, r);
}

function glass(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.2);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.96, 0, TAU);
  ctx.fill();
}

function tick(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number, len: number, width: number) {
  ctx.strokeStyle = MARK;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * r * (0.92 - len), cy + Math.sin(a) * r * (0.92 - len));
  ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, cx: number, cy: number, rr: number, a: number, text: string, r: number) {
  if (compact && text !== 'E' && text !== 'F') return;
  ctx.fillStyle = MARK;
  ctx.font = `600 ${Math.max(8, r * 0.2)}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
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
    const isMajor = Math.abs((v - min) % major) < 1e-6 || Math.abs(((v - min) % major) - major) < 1e-6;
    tick(ctx, cx, cy, r, a, isMajor ? 0.17 : 0.09, isMajor ? 2 : 1);
    if (isMajor) label(ctx, cx, cy, r * 0.62, a, fmt(v), r);
  }
}

function band(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, color: string) {
  if (a1 <= a0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
}

function needle(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, len: number, width = 3.5, color = '#ff9f1c') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.moveTo(-len * 0.18, -width / 2);
  ctx.lineTo(len, 0);
  ctx.lineTo(-len * 0.18, width / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#3a3c44';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, len * 0.1), 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9aa0ab';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5, len * 0.04), 0, TAU);
  ctx.fill();
}

function title(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, scale = 1) {
  if (compact) return;
  ctx.fillStyle = 'rgba(242,242,238,0.75)';
  ctx.font = `600 ${7.5 * scale + 1}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function digital(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, r: number) {
  const size = Math.max(9, r * 0.24);
  ctx.font = `700 ${size}px ${DIGIT_FONT}`;
  const w = ctx.measureText(text).width + size * 0.6;
  ctx.fillStyle = '#050607';
  ctx.strokeStyle = '#4a4e58';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.7, w, size * 1.4, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb238';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

/** Small side-view aircraft symbol, rotated by the pitch. */
function aircraft(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.quadraticCurveTo(len * 0.6, -len * 0.16, -len * 0.7, -len * 0.08);
  ctx.lineTo(-len * 0.95, -len * 0.4);
  ctx.lineTo(-len * 0.8, len * 0.05);
  ctx.quadraticCurveTo(len * 0.5, len * 0.16, len, 0);
  ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.moveTo(len * 0.25, 0);
  ctx.lineTo(-len * 0.2, len * 0.32);
  ctx.lineTo(-len * 0.35, len * 0.3);
  ctx.lineTo(-len * 0.05, 0);
  ctx.fill();
  ctx.restore();
}

function annunciator(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, on: boolean, pulse: number) {
  ctx.fillStyle = on ? '#ff3b2f' : '#3a1c1c';
  if (on) {
    ctx.shadowColor = `rgba(255,60,40,${0.5 + 0.5 * pulse})`;
    ctx.shadowBlur = 8 + 12 * pulse;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = on ? '#fff' : '#7a4a4a';
  ctx.font = `700 ${h * 0.55}px ${DIGIT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** The Wrist Computer: a green backlit LCD with three readouts. */
function lcd(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: Flight) {
  ctx.fillStyle = '#1e2026';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h * 0.14);
  ctx.fill();
  const ix = x + h * 0.1;
  const iy = y + h * 0.12;
  const iw = w - h * 0.2;
  const ih = h * 0.76;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, '#b9d98a');
  g.addColorStop(1, '#93b866');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 6);
  ctx.fill();
  const rows: [string, string][] = [
    ['SPD', `${Math.round(f.speed * 3.6)}`.padStart(4, ' ') + ' km/h'],
    ['ALT', `${Math.round(Math.max(0, f.y))}`.padStart(4, ' ') + ' m'],
    ['PIT', signed(f.pitch * DEG).padStart(4, ' ')],
  ];
  const size = ih * 0.2;
  ctx.font = `700 ${size}px ${DIGIT_FONT}`;
  ctx.textBaseline = 'middle';
  rows.forEach(([k, v], i) => {
    const ry = iy + ih * (0.2 + i * 0.3);
    // Faint "unlit segments" behind the digits, like a real LCD.
    ctx.fillStyle = 'rgba(40,60,20,0.12)';
    ctx.textAlign = 'right';
    ctx.fillText('8888 km/h', ix + iw - size * 0.4, ry);
    ctx.fillStyle = '#20301a';
    ctx.textAlign = 'left';
    ctx.fillText(k, ix + size * 0.4, ry);
    ctx.textAlign = 'right';
    ctx.fillText(v, ix + iw - size * 0.4, ry);
  });
}
