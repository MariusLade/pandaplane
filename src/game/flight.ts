import { clamp, lerp, wrapAngle } from '../core/math';
import {
  ATMO_SCALE,
  BALLOON_LIFT,
  BODY_DRAG,
  BODY_LIFT,
  BOUNCE_SPEED,
  BROADSIDE_DRAG,
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
import { mulberry32 } from '../core/rng';
import { ENEMY_STATS, beamHit, makeEnemy, segDist2, updateEnemy, updateShot, type Enemy, type Shot } from './combat';
import type { EnemyKind } from './maps';
import { gadgetMax, gadgetMul, gadgetSum, hasGadget } from './upgrades';
import { mainBiome, type Pickup, type World } from './world';

export type Phase = 'ready' | 'ramp' | 'air' | 'done';

export interface FlightInput {
  /** -1 = nose down, +1 = nose up. */
  pitch: number;
  boost: boolean;
  /** Hold to shoot (if a weapon is equipped). */
  fire?: boolean;
}

export type FlightEventType =
  | 'launch'
  | 'coin'
  | 'bigcoin'
  | 'ring'
  | 'balloon'
  | 'impact'
  | 'splash'
  | 'flap'
  | 'lava'
  | 'thermal'
  | 'shoot'
  | 'enemyHit'
  | 'enemyDown'
  | 'hurt'
  | 'shielded'
  | 'goal'
  | 'done';

export interface FlightEvent {
  type: FlightEventType;
  x: number;
  y: number;
  /** Impact speed, money value, etc. */
  amount: number;
  /** Extra detail (weapon style, enemy kind…). */
  tag?: string;
}

export interface FlightResult {
  distance: number;
  maxAltitude: number;
  maxSpeed: number;
  airtime: number;
  coinMoney: number;
  coinCount: number;
  reachedGoal: boolean;
  kills: number;
  bounty: number;
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

/** Seconds of coasting before refilling gear starts to recharge. */
const REGEN_DELAY = 1.5;
/** Refilling gear can regain at most this many full tanks per flight. */
const REGEN_REFILLS = 2;
/** First enemy spawn, and how far ahead of the panda enemies appear. */
const FIRST_ENEMY_X = 220;
const PANDA_HIT_RADIUS = 1.1;
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
  /** Wing beats left (gliders with flaps). */
  flapsLeft: number;
  /** Seconds of uninterrupted burn, for spooling rockets. */
  private burnFor = 0;
  private coastFor = 0;
  /** Boost seconds that can still be regained this flight. */
  private regenBudget: number;
  private boostHeld = false;
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
  private prevStepX = 0;
  private prevStepY = 0;

  // Combat.
  readonly enemies: Enemy[] = [];
  readonly shots: Shot[] = [];
  ammo: number;
  shield: number;
  kills = 0;
  bounty = 0;
  /** Last laser beam, for drawing: start, angle, length and age. */
  beam: { x: number; y: number; a: number; len: number; age: number } | null = null;
  private fireCooldown = 0;
  private nextSpawnX = FIRST_ENEMY_X;
  private enemyId = 0;
  private readonly rng: () => number;
  private readonly coinMul: number;
  /** Vertical wind (thermal) felt this step, m/s. */
  updraft = 0;

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
    this.flapsLeft = gear.glider.flaps ?? 0;
    this.regenBudget = this.maxFuel * REGEN_REFILLS;
    this.ammo = Math.round(gear.weapon.ammo * gadgetMul(gear, 'ammoMul'));
    this.shield = gadgetSum(gear, 'shield');
    this.coinMul = gadgetMul(gear, 'coinMul');
    this.rng = mulberry32(world.pickupSeed ^ 0x51ed);
  }

  /** Current rocket push as acceleration for a reference-weight panda. */
  get thrust(): number {
    const { rocket, fuel } = this.gear;
    let t = rocket.thrust * (fuel.thrustMul ?? 1);
    if (rocket.spool) t *= 0.6 + 1.4 * Math.min(1, this.burnFor / rocket.spool);
    return t;
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
    this.prevStepX = this.x;
    this.prevStepY = this.y;
    if (this.beam) {
      this.beam.age += dt;
      if (this.beam.age > 0.15) this.beam = null;
    }
    if (this.phase === 'ready' || this.phase === 'done') return;
    this.time += dt;
    const { rocket, fuel } = this.gear;
    const canBoost = input.boost && this.fuel > 0 && rocket.thrust > 0;
    this.boosting = canBoost;
    if (canBoost) {
      this.fuel = Math.max(0, this.fuel - dt);
      this.burnFor += dt;
      this.coastFor = 0;
    } else {
      this.burnFor = 0;
      this.coastFor += dt;
      // Kettles and solar panels top the tank back up after a short coast,
      // up to a couple of tankfuls per flight.
      const regen = (rocket.regen ?? 0) + (fuel.regen ?? 0) / rocket.burn;
      if (regen > 0 && rocket.thrust > 0 && this.phase === 'air' && this.coastFor > REGEN_DELAY) {
        const add = Math.min(regen * dt, this.maxFuel - this.fuel, this.regenBudget);
        this.fuel += add;
        this.regenBudget -= add;
      }
    }
    // A fresh press of BOOST with no rocket power left beats the wings instead.
    const pressed = input.boost && !this.boostHeld;
    this.boostHeld = input.boost;
    if (pressed && !canBoost && this.phase === 'air' && !this.onGround && this.flapsLeft > 0) this.flap();

    if (this.phase === 'ramp') this.stepRamp(dt, canBoost);
    else this.stepAir(dt, input, canBoost);

    const speed = this.speed;
    if (this.phase === 'air') {
      this.maxSpeed = Math.max(this.maxSpeed, speed);
      this.maxAltitude = Math.max(this.maxAltitude, this.y);
      this.maxX = Math.max(this.maxX, this.x);
      this.collectPickups(dt);
      this.combat(dt, input);
      const goal = this.world.map.goal;
      if (!this.reachedGoal && this.x >= goal) {
        this.reachedGoal = true;
        this.emit('goal', goal);
      }
      this.checkStop(dt, speed);
    }
    if (this.time > MAX_TIME) this.finish();
  }

  private stepRamp(dt: number, boost: boolean): void {
    const p = rampAt(this.ramp, this.rampS);
    const mu = this.gear.sled.friction * RAMP_FRICTION_SCALE * (this.gear.ramp.ice ?? 1);
    let a = -GRAVITY * Math.sin(p.angle) - mu * GRAVITY * Math.cos(p.angle);
    a -= BODY_DRAG * this.gear.sled.drag * this.rampV * this.rampV * this.lightness;
    if (boost) a += this.thrust * this.lightness;
    this.rampV = Math.max(0.5, this.rampV + a * dt);
    this.rampS += this.rampV * dt;
    const q = rampAt(this.ramp, this.rampS);
    this.x = q.x;
    this.y = q.y;
    this.pitch = q.angle;
    if (this.rampS >= this.ramp.length) {
      const lip = this.ramp.lip;
      this.rampV += this.gear.ramp.kick ?? 0;
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
    const { glider, sled } = this.gear;
    const rho = Math.exp(-Math.max(0, this.y) / ATMO_SCALE);
    // Thermals: the wings feel the air moving, so lift and drag use the
    // velocity relative to the rising air.
    const thermalMul = (glider.thermal ?? 1) * (hasGadget(this.gear, 'heatSuit') ? 1.5 : 1);
    const wasIn = this.updraft > 1;
    this.updraft = this.onGround ? 0 : this.world.updraft(this.x, this.y) * thermalMul;
    if (!wasIn && this.updraft > 1) this.emit('thermal', this.updraft);
    const rvx = this.vx;
    const rvy = this.vy - this.updraft;
    const v = Math.hypot(rvx, rvy);
    let ax = 0;
    let ay = -GRAVITY;
    let alpha = 0;

    if (v > 0.05) {
      const ux = rvx / v;
      const uy = rvy / v;
      alpha = wrapAngle(this.pitch - Math.atan2(rvy, rvx));
      const stall = (glider.stallDeg * Math.PI) / 180;
      // A magic carpet keeps its peak lift past the stall angle.
      const peak = LIFT_SLOPE * stall;
      const cl = glider.noStall ? clamp(LIFT_SLOPE * alpha, -peak, peak) : liftCoefficient(alpha, stall);
      const plate = glider.noStall ? WING_PLATE_DRAG * 0.25 : WING_PLATE_DRAG;
      const kLift = BODY_LIFT + glider.lift;
      const q = rho * v * v;
      const sinA = Math.sin(alpha);
      const lift = kLift * cl * q;
      const dragK =
        BODY_DRAG * sled.drag * glider.tuck * (1 + BROADSIDE_DRAG * sinA * sinA) +
        glider.drag +
        kLift * (glider.induced * cl * cl + plate * sinA * sinA);
      const drag = dragK * q * this.lightness;
      ax += -uy * lift * this.lightness - ux * drag;
      ay += ux * lift * this.lightness - uy * drag;
      this.stalled = glider.lift > 0 && !glider.noStall && Math.abs(alpha) > stall;
      // A propeller hat only fights falling.
      if (glider.rotor && this.vy < 0) ay += glider.rotor * this.vy * this.vy * rho * this.lightness;
    }
    this.angleOfAttack = alpha;

    if (boost) {
      ax += Math.cos(this.pitch) * this.thrust * this.lightness;
      ay += Math.sin(this.pitch) * this.thrust * this.lightness;
    }

    // Pitch: player input fights a weathervane torque that turns the nose into the wind.
    if (this.onGround) {
      const target = Math.atan(this.world.slope(this.x));
      this.pitch += wrapAngle(target - this.pitch) * Math.min(1, dt * 10);
      this.pitch += input.pitch * PITCH_RATE * 0.25 * dt;
    } else {
      // In the air the nose only moves when the player tilts it: holding the
      // right angle of attack (and avoiding stalls) is the pilot's job.
      const rate = PITCH_RATE * glider.control * Math.sqrt(this.lightness);
      this.pitch += input.pitch * rate * dt;
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
      const { sled } = this.gear;
      const surface = this.world.surfaceAt(this.x);
      if (surface === 'lava') {
        this.lavaBounce(tx, ty, nx, ny, vt);
        this.onGround = false;
        return;
      }
      // Ice is slick; water drags, but a shallow, fast landing skips like a stone.
      const surfaceGrip = surface === 'ice' ? 0.25 : surface === 'water' ? 1.6 : 1;
      const grip = (sled.groundGlide ?? 1) * surfaceGrip;
      const skipping = surface === 'water' && impact < Math.abs(vt) * 0.35 && Math.abs(vt) > 10;
      // Sliding friction for resting contact; a gentler share for the crash itself,
      // so a hard landing turns into a long slide rather than a dead stop.
      const mu = (GROUND_FRICTION + sled.friction) * grip;
      const muCrash = (IMPACT_FRICTION + sled.friction * 0.5) * (skipping ? 0.3 : grip);
      const loss = mu * Math.min(impact, 3) + muCrash * Math.max(0, impact - 3);
      vt = Math.sign(vt) * Math.max(0, Math.abs(vt) - loss);
      const restitution = skipping ? 0.65 : (sled.bounce ?? RESTITUTION);
      const threshold = skipping ? 1 : sled.bounce ? BOUNCE_SPEED * 0.4 : BOUNCE_SPEED;
      const bounce = impact > threshold ? impact * restitution : 0;
      this.vx = tx * vt + nx * bounce;
      this.vy = ty * vt + ny * bounce;
      if (impact > 3 && this.sinceContact > 0.15) this.emit(surface === 'water' ? 'splash' : 'impact', impact);
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

  /** Lava is too hot to land on: it throws the panda back up. */
  private lavaBounce(tx: number, ty: number, nx: number, ny: number, vt: number): void {
    const suit = hasGadget(this.gear, 'heatSuit');
    const up = suit ? 22 : 15;
    // Always keep drifting across the pool so a slow panda can't bounce forever.
    const dir = vt < 0 ? -1 : 1;
    const forward = suit ? Math.max(vt, 0) + 12 : dir * Math.max(6, Math.abs(vt) * 0.75);
    this.vx = tx * forward + nx * up;
    this.vy = ty * forward + ny * up;
    this.y += 0.3;
    this.emit('lava', suit ? 1 : 0);
  }

  /** One wing beat: a shove forward and up, relative to the nose. */
  private flap(): void {
    const a = this.pitch + 0.6;
    const dv = 7.5 * Math.sqrt(this.lightness);
    this.vx += Math.cos(a) * dv;
    this.vy += Math.sin(a) * dv;
    this.flapsLeft--;
    this.emit('flap', this.flapsLeft);
  }

  finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.boosting = false;
    this.emit('done', this.distance);
  }

  private collectPickups(dt: number): void {
    const magnet = gadgetMax(this.gear, 'magnet');
    const look = 8 + magnet + Math.abs(this.x - this.prevStepX);
    this.nearby.length = 0;
    this.world.pickupsIn(this.x - look, this.x + look, this.nearby);
    for (const p of this.nearby) {
      if (p.taken) continue;
      // Coin magnet: coins drift towards the panda.
      if (magnet > 0 && (p.kind === 'coin' || p.kind === 'bigcoin')) {
        const dx = this.x - p.x;
        const dy = this.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < magnet && d > 0.01) {
          const pull = Math.min(d, (25 + Math.hypot(this.vx, this.vy)) * dt);
          p.x += (dx / d) * pull;
          p.y += (dy / d) * pull;
        }
      }
      // Swept test against the path travelled this step, so fast flights never skip a pickup.
      const r = p.radius * (p.kind === 'ring' ? 1.15 : 1) + PICKUP_REACH;
      if (segDist2(p.x, p.y, this.prevStepX, this.prevStepY, this.x, this.y) > r * r) continue;
      p.taken = true;
      switch (p.kind) {
        case 'coin':
        case 'bigcoin': {
          const value = Math.round(p.value * this.coinMul);
          this.coinMoney += value;
          this.coinCount++;
          this.emit(p.kind, value);
          break;
        }
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

  // ------------------------------------------------------------ combat

  private combat(dt: number, input: FlightInput): void {
    this.spawnEnemies();
    const px = this.x;
    const py = this.y;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const thrown = updateEnemy(e, px, py, this.vx, this.vy, dt);
      if (thrown) this.shots.push(thrown);
      const reach = e.radius + PANDA_HIT_RADIUS;
      if (segDist2(e.x, e.y, this.prevStepX, this.prevStepY, px, py) < reach * reach) this.ram(e);
      // Out of the picture: left far behind or lost.
      if (e.x < px - 180 || Math.abs(e.y - py) > 500) e.dead = true;
    }
    this.fireWeapon(dt, input);
    for (const sh of this.shots) {
      if (sh.dead) continue;
      const ox = sh.x;
      const oy = sh.y;
      updateShot(sh, this.enemies, dt);
      if (sh.y < this.world.groundY(sh.x)) {
        if (sh.blast) this.explode(sh.x, sh.y, sh.blast, sh.damage);
        sh.dead = true;
        continue;
      }
      if (sh.friendly) {
        for (const e of this.enemies) {
          if (e.dead || sh.hits.includes(e.id)) continue;
          // Generous: shots only need to pass close by.
          const r = e.radius + 1.1;
          if (segDist2(e.x, e.y, ox, oy, sh.x, sh.y) > r * r) continue;
          sh.hits.push(e.id);
          if (sh.blast) {
            this.explode(sh.x, sh.y, sh.blast, sh.damage);
            sh.dead = true;
          } else {
            this.damage(e, sh.damage);
            if (sh.pierce-- <= 0) sh.dead = true;
          }
          if (sh.dead) break;
        }
      } else {
        const r = PANDA_HIT_RADIUS + 0.4;
        if (segDist2(this.x, this.y, ox, oy, sh.x, sh.y) < r * r) {
          sh.dead = true;
          this.hurt(0.85, 4);
        }
      }
    }
    // Tidy up.
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.shots[i].dead) this.shots.splice(i, 1);
  }

  /** Enemies appear ahead of the panda, at its altitude, as it travels. */
  private spawnEnemies(): void {
    if (this.x < this.nextSpawnX) return;
    const speed = Math.hypot(this.vx, this.vy);
    const ahead = 90 + Math.min(220, speed * 1.3);
    const sx = this.x + ahead;
    const biome = mainBiome(this.world.biomeAt(sx));
    if (!biome.enemies || biome.enemies.length === 0) {
      this.nextSpawnX = this.x + 150;
      return;
    }
    const r = this.rng;
    const total = biome.enemies.reduce((s, [, w]) => s + w, 0);
    let roll = r() * total;
    let kind: EnemyKind = biome.enemies[0][0];
    for (const [k, w] of biome.enemies) {
      roll -= w;
      if (roll <= 0) {
        kind = k;
        break;
      }
    }
    const ground = this.world.groundY(sx);
    const y = Math.max(ground + 8, this.y + (kind === 'bandit' ? 5 + r() * 35 : -10 + r() * 24));
    // Crows sometimes come in pairs.
    const count = kind === 'crow' && r() < 0.35 ? 2 : 1;
    for (let i = 0; i < count; i++) this.enemies.push(makeEnemy(this.enemyId++, kind, sx + i * 6, y + i * 4));
    this.nextSpawnX = this.x + (biome.enemyGap ?? 150) * (0.6 + r() * 0.8);
  }

  private fireWeapon(dt: number, input: FlightInput): void {
    const w = this.gear.weapon;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (!input.fire || w.rate <= 0 || this.ammo <= 0 || this.fireCooldown > 0 || this.onGround) return;
    this.fireCooldown = 1 / w.rate;
    this.ammo--;
    const a = this.pitch + (this.rng() - 0.5) * 2 * w.spread;
    const mx = this.x + Math.cos(this.pitch) * 1.4;
    const my = this.y + Math.sin(this.pitch) * 1.4;
    this.events.push({ type: 'shoot', x: mx, y: my, amount: this.ammo, tag: w.style });
    if (w.hitscan) {
      const hit = beamHit(this.enemies, mx, my, a, w.hitscan);
      this.beam = { x: mx, y: my, a, len: hit.length, age: 0 };
      if (hit.enemy) this.damage(hit.enemy, w.damage);
      return;
    }
    this.shots.push({
      x: mx,
      y: my,
      vx: this.vx + Math.cos(a) * w.speed,
      vy: this.vy + Math.sin(a) * w.speed,
      life: w.homing ? 3.5 : 2.5,
      friendly: true,
      damage: w.damage,
      gravity: !!w.gravity,
      homing: !!w.homing,
      blast: w.blast ?? 0,
      pierce: w.pierce ?? 0,
      style: w.style,
      hits: [],
      dead: false,
    });
  }

  private damage(e: Enemy, amount: number): void {
    if (e.dead) return;
    e.hp -= amount;
    e.hurt = 0.15;
    if (e.hp > 0) {
      this.events.push({ type: 'enemyHit', x: e.x, y: e.y, amount, tag: e.kind });
      return;
    }
    e.dead = true;
    this.kills++;
    const bounty = Math.round(ENEMY_STATS[e.kind].bounty * this.coinMul);
    this.bounty += bounty;
    this.events.push({ type: 'enemyDown', x: e.x, y: e.y, amount: bounty, tag: e.kind });
  }

  private explode(x: number, y: number, radius: number, dmg: number): void {
    this.events.push({ type: 'enemyHit', x, y, amount: radius, tag: 'blast' });
    for (const e of this.enemies) {
      if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < (radius + e.radius) ** 2) this.damage(e, dmg);
    }
  }

  /** The panda collides with an enemy. */
  private ram(e: Enemy): void {
    if (hasGadget(this.gear, 'spikes')) {
      this.damage(e, 99);
      this.vx *= 0.97;
      this.vy *= 0.97;
      return;
    }
    e.dead = true;
    this.hurt(0.7, 10, e.x, e.y);
  }

  /** Slow down and drop some coins, unless a shield takes the hit. */
  private hurt(keep: number, coins: number, x = this.x, y = this.y): void {
    if (this.shield > 0) {
      this.shield--;
      this.events.push({ type: 'shielded', x, y, amount: this.shield });
      return;
    }
    this.vx *= keep;
    this.vy *= keep;
    const lost = Math.min(this.coinMoney, coins);
    this.coinMoney -= lost;
    this.events.push({ type: 'hurt', x, y, amount: lost });
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
      kills: this.kills,
      bounty: this.bounty,
    };
  }
}
