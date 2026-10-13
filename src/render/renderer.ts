import { clamp, mixRgb, rgb } from '../core/math';
import { PANDA_RADIUS } from '../game/constants';
import type { Flight, FlightEvent } from '../game/flight';
import { biomeAt, type Pickup, type World } from '../game/world';
import { Background } from './background';
import { Camera } from './camera';
import { drawPanda, type Mood } from './panda';
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

export class Renderer {
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly bg: Background;
  private ctx: CanvasRenderingContext2D;
  private pickBuf: Pickup[] = [];
  private streaks: Streak[] = [];
  private dpr = 1;

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

  updateCamera(flight: Flight, mode: CameraMode, dt: number, snap = false): void {
    const cam = this.cam;
    const world = flight.world;
    if (mode === 'ramp' || mode === 'hangar') {
      const r = flight.ramp;
      const cx = (r.top.x + r.lip.x) / 2 + 6;
      const span = Math.max(48, (r.lip.x - r.top.x) * 1.5 + 20);
      // In the hangar the UI covers the top of the screen, so frame the ramp low.
      const viewH = (cam.h * span) / Math.min(cam.w, cam.h * 1.6);
      const cy = mode === 'hangar' ? r.minY + viewH * 0.32 : (r.top.y + r.minY) / 2;
      cam.follow(cx, cy, span, world.groundY(cx) - 1000, dt, snap);
      return;
    }
    const speed = flight.speed;
    const agl = Math.max(0, flight.altitudeAboveGround);
    const span = clamp(42 + speed * 0.8 + agl * 1.5, 42, 1400);
    const viewH = (cam.h * cam.span) / Math.min(cam.w, cam.h * 1.6);
    const vx = flight.phase === 'air' ? flight.vx : speed;
    const vy = flight.phase === 'air' ? flight.vy : 0;
    const lead = clamp(vx * 0.35, -span * 0.2, span * 0.22);
    const tx = flight.x + lead;
    // Drop the camera towards the ground so the landing zone stays in view while low.
    const drop = Math.min(agl * 0.6, viewH * 0.3);
    const ty = flight.y - drop + clamp(vy * 0.2, -span * 0.12, span * 0.12);
    cam.follow(tx, ty, span, Math.min(world.groundY(flight.x), world.groundY(tx)), dt, snap);
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
      const c = Math.cos(flight.pitch);
      const s = Math.sin(flight.pitch);
      // Nozzle sits at local (-0.85, -0.48) with +y down -> world offset.
      const lx = -0.9 * scale;
      const ly = 0.48 * scale;
      const nx = flight.x + lx * c - ly * s;
      const ny = flight.y + lx * s + ly * c;
      const vx = flight.phase === 'air' ? flight.vx : 0;
      const vy = flight.phase === 'air' ? flight.vy : 0;
      for (let i = 0; i < 3; i++) {
        p.spawn({
          kind: 'flame',
          x: nx,
          y: ny,
          vx: vx * 0.6 - c * 12 + (Math.random() - 0.5) * 3,
          vy: vy * 0.6 - s * 12 + (Math.random() - 0.5) * 3,
          life: 0.25,
          size: 0.35 * Math.min(scale, 4),
          color: '#ffb238',
          gravity: 0,
          drag: 2,
        });
      }
      if (Math.random() < dt * 40) {
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
    const ctx = this.ctx;
    const cam = this.cam;
    this.particles.update(dt);
    this.ambient(flight, dt);
    this.updateStreaks(flight, dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bg.draw(ctx, cam, time);
    this.bg.drawNearClouds(ctx, cam);
    drawTerrain(ctx, cam, world);
    drawDecor(ctx, cam, world, world.seed);
    drawSigns(ctx, cam, world);
    drawRamp(ctx, cam, flight.ramp);

    this.pickBuf.length = 0;
    world.pickupsIn(cam.wx(-50), cam.wx(cam.w + 50), this.pickBuf);
    drawPickups(ctx, cam, this.pickBuf, time, Math.max(cam.ppm, PICKUP_MIN_PPM));

    this.particles.draw(ctx, cam, cam.ppm);

    const scale = this.pandaScale();
    // When drawn larger than life, lift the panda so it still rests on the ground.
    const lift = (scale - cam.ppm) * PANDA_RADIUS;
    const sx = cam.sx(flight.x);
    const sy = cam.sy(flight.y) - lift;
    const speed = flight.speed;
    drawPanda(ctx, sx, sy, scale, flight.gear, {
      angle: flight.pitch,
      time,
      speed,
      boosting: flight.boosting,
      mood: gearMood,
      wind: clamp(speed / 25, 0, 1),
    });

    this.drawStreaks(flight);
  }
}
