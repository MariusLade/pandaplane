import { clamp, lerp, mixRgb, rgb, wrapAngle } from '../core/math';
import { PANDA_RADIUS } from '../game/constants';
import type { Flight, FlightEvent } from '../game/flight';
import { biomeAt, type Pickup, type World } from '../game/world';
import { Background } from './background';
import { Camera } from './camera';
import { drawPanda, nozzleOffset, type Mood } from './panda';
import { Particles } from './particles';
import { drawPickups } from './pickups';
import { drawDecor, drawRamp, drawSigns, drawTerrain } from './terrain';

const PICKUP_MIN_PPM = 14;

export type CameraMode = 'ramp' | 'hangar' | 'follow';

interface Streak {
  x: number;
  y: number;
  life: number;
}

/** Metres to raise an enlarged panda so it still rests on the ground. */
const lift = (scale: number, ppm: number): number => ((scale - ppm) * PANDA_RADIUS) / ppm;

export class Renderer {
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly bg: Background;
  private ctx: CanvasRenderingContext2D;
  private pickBuf: Pickup[] = [];
  private streaks: Streak[] = [];
  private dpr = 1;
  /** Panda pose interpolated between the last two physics steps (smooth at any frame rate). */
  private view = { x: 0, y: 0, pitch: 0 };
  private speech = { text: '', time: 0, duration: 0 };
  /** Seconds since the last wing beat, for the flap animation. */
  private sinceFlap = 99;

  constructor(
    private canvas: HTMLCanvasElement,
    seed: number,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.bg = new Background(seed);
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.cam.resize(rect.width, rect.height);
  }

  /** The panda never shrinks below a readable size, relative to the screen. */
  pandaScale(): number {
    const min = clamp(Math.min(this.cam.w, this.cam.h) * 0.048, 16, 40);
    return Math.max(this.cam.ppm, min);
  }

  /** Blend the last two physics states; call once per frame before drawing. */
  interpolate(flight: Flight, alpha: number): void {
    const a = clamp(alpha, 0, 1);
    this.view.x = lerp(flight.prevX, flight.x, a);
    this.view.y = lerp(flight.prevY, flight.y, a);
    this.view.pitch = flight.prevPitch + wrapAngle(flight.pitch - flight.prevPitch) * a;
  }

  /** Show a speech bubble over the panda. */
  say(text: string, duration = 1.8): void {
    this.speech = { text, time: 0, duration };
  }

  updateCamera(flight: Flight, mode: CameraMode, dt: number, snap = false): void {
    const cam = this.cam;
    const world = flight.world;
    if (mode === 'hangar') {
      // The whole ramp, from the start gate down to the kicker.
      const r = flight.ramp;
      const cx = (r.top.x + r.lip.x) / 2 + 10;
      const span = Math.max(60, (r.lip.x - r.top.x) * 1.35 + 40);
      cam.follow(cx, r.top.y * 0.5, span, -1000, dt, snap);
      return;
    }
    if (mode === 'ramp') {
      // Close on the panda at the start gate, looking down the slope.
      const r = flight.ramp;
      cam.follow(r.top.x + 14, r.top.y - 7, 56, -1000, dt, snap);
      return;
    }
    const speed = flight.speed;
    const agl = Math.max(0, flight.altitudeAboveGround);
    const span = clamp(42 + speed * 0.8 + agl * 1.5, 42, 1400);
    const viewH = (cam.h * cam.span) / Math.min(cam.w, cam.h * 1.6);
    const vx = flight.phase === 'air' ? flight.vx : speed;
    const vy = flight.phase === 'air' ? flight.vy : 0;
    const lead = clamp(vx * 0.35, -span * 0.2, span * 0.22);
    const tx = this.view.x + lead;
    // Drop the camera towards the ground so the landing zone stays in view while low.
    const drop = Math.min(agl * 0.6, viewH * 0.3);
    const ty = this.view.y - drop + clamp(vy * 0.2, -span * 0.12, span * 0.12);
    cam.follow(tx, ty, span, Math.min(world.groundY(this.view.x), world.groundY(tx)), dt, snap);
  }

  /** Spawn visual effects for simulation events. */
  effect(ev: FlightEvent, flight: Flight): void {
    const p = this.particles;
    switch (ev.type) {
      case 'launch':
        p.burst(ev.x, ev.y, 14, 'puff', '#ffffff', 5, 0.4);
        break;
      case 'coin':
      case 'bigcoin':
        p.burst(ev.x, ev.y, ev.type === 'bigcoin' ? 18 : 6, 'spark', '#ffe066', 6, 0.12, 0.5);
        p.text(ev.x, ev.y + 1.5, `+$${ev.amount}`, '#ffe066');
        break;
      case 'ring':
        p.burst(ev.x, ev.y, 18, 'spark', '#7fefff', 10, 0.12, 0.6);
        this.cam.addShake(0.25);
        break;
      case 'balloon':
        p.burst(ev.x, ev.y, 22, 'confetti', '#ff5d6c', 8, 0.12, 1);
        p.burst(ev.x, ev.y, 10, 'confetti', '#ffd23d', 8, 0.12, 1);
        break;
      case 'impact': {
        const b = biomeAt(ev.x);
        const color = rgb(mixRgb(b.a.lip, b.b.lip, b.t));
        p.burst(ev.x, flight.world.groundY(ev.x) + 0.2, Math.min(40, 6 + ev.amount), 'puff', color, 3 + ev.amount * 0.2, 0.5, 1);
        this.cam.addShake(clamp(ev.amount / 30, 0.1, 0.9));
        break;
      }
      case 'flap':
        this.sinceFlap = 0;
        p.burst(ev.x, ev.y + 0.5, 6, 'confetti', flight.gear.glider.style === 'dragon' ? '#2e9e6b' : '#c99a5b', 5, 0.12, 0.9);
        p.burst(ev.x, ev.y, 8, 'puff', '#ffffff', 4, 0.35, 0.5);
        break;
      case 'splash': {
        const gy = flight.world.groundY(ev.x);
        const color = flight.world.surfaceAt(ev.x) === 'ice' ? '#e8f7ff' : '#8fd3ff';
        for (let i = 0; i < Math.min(40, 8 + ev.amount * 1.5); i++) {
          p.spawn({
            kind: 'spark',
            x: ev.x + (Math.random() - 0.5) * 2,
            y: gy + 0.2,
            vx: flight.vx * 0.3 + (Math.random() - 0.5) * 6,
            vy: 3 + Math.random() * (4 + ev.amount * 0.4),
            life: 0.9,
            size: 0.12,
            color,
            gravity: 12,
            drag: 0.5,
          });
        }
        this.cam.addShake(Math.min(0.5, ev.amount / 40));
        break;
      }
      case 'goal':
        for (const c of ['#ff5d6c', '#ffd23d', '#5dc4ff', '#5fd47a', '#ffffff'])
          p.burst(ev.x, ev.y, 30, 'confetti', c, 18, 0.25, 2.5);
        break;
      case 'done':
        break;
    }
  }

  /** Per-frame continuous effects (rocket exhaust, ground spray). */
  private ambient(flight: Flight, dt: number): void {
    const p = this.particles;
    const scale = this.pandaScale() / this.cam.ppm;
    if (flight.boosting) {
      const c = Math.cos(this.view.pitch);
      const s = Math.sin(this.view.pitch);
      // Nozzle offset is in panda-local space (+y down) -> world offset.
      const noz = nozzleOffset(flight.gear.rocket.style);
      const lx = noz.x * scale;
      const ly = -noz.y * scale;
      const nx = this.view.x + lx * c - ly * s;
      const ny = this.view.y + lift(scale, this.cam.ppm) + lx * s + ly * c;
      const vx = flight.phase === 'air' ? flight.vx : 0;
      const vy = flight.phase === 'air' ? flight.vy : 0;
      const ion = flight.gear.rocket.style === 'ion';
      for (let i = 0; i < 3; i++) {
        p.spawn({
          kind: 'flame',
          x: nx,
          y: ny,
          vx: vx * 0.6 - c * 12 + (Math.random() - 0.5) * 3,
          vy: vy * 0.6 - s * 12 + (Math.random() - 0.5) * 3,
          life: 0.25,
          size: 0.35 * Math.min(scale, 4),
          color: ion ? '#7fd8ff' : '#ffb238',
          gravity: 0,
          drag: 2,
        });
      }
      if (!ion && Math.random() < dt * 40) {
        p.spawn({
          kind: 'smoke',
          x: nx,
          y: ny,
          vx: vx * 0.2 - c * 4,
          vy: vy * 0.2 - s * 4,
          life: 1.4,
          size: 0.8 * Math.min(scale, 4),
          color: '#d8dde6',
          gravity: -1,
          drag: 1.5,
        });
      }
    }
    if (flight.phase === 'air' && flight.onGround && flight.speed > 3 && Math.random() < dt * 30) {
      const b = biomeAt(flight.x);
      p.spawn({
        kind: 'puff',
        x: flight.x - 0.5,
        y: flight.world.groundY(flight.x) + 0.2,
        vx: -flight.vx * 0.1 + (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2,
        life: 0.7,
        size: 0.3 + Math.min(0.6, flight.speed * 0.02),
        color: rgb(mixRgb(b.a.lip, b.b.lip, b.t)),
        gravity: 3,
        drag: 2,
      });
    }
  }

  private updateStreaks(flight: Flight, dt: number): void {
    const cam = this.cam;
    const speed = flight.speed;
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.life -= dt;
      if (s.life <= 0) this.streaks.splice(i, 1);
    }
    if (flight.phase !== 'air' || speed < 30) return;
    const want = Math.min(40, (speed - 30) * 0.6);
    while (this.streaks.length < want) {
      this.streaks.push({
        x: cam.wx(Math.random() * cam.w * 1.4),
        y: cam.wy(Math.random() * cam.h),
        life: 0.3 + Math.random() * 0.4,
      });
    }
  }

  private drawStreaks(flight: Flight): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const v = Math.hypot(flight.vx, flight.vy) || 1;
    const len = Math.min(cam.w * 0.15, v * 0.05 * cam.ppm + 20);
    const dx = (-flight.vx / v) * len;
    const dy = (flight.vy / v) * len;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const s of this.streaks) {
      const x = cam.sx(s.x);
      const y = cam.sy(s.y);
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
    }
    ctx.stroke();
  }

  draw(world: World, flight: Flight, gearMood: Mood, time: number, dt: number): void {
    this.sinceFlap += dt;
    const ctx = this.ctx;
    const cam = this.cam;
    this.particles.update(dt);
    this.ambient(flight, dt);
    this.updateStreaks(flight, dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bg.draw(ctx, cam, time);
    this.bg.drawNearClouds(ctx, cam);
    drawDecor(ctx, cam, world, time, this.dpr, 'back');
    drawTerrain(ctx, cam, world, time);
    drawDecor(ctx, cam, world, time, this.dpr, 'front');
    drawSigns(ctx, cam, world);
    drawRamp(ctx, cam, flight.ramp, world);

    this.pickBuf.length = 0;
    world.pickupsIn(cam.wx(-50), cam.wx(cam.w + 50), this.pickBuf);
    drawPickups(ctx, cam, this.pickBuf, time, Math.max(cam.ppm, PICKUP_MIN_PPM));

    this.particles.draw(ctx, cam, cam.ppm);

    const scale = this.pandaScale();
    // When drawn larger than life, lift the panda so it still rests on the ground.
    const sx = cam.sx(this.view.x);
    const sy = cam.sy(this.view.y + lift(scale, cam.ppm));
    const speed = flight.speed;
    drawPanda(ctx, sx, sy, scale, flight.gear, {
      angle: this.view.pitch,
      time,
      speed,
      boosting: flight.boosting,
      mood: gearMood,
      wind: clamp(speed / 25, 0, 1),
      flap: Math.max(0, 1 - this.sinceFlap * 3),
    });

    this.drawStreaks(flight);
    this.drawSpeech(sx, sy - scale * 1.4, dt);
  }

  private drawSpeech(x: number, y: number, dt: number): void {
    const sp = this.speech;
    if (!sp.text) return;
    sp.time += dt;
    if (sp.time > sp.duration) {
      sp.text = '';
      return;
    }
    const ctx = this.ctx;
    const pop = Math.min(1, sp.time / 0.12);
    const fade = Math.min(1, (sp.duration - sp.time) / 0.25);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = '600 17px Fredoka, ui-rounded, system-ui, sans-serif';
    const w = ctx.measureText(sp.text).width + 22;
    const h = 32;
    const bx = clamp(x + 10, 8, this.cam.w - w - 8);
    const by = clamp(y - h - 4, 8, this.cam.h - h - 8);
    ctx.translate(bx + w / 2, by + h);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.translate(-(bx + w / 2), -(by + h));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d2340';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 14);
    ctx.moveTo(bx + 16, by + h);
    ctx.lineTo(clamp(x, bx + 6, bx + w - 6), by + h + 12);
    ctx.lineTo(bx + 30, by + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + 15, by + h - 3, 17, 4);
    ctx.fillStyle = '#1d2340';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.text, bx + 11, by + h / 2 + 1);
    ctx.restore();
  }
}
