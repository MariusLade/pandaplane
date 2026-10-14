import { describe, expect, it } from 'vitest';
import { makeEnemy, updateEnemy } from '../src/game/combat';
import { Flight } from '../src/game/flight';
import { STORM, VALLEY } from '../src/game/maps';
import { START_EQUIPPED, loadoutFor, type Equipped } from '../src/game/upgrades';
import { World } from '../src/game/world';

/** A panda gliding level at (x, y) on the storm coast. */
function cruising(x: number, y: number, gear: Partial<Equipped> = {}, gadgets: string[] = []) {
  const f = new Flight(new World(7, 7, STORM), loadoutFor({ ...START_EQUIPPED, glider: 'hang', ...gear }, [], gadgets));
  f.start();
  f.phase = 'air';
  f.x = x;
  f.y = y;
  f.vx = 30;
  f.vy = 0;
  f.pitch = 0.05;
  return f;
}

describe('storm coast', () => {
  it('has open sea between the islands', () => {
    const w = new World(7, 7, STORM);
    let sea = 0;
    let land = 0;
    for (let x = 400; x < 8000; x += 5) {
      if (w.surfaceAt(x) === 'water') {
        sea++;
        expect(w.groundY(x)).toBe(w.sea);
      } else land++;
    }
    expect(sea).toBeGreaterThan(200);
    expect(land).toBeGreaterThan(200);
    // Dry maps have no sea at all.
    expect(new World(7, 7, VALLEY).sea).toBe(-Infinity);
  });

  it('tailwinds carry the panda further than still air', () => {
    const still = cruising(3000, 120);
    const windy = cruising(3000, 120);
    (still.world as unknown as { wind: () => number }).wind = () => 0;
    (windy.world as unknown as { wind: () => number }).wind = () => 15;
    for (let i = 0; i < 240; i++) {
      still.step(1 / 120, { pitch: 0, boost: false });
      windy.step(1 / 120, { pitch: 0, boost: false });
    }
    expect(windy.x).toBeGreaterThan(still.x + 3);
    expect(windy.wind).toBeGreaterThan(10);
  });

  it('lightning strikes in the storm, and hurts when it lands on you', () => {
    const f = cruising(10000, 120);
    let thunder = 0;
    for (let i = 0; i < 120 * 6; i++) {
      f.step(1 / 120, { pitch: 0, boost: false });
      thunder += f.events.filter((e) => e.type === 'thunder').length;
      f.events.length = 0;
      f.y = 120;
      f.vy = 0;
    }
    expect(thunder).toBeGreaterThan(0);

    const g = cruising(10000, 120);
    g.coinMoney = 40;
    g.strikes.push({ x: g.x + g.vx / 120, warn: 1 / 240, bolt: 0, top: 650, seed: 1 });
    g.step(1 / 120, { pitch: 0, boost: false });
    expect(g.events.some((e) => e.type === 'zap')).toBe(true);
    expect(g.coinMoney).toBeLessThan(40);
  });

  it('a lightning rod turns a strike into a boost', () => {
    const f = cruising(10000, 120, {}, ['rod']);
    const v0 = Math.hypot(f.vx, f.vy);
    f.strikes.push({ x: f.x + f.vx / 120, warn: 1 / 240, bolt: 0, top: 650, seed: 1 });
    f.step(1 / 120, { pitch: 0, boost: false });
    expect(Math.hypot(f.vx, f.vy)).toBeGreaterThan(v0 + 8);
  });

  it('no lightning above the storm clouds', () => {
    const f = cruising(10000, 900);
    for (let i = 0; i < 120 * 6; i++) {
      f.step(1 / 120, { pitch: 0, boost: false });
      f.y = 900;
      f.vy = 0;
    }
    expect(f.strikes.length).toBe(0);
  });

  it('chain lightning jumps between nearby enemies', () => {
    const f = cruising(3000, 200, { weapon: 'zapper' });
    f.pitch = 0;
    f.vx = 30;
    f.vy = 0;
    f.enemies.push(makeEnemy(900, 'crow', f.x + 40, f.y));
    f.enemies.push(makeEnemy(901, 'crow', f.x + 52, f.y + 8));
    f.enemies.push(makeEnemy(902, 'crow', f.x + 60, f.y - 10));
    f.step(1 / 120, { pitch: 0, boost: false, fire: true });
    expect(f.kills).toBe(3);
  });

  it('flying fish leap up and fall back down', () => {
    const e = makeEnemy(1, 'fish', 0, 0);
    e.vx = -8;
    e.vy = 20;
    let top = 0;
    for (let i = 0; i < 600; i++) {
      updateEnemy(e, -30, 20, 0, 0, 1 / 120);
      top = Math.max(top, e.y);
    }
    expect(top).toBeGreaterThan(15);
    expect(e.y).toBeLessThan(0);
  });
});
