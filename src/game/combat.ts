import { clamp } from '../core/math';
import type { EnemyKind } from './maps';
import type { WeaponItem } from './upgrades';

/**
 * Enemies and projectiles for maps that have them. Pure simulation: the
 * Flight owns the arrays and calls these helpers every step.
 */
export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  /** Seconds alive, for animation and wobble. */
  age: number;
  /** Seconds until a bandit throws again. */
  cooldown: number;
  /** Flashes white briefly after a hit. */
  hurt: number;
  dead: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** true = fired by the panda; false = thrown at the panda. */
  friendly: boolean;
  damage: number;
  gravity: boolean;
  homing: boolean;
  blast: number;
  pierce: number;
  style: WeaponItem['style'] | 'pinecone';
  /** Enemies already hit (for piercing shots). */
  hits: number[];
  dead: boolean;
}

export const ENEMY_STATS: Record<EnemyKind, { hp: number; radius: number; speed: number; bounty: number }> = {
  crow: { hp: 1, radius: 1.1, speed: 17, bounty: 8 },
  bat: { hp: 2, radius: 1.0, speed: 22, bounty: 12 },
  bandit: { hp: 4, radius: 2.2, speed: 4, bounty: 30 },
};

export function makeEnemy(id: number, kind: EnemyKind, x: number, y: number): Enemy {
  const s = ENEMY_STATS[kind];
  return { id, kind, x, y, vx: 0, vy: 0, hp: s.hp, maxHp: s.hp, radius: s.radius, age: 0, cooldown: 1.2, hurt: 0, dead: false };
}

/**
 * Steer an enemy. Crows dive at the panda, bats zigzag at it, bandits drift
 * in their balloon and lob pinecones (returned as a new Shot).
 */
export function updateEnemy(e: Enemy, px: number, py: number, pvx: number, pvy: number, dt: number): Shot | null {
  e.age += dt;
  e.hurt = Math.max(0, e.hurt - dt);
  const s = ENEMY_STATS[e.kind];
  const dx = px - e.x;
  const dy = py - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (e.kind === 'bandit') {
    // Hover, bobbing, drifting slowly towards the panda's altitude.
    e.vx = -2;
    e.vy = clamp(dy * 0.15, -s.speed, s.speed) + Math.sin(e.age * 1.5) * 1.5;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.cooldown -= dt;
    if (e.cooldown <= 0 && dist < 110 && dx < 20) {
      e.cooldown = 1.6;
      // Lead the target and lob with gravity.
      const flight = dist / 40;
      const tx = px + pvx * flight;
      const ty = py + pvy * flight + 0.5 * 9.81 * flight * flight;
      const ax = tx - e.x;
      const ay = ty - e.y;
      const len = Math.hypot(ax, ay) || 1;
      return {
        x: e.x,
        y: e.y - 1,
        vx: (ax / len) * 40,
        vy: (ay / len) * 40,
        life: 4,
        friendly: false,
        damage: 1,
        gravity: true,
        homing: false,
        blast: 0,
        pierce: 0,
        style: 'pinecone',
        hits: [],
        dead: false,
      };
    }
    return null;
  }
  // Crows and bats home in, turning at a limited rate so they can be dodged.
  const speed = s.speed;
  const want = Math.atan2(dy, dx);
  const cur = e.vx || e.vy ? Math.atan2(e.vy, e.vx) : want;
  let diff = want - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = (e.kind === 'bat' ? 2.2 : 1.6) * dt;
  const ang = cur + clamp(diff, -turn, turn);
  e.vx = Math.cos(ang) * speed;
  e.vy = Math.sin(ang) * speed + (e.kind === 'bat' ? Math.sin(e.age * 9) * 9 : 0);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  return null;
}

/** Advance a projectile. Homing shots turn towards the nearest live enemy ahead. */
export function updateShot(sh: Shot, enemies: Enemy[], dt: number): void {
  sh.life -= dt;
  if (sh.life <= 0) sh.dead = true;
  if (sh.gravity) sh.vy -= 9.81 * dt;
  if (sh.homing) {
    let best: Enemy | null = null;
    let bestD = 80 * 80;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = (e.x - sh.x) ** 2 + (e.y - sh.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      const speed = Math.hypot(sh.vx, sh.vy);
      const want = Math.atan2(best.y - sh.y, best.x - sh.x);
      const cur = Math.atan2(sh.vy, sh.vx);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const ang = cur + clamp(diff, -6 * dt, 6 * dt);
      sh.vx = Math.cos(ang) * speed;
      sh.vy = Math.sin(ang) * speed;
    }
  }
  sh.x += sh.vx * dt;
  sh.y += sh.vy * dt;
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by), squared. */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

/** First enemy hit by a beam from (x,y) along angle a, within range. */
export function beamHit(enemies: Enemy[], x: number, y: number, a: number, range: number): { enemy: Enemy | null; length: number } {
  const ex = x + Math.cos(a) * range;
  const ey = y + Math.sin(a) * range;
  let best: Enemy | null = null;
  let bestT = range;
  for (const e of enemies) {
    if (e.dead) continue;
    if (segDist2(e.x, e.y, x, y, ex, ey) > (e.radius + 1.1) ** 2) continue;
    const t = (e.x - x) * Math.cos(a) + (e.y - y) * Math.sin(a);
    if (t > 0 && t < bestT) {
      bestT = t;
      best = e;
    }
  }
  return { enemy: best, length: bestT };
}
