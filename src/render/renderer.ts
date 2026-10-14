import { clamp, lerp, mixRgb, rgb, wrapAngle } from '../core/math';
import { PANDA_RADIUS } from '../game/constants';
import type { Flight, FlightEvent } from '../game/flight';
import type { Pickup, World } from '../game/world';
import { Background } from './background';
import { Camera } from './camera';
import { drawPanda, nozzleOffset, type Mood } from './panda';
import { Particles } from './particles';
import { drawBeam, drawEnemies, drawGusts, drawShots, drawStrikes, drawThermals, drawThreatArrows } from './combat';
import { storminess } from './background';
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
  /** Lightning flash brightness, fading to 0. */
  private flash = 0;

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

  /**
   * Pixels per metre for the panda (and enemies). Close up it is true scale;
   * as the camera zooms out it shrinks too, more gently than the world, and
   * stops at a floor tied to the screen size so it never turns into a speck.
   */
  pandaScale(): number {
    const ppm = this.cam.ppm;
    const ref = clamp(Math.min(this.cam.w, this.cam.h) * 0.04, 14, 32);
    const exaggeration = clamp(Math.sqrt(ref / ppm), 1, 4.5);
    return Math.max(ppm * exaggeration, ref * 0.6);
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
    const drop = Math.min(agl * 0.6, viewH * 0.15);
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
        const b = flight.world.biomeAt(ev.x);
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
      case 'shoot':
        if (ev.tag !== 'laser') p.burst(ev.x, ev.y, 3, 'ember', '#fff3b0', 6, 0.08, 0.15);
        break;
      case 'enemyHit':
        if (ev.tag === 'blast') {
          p.burst(ev.x, ev.y, 26, 'flame', 'fire', ev.amount * 1.2, 0.5, 0.5);
          p.burst(ev.x, ev.y, 14, 'ember', '#ffd27a', 14, 0.1, 0.6);
          p.spawn({ kind: 'ring', x: ev.x, y: ev.y, vx: 0, vy: 0, life: 0.35, size: ev.amount, color: '#fff3b0', gravity: 0, drag: 0 });
          this.cam.addShake(0.25);
        } else {
          p.burst(ev.x, ev.y, 6, 'spark', '#fff3b0', 8, 0.1, 0.3);
        }
        break;
      case 'thunder':
        this.flash = Math.max(this.flash, 0.55);
        this.cam.addShake(0.35);
        p.burst(ev.x, ev.y + 0.3, 16, 'ember', '#fff3b0', 14, 0.1, 0.6);
        p.burst(ev.x, ev.y + 0.3, 10, 'puff', '#d8dde6', 5, 0.6, 0.8);
        break;
      case 'zap':
        this.flash = 1;
        this.cam.addShake(0.7);
        p.burst(ev.x, ev.y, 24, 'spark', ev.tag === 'rod' ? '#9fe3ff' : '#fff3b0', 14, 0.12, 0.5);
        p.spawn({ kind: 'ring', x: ev.x, y: ev.y, vx: 0, vy: 0, life: 0.4, size: 4, color: ev.tag === 'rod' ? '#9fe3ff' : '#fff3b0', gravity: 0, drag: 0 });
        if (ev.tag === 'rod') p.text(ev.x, ev.y + 2.5, 'ZAP BOOST!', '#9fe3ff');
        break;
      case 'charged':
        p.text(ev.x, ev.y + 3.5, '+FUEL', '#ffd23d');
        break;
      case 'gust':
        p.burst(ev.x, ev.y, 8, 'puff', '#ffffff', 6, 0.3, 0.5);
        break;
      case 'enemyDown': {
        const color =
          ev.tag === 'bandit' ? '#c4532a' : ev.tag === 'bat' ? '#7a2a22' : ev.tag === 'gull' ? '#ffffff' : ev.tag === 'fish' ? '#5fb0ff' : '#1f1d24';
        p.burst(ev.x, ev.y, 14, 'confetti', color, 9, 0.18, 1.2);
        p.burst(ev.x, ev.y, 10, 'puff', '#ffffff', 5, 0.5, 0.6);
        p.text(ev.x, ev.y + 2, `+$${ev.amount}`, '#ffe066');
        if (ev.tag === 'bandit') p.burst(ev.x, ev.y - 2, 20, 'confetti', '#ffd23d', 12, 0.2, 1.4);
        break;
      }
      case 'hurt':
        p.burst(ev.x, ev.y, 12, 'confetti', '#1f1d24', 8, 0.15, 1);
        if (ev.amount > 0) p.text(flight.x, flight.y + 2, `-$${ev.amount}`, '#ff6b6b');
        this.cam.addShake(0.5);
        break;
      case 'shielded':
        p.spawn({ kind: 'ring', x: flight.x, y: flight.y, vx: 0, vy: 0, life: 0.5, size: 2.5, color: '#9fe3ff', gravity: 0, drag: 0 });
        p.burst(ev.x, ev.y, 10, 'spark', '#9fe3ff', 8, 0.12, 0.5);
        break;
      case 'lava':
        p.burst(ev.x, flight.world.groundY(ev.x), 24, 'flame', 'fire', 9, 0.5, 0.6);
        p.burst(ev.x, flight.world.groundY(ev.x), 18, 'ember', '#ffb238', 14, 0.12, 0.9);
        this.cam.addShake(0.35);
        break;
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
      const style = flight.gear.rocket.style;
      const ion = style === 'ion' || style === 'thunder';
      const steamy = style === 'soda' || style === 'cola' || style === 'kettle';
      const power = clamp(flight.thrust / 30, 0.2, 1.2);
      const size = Math.min(scale, 3.5);
      // Hot exhaust gas streaming out of the nozzle.
      const n = steamy ? 0 : 2 + Math.round(power * 3);
      for (let i = 0; i < n; i++) {
        const sp = 10 + power * 18 + Math.random() * 6;
        p.spawn({
          kind: 'flame',
          x: nx,
          y: ny,
          vx: vx * 0.7 - c * sp + (Math.random() - 0.5) * 3,
          vy: vy * 0.7 - s * sp + (Math.random() - 0.5) * 3,
          life: 0.18 + power * 0.12,
          size: (0.28 + power * 0.2) * size,
          color: ion ? 'ion' : 'fire',
          gravity: 0,
          drag: 3,
        });
      }
      // Sparks flung out of the exhaust.
      if (!steamy && (!ion || style === 'thunder') && Math.random() < dt * (12 + power * 25)) {
        p.spawn({
          kind: 'ember',
          x: nx,
          y: ny,
          vx: vx * 0.5 - c * 14 + (Math.random() - 0.5) * 14,
          vy: vy * 0.5 - s * 14 + (Math.random() - 0.5) * 14,
          life: 0.4 + Math.random() * 0.4,
          size: 0.06 * size,
          color: style === 'thunder' ? (Math.random() < 0.5 ? '#fff3b0' : '#9fd8ff') : Math.random() < 0.5 ? '#ffd27a' : '#ff8a3d',
          gravity: 6,
          drag: 1,
        });
      }
      // Billowing smoke (or steam and fizz).
      if (!ion && Math.random() < dt * (steamy ? 60 : 45)) {
        p.spawn({
          kind: 'smoke',
          x: nx,
          y: ny,
          vx: vx * 0.15 - c * (steamy ? 8 : 4) + (Math.random() - 0.5) * 2,
          vy: vy * 0.15 - s * (steamy ? 8 : 4) + (Math.random() - 0.5) * 2,
          life: steamy ? 0.8 : 1.6,
          size: (steamy ? 0.5 : 0.7 + power * 0.4) * size,
          color: steamy ? '#ffffff' : style === 'magma' ? '#7a6a6e' : '#d8dde6',
          gravity: -1.5,
          drag: 1.5,
        });
      }
    }
    if (flight.phase === 'air' && flight.onGround && flight.speed > 3 && Math.random() < dt * 30) {
      const b = flight.world.biomeAt(flight.x);
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
    this.bg.draw(ctx, cam, time, world);
    this.bg.drawNearClouds(ctx, cam, world);
    drawDecor(ctx, cam, world, time, this.dpr, 'back');
    drawTerrain(ctx, cam, world, time);
    drawDecor(ctx, cam, world, time, this.dpr, 'front');
    drawSigns(ctx, cam, world, time);
    drawRamp(ctx, cam, flight.ramp, world);

    this.pickBuf.length = 0;
    world.pickupsIn(cam.wx(-50), cam.wx(cam.w + 50), this.pickBuf);
    drawThermals(ctx, cam, world, time);
    drawGusts(ctx, cam, world, time);
    drawPickups(ctx, cam, this.pickBuf, time, Math.max(cam.ppm, PICKUP_MIN_PPM));

    const scale = this.pandaScale();
    drawEnemies(ctx, cam, flight.enemies, scale, time);
    drawShots(ctx, cam, flight.shots, scale, time);
    this.particles.draw(ctx, cam, cam.ppm);
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
      thrust: clamp(flight.thrust / 30, 0.15, 1.2),
    });
    if (flight.shield > 0 && flight.phase !== 'done') this.drawShield(sx, sy, scale, time, flight.shield);
    drawStrikes(ctx, cam, world, flight.strikes, time);
    drawBeam(ctx, cam, flight);
    this.drawRain(world, flight, time);
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
      this.flash = Math.max(0, this.flash - dt * 3.5);
    }

    this.drawStreaks(flight);
    if (flight.gear.gadgets.some((g) => g.threatRadar) && flight.phase === 'air') drawThreatArrows(ctx, cam, flight.enemies, time);
    this.drawSpeech(sx, sy - scale * 1.4, dt);
  }

  /** Slanting rain in stormy biomes, blown by the wind and the panda's speed. */
  private drawRain(world: World, flight: Flight, time: number): void {
    const cam = this.cam;
    const rain = storminess(world, cam.x) * (1 - clamp((cam.y - 300) / 900, 0, 1));
    if (rain < 0.02) return;
    const ctx = this.ctx;
    const n = Math.round(rain * 170);
    // Drops streak against the direction of travel.
    const vx = (flight.phase === 'air' ? -flight.vx * 0.25 : 0) - 6 - flight.wind * 0.3;
    const vy = 30 + (flight.phase === 'air' ? flight.vy * 0.25 : 0);
    const len = Math.min(40, Math.hypot(vx, vy) * 0.9);
    const ang = Math.atan2(vy, vx);
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    ctx.strokeStyle = 'rgba(210,225,245,0.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const h1 = Math.sin(i * 127.1) * 43758.5453;
      const h2 = Math.sin(i * 311.7) * 12543.1234;
      const r1 = h1 - Math.floor(h1);
      const r2 = h2 - Math.floor(h2);
      const speed = 0.9 + r2 * 0.6;
      const x = (((r1 * cam.w * 1.3 + time * dx * 14 * speed) % (cam.w * 1.3)) + cam.w * 1.3) % (cam.w * 1.3) - cam.w * 0.15;
      const y = (((r2 * cam.h * 1.2 + time * dy * 14 * speed) % (cam.h * 1.2)) + cam.h * 1.2) % (cam.h * 1.2) - cam.h * 0.1;
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
    }
    ctx.stroke();
  }

  /** A wobbly soap bubble around the panda while the shield holds. */
  private drawShield(x: number, y: number, scale: number, time: number, charges: number): void {
    const ctx = this.ctx;
    const r = scale * 1.3 * (1 + Math.sin(time * 5) * 0.03);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.8, 'rgba(160,220,255,0.12)');
    g.addColorStop(1, `rgba(160,220,255,${0.25 + charges * 0.1})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
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
