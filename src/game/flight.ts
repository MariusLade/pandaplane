import { clamp, lerp, wrapAngle } from '../core/math';
import {
  ATMO_SCALE,
  BALLOON_LIFT,
  BODY_DRAG,
  BODY_LIFT,
  BOUNCE_SPEED,
  BROADSIDE_DRAG,
  GOAL_DISTANCE,
  GRAVITY,
  GROUND_FRICTION,
  IMPACT_FRICTION,
  LIFT_SLOPE,
  PANDA_MASS,
  PANDA_RADIUS,
  PICKUP_REACH,
  PITCH_RATE,
  RAMP_FRICTION_SCALE,
  RESTITUTION,
  RING_BOOST,
  WING_PLATE_DRAG,
} from './constants';
import { buildRamp, rampAt, type Ramp } from './ramp';
import { burnTime, totalMass, type Loadout } from './upgrades';
import type { Pickup, World } from './world';

export type Phase = 'ready' | 'ramp' | 'air' | 'done';

export interface FlightInput {
  /** -1 = nose down, +1 = nose up. */
  pitch: number;
  boost: boolean;
}

export type FlightEventType = 'launch' | 'coin' | 'bigcoin' | 'ring' | 'balloon' | 'impact' | 'goal' | 'done';

export interface FlightEvent {
  type: FlightEventType;
  x: number;
  y: number;
  /** Impact speed, money value, etc. */
  amount: number;
}

export interface FlightResult {
  distance: number;
  maxAltitude: number;
  maxSpeed: number;
  airtime: number;
  coinMoney: number;
  coinCount: number;
  reachedGoal: boolean;
}

/** Lift coefficient with a linear region and a soft stall towards flat-plate behaviour. */
export function liftCoefficient(alpha: number, stall: number): number {
  const abs = Math.abs(alpha);
  if (abs <= stall) return LIFT_SLOPE * alpha;
  const peak = LIFT_SLOPE * stall * Math.sign(alpha);
  const flat = Math.sin(2 * alpha) * 0.9;
  const t = clamp((abs - stall) / 0.3, 0, 1);
  return lerp(peak * 0.75, flat, t);
}

const STOP_SPEED = 0.7;
const STOP_HOLD = 0.6;
const MAX_GROUND_TIME = 30;
const MAX_TIME = 900;

/**
 * Pure simulation of a single flight. No DOM, no rendering — so it can run in
 * tests, a worker, or a mobile wrapper unchanged.
 */
export class Flight {
  phase: Phase = 'ready';
  readonly ramp: Ramp;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  pitch: number;
  /** State at the start of the last step, for smooth interpolated rendering. */
  prevX: number;
  prevY: number;
  prevPitch: number;
  rampS = 0;
  rampV = 0;

  /** Seconds of boost left. */
  fuel: number;
  readonly maxFuel: number;
  /** Panda plus carried gear, kg. */
  readonly mass: number;
  /** PANDA_MASS / mass: how much forces are diluted by extra weight. */
  private readonly lightness: number;
  boosting = false;
  onGround = false;
  /** Seconds since last ground contact. */
  sinceContact = 0;
  angleOfAttack = 0;
  stalled = false;

  time = 0;
  airtime = 0;
  groundTime = 0;
  maxAltitude = 0;
  maxSpeed = 0;
  maxX = 0;
  coinMoney = 0;
  coinCount = 0;
  reachedGoal = false;
  private slowFor = 0;
  private touchedDown = false;
  private nearby: Pickup[] = [];

  readonly events: FlightEvent[] = [];

  constructor(
    readonly world: World,
    readonly gear: Loadout,
  ) {
    this.ramp = buildRamp(gear.ramp);
    this.x = this.ramp.top.x;
    this.y = this.ramp.top.y;
    this.pitch = this.ramp.top.angle;
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevPitch = this.pitch;
    this.maxFuel = burnTime(gear);
    this.fuel = this.maxFuel;
    this.mass = totalMass(gear);
    this.lightness = PANDA_MASS / this.mass;
  }

  get speed(): number {
    return this.phase === 'ramp' || this.phase === 'ready' ? this.rampV : Math.hypot(this.vx, this.vy);
  }

  get distance(): number {
    return Math.max(0, this.maxX);
  }

  get altitudeAboveGround(): number {
    return this.y - this.world.groundY(this.x);
  }

  start(): void {
    if (this.phase === 'ready') this.phase = 'ramp';
  }

  step(dt: number, input: FlightInput): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevPitch = this.pitch;
    if (this.phase === 'ready' || this.phase === 'done') return;
    this.time += dt;
    const canBoost = input.boost && this.fuel > 0 && this.gear.rocket.thrust > 0;
    this.boosting = canBoost;
    if (canBoost) this.fuel = Math.max(0, this.fuel - dt);

    if (this.phase === 'ramp') this.stepRamp(dt, canBoost);
    else this.stepAir(dt, input, canBoost);

    const speed = this.speed;
    if (this.phase === 'air') {
      this.maxSpeed = Math.max(this.maxSpeed, speed);
      this.maxAltitude = Math.max(this.maxAltitude, this.y);
      this.maxX = Math.max(this.maxX, this.x);
      this.collectPickups();
      if (!this.reachedGoal && this.x >= GOAL_DISTANCE) {
        this.reachedGoal = true;
        this.emit('goal', GOAL_DISTANCE);
      }
      this.checkStop(dt, speed);
    }
    if (this.time > MAX_TIME) this.finish();
  }

  private stepRamp(dt: number, boost: boolean): void {
    const p = rampAt(this.ramp, this.rampS);
    const mu = this.gear.sled.friction * RAMP_FRICTION_SCALE;
    let a = -GRAVITY * Math.sin(p.angle) - mu * GRAVITY * Math.cos(p.angle);
    a -= BODY_DRAG * this.gear.sled.drag * this.rampV * this.rampV * this.lightness;
    if (boost) a += this.gear.rocket.thrust * this.lightness;
    this.rampV = Math.max(0.5, this.rampV + a * dt);
    this.rampS += this.rampV * dt;
    const q = rampAt(this.ramp, this.rampS);
    this.x = q.x;
    this.y = q.y;
    this.pitch = q.angle;
    if (this.rampS >= this.ramp.length) {
      const lip = this.ramp.lip;
      this.phase = 'air';
      this.x = lip.x;
      this.y = lip.y;
      this.vx = Math.cos(lip.angle) * this.rampV;
      this.vy = Math.sin(lip.angle) * this.rampV;
      this.pitch = lip.angle;
      this.emit('launch', this.rampV);
    }
  }

  private stepAir(dt: number, input: FlightInput, boost: boolean): void {
    const { glider, sled, rocket } = this.gear;
    const rho = Math.exp(-Math.max(0, this.y) / ATMO_SCALE);
    const v = Math.hypot(this.vx, this.vy);
    let ax = 0;
    let ay = -GRAVITY;
    let alpha = 0;

    if (v > 0.05) {
      const ux = this.vx / v;
      const uy = this.vy / v;
      alpha = wrapAngle(this.pitch - Math.atan2(this.vy, this.vx));
      const stall = (glider.stallDeg * Math.PI) / 180;
      const cl = liftCoefficient(alpha, stall);
      const kLift = BODY_LIFT + glider.lift;
      const q = rho * v * v;
      const sinA = Math.sin(alpha);
      const lift = kLift * cl * q;
      const dragK =
        BODY_DRAG * sled.drag * glider.tuck * (1 + BROADSIDE_DRAG * sinA * sinA) +
        glider.drag +
        kLift * (glider.induced * cl * cl + WING_PLATE_DRAG * sinA * sinA);
      const drag = dragK * q * this.lightness;
      ax += -uy * lift * this.lightness - ux * drag;
      ay += ux * lift * this.lightness - uy * drag;
      this.stalled = glider.lift > 0 && Math.abs(alpha) > stall;
    }
    this.angleOfAttack = alpha;

    if (boost) {
      ax += Math.cos(this.pitch) * rocket.thrust * this.lightness;
      ay += Math.sin(this.pitch) * rocket.thrust * this.lightness;
    }

    // Pitch: player input fights a weathervane torque that turns the nose into the wind.
    if (this.onGround) {
      const target = Math.atan(this.world.slope(this.x));
      this.pitch += wrapAngle(target - this.pitch) * Math.min(1, dt * 10);
      this.pitch += input.pitch * PITCH_RATE * 0.25 * dt;
    } else {
      const stability = glider.stability * clamp(v / 12, 0, 1) * rho;
      const rate = PITCH_RATE * glider.control * Math.sqrt(this.lightness);
      this.pitch += (input.pitch * rate - stability * Math.sin(alpha)) * dt;
    }
    this.pitch = wrapAngle(this.pitch);

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.resolveGround(dt);
  }

  private resolveGround(dt: number): void {
    const gy = this.world.groundY(this.x);
    if (this.y - PANDA_RADIUS > gy) {
      this.onGround = false;
      this.sinceContact += dt;
      this.airtime += dt;
      return;
    }
    const s = this.world.slope(this.x);
    const len = Math.hypot(1, s);
    const nx = -s / len;
    const ny = 1 / len;
    const tx = ny;
    const ty = -nx;
    this.y = gy + PANDA_RADIUS;
    const vn = this.vx * nx + this.vy * ny;
    if (vn < 0) {
      const impact = -vn;
      let vt = this.vx * tx + this.vy * ty;
      // Sliding friction for resting contact; a gentler share for the crash itself,
      // so a hard landing turns into a long slide rather than a dead stop.
      const mu = GROUND_FRICTION + this.gear.sled.friction;
      const muCrash = IMPACT_FRICTION + this.gear.sled.friction * 0.5;
      const loss = mu * Math.min(impact, 3) + muCrash * Math.max(0, impact - 3);
      vt = Math.sign(vt) * Math.max(0, Math.abs(vt) - loss);
      const bounce = impact > BOUNCE_SPEED ? impact * RESTITUTION : 0;
      this.vx = tx * vt + nx * bounce;
      this.vy = ty * vt + ny * bounce;
      if (impact > 3 && this.sinceContact > 0.15) this.emit('impact', impact);
    }
    if (!this.touchedDown) this.touchedDown = true;
    this.onGround = true;
    this.sinceContact = 0;
    this.groundTime += dt;
  }

  private checkStop(dt: number, speed: number): void {
    if (!this.touchedDown) return;
    if (this.onGround && speed < STOP_SPEED && !this.boosting) this.slowFor += dt;
    else this.slowFor = 0;
    const outOfFuelCrawl = this.groundTime > MAX_GROUND_TIME && (this.fuel <= 0 || this.gear.rocket.thrust === 0);
    if (this.slowFor > STOP_HOLD || outOfFuelCrawl) this.finish();
  }

  finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.boosting = false;
    this.emit('done', this.distance);
  }

  private collectPickups(): void {
    this.nearby.length = 0;
    this.world.pickupsIn(this.x - 6, this.x + 6, this.nearby);
    for (const p of this.nearby) {
      if (p.taken) continue;
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const r = p.radius + PICKUP_REACH;
      if (dx * dx + dy * dy > r * r) continue;
      p.taken = true;
      switch (p.kind) {
        case 'coin':
        case 'bigcoin':
          this.coinMoney += p.value;
          this.coinCount++;
          this.emit(p.kind, p.value);
          break;
        case 'ring': {
          const v = Math.hypot(this.vx, this.vy) || 1;
          this.vx += (this.vx / v) * RING_BOOST;
          this.vy += (this.vy / v) * RING_BOOST;
          this.emit('ring', RING_BOOST);
          break;
        }
        case 'balloon':
          this.vy = Math.max(this.vy + BALLOON_LIFT * 0.5, BALLOON_LIFT);
          this.coinMoney += p.value;
          this.emit('balloon', p.value);
          break;
      }
    }
  }

  private emit(type: FlightEventType, amount: number): void {
    this.events.push({ type, x: this.x, y: this.y, amount });
  }

  result(): FlightResult {
    return {
      distance: this.distance,
      maxAltitude: this.maxAltitude,
      maxSpeed: this.maxSpeed,
      airtime: this.airtime,
      coinMoney: this.coinMoney,
      coinCount: this.coinCount,
      reachedGoal: this.reachedGoal,
    };
  }
}
