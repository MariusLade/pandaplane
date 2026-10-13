import { describe, expect, it } from 'vitest';
import { makeEnemy, updateEnemy } from '../src/game/combat';
import { Flight } from '../src/game/flight';
import { CANYON, VALLEY } from '../src/game/maps';
import { START_EQUIPPED, loadoutFor, type Equipped } from '../src/game/upgrades';
import { World } from '../src/game/world';

function airborne(gear: Partial<Equipped>, gadgets: string[] = [], map = CANYON) {
  const f = new Flight(new World(7, 7, map), loadoutFor({ ...START_EQUIPPED, ramp: 'tall', glider: 'hang', ...gear }, [], gadgets));
  f.start();
  while (f.phase === 'ramp') f.step(1 / 120, { pitch: 0, boost: false });
  return f;
}

describe('combat', () => {
  it('crows home in on the panda', () => {
    const e = makeEnemy(1, 'crow', 100, 50);
    for (let i = 0; i < 240; i++) updateEnemy(e, 0, 40, 0, 0, 1 / 120);
    expect(e.x).toBeLessThan(100);
    // Heading back towards the panda on the left.
    expect(Math.abs(Math.atan2(e.vy, e.vx))).toBeGreaterThan(Math.PI / 2);
  });

  it('bandits lob pinecones', () => {
    const e = makeEnemy(1, 'bandit', 60, 40);
    let thrown = 0;
    for (let i = 0; i < 600; i++) if (updateEnemy(e, 0, 40, 20, 0, 1 / 120)) thrown++;
    expect(thrown).toBeGreaterThan(1);
  });

  it('a straight shot hits a crow dead ahead', () => {
    const f = airborne({ weapon: 'peas' });
    f.pitch = Math.atan2(f.vy, f.vx);
    f.enemies.push(makeEnemy(999, 'crow', f.x + Math.cos(f.pitch) * 45, f.y + Math.sin(f.pitch) * 45));
    for (let i = 0; i < 90; i++) f.step(1 / 120, { pitch: 0, boost: false, fire: true });
    expect(f.kills).toBe(1);
    expect(f.bounty).toBeGreaterThan(0);
  });

  it('getting hit slows the panda and costs coins; a shield blocks it', () => {
    const f = airborne({});
    f.coinMoney = 50;
    const before = Math.hypot(f.vx, f.vy);
    f.enemies.push(makeEnemy(999, 'crow', f.x + 0.5, f.y));
    f.step(1 / 120, { pitch: 0, boost: false });
    expect(Math.hypot(f.vx, f.vy)).toBeLessThan(before * 0.8);
    expect(f.coinMoney).toBe(40);

    const g = airborne({}, ['shield']);
    g.coinMoney = 50;
    const v0 = Math.hypot(g.vx, g.vy);
    g.enemies.push(makeEnemy(999, 'crow', g.x + 0.5, g.y));
    g.step(1 / 120, { pitch: 0, boost: false });
    expect(g.shield).toBe(1);
    expect(g.coinMoney).toBe(50);
    expect(Math.hypot(g.vx, g.vy)).toBeGreaterThan(v0 * 0.95);
  });

  it('no enemies in the valley', () => {
    const f = airborne({}, [], VALLEY);
    for (let i = 0; i < 120 * 20 && f.phase === 'air'; i++) f.step(1 / 120, { pitch: 0, boost: false });
    expect(f.enemies.length).toBe(0);
  });

  it('thermals lift a glider', () => {
    const w = new World(7, 7, CANYON);
    const th = w.thermalsIn(0, 20000)[0];
    expect(th).toBeTruthy();
    expect(w.updraft(th.x, w.rawGround(th.x) + 20)).toBeGreaterThan(5);
    expect(w.updraft(th.x + th.halfWidth * 2, w.rawGround(th.x) + 20)).toBe(0);
  });
});
