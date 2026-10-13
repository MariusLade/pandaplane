import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/game/autopilot';
import { GOAL_DISTANCE } from '../src/game/constants';
import { Flight } from '../src/game/flight';
import { CATEGORIES, loadoutFor, type Levels } from '../src/game/upgrades';
import { World } from '../src/game/world';

function fly(levels: Levels, seed = 1234, day = 1) {
  const f = new Flight(new World(seed, seed + day), loadoutFor(levels));
  f.start();
  const dt = 1 / 120;
  while (f.phase !== 'done') f.step(dt, autopilot(f));
  return f.result();
}

const uniform = (n: number): Levels => Object.fromEntries(CATEGORIES.map((c) => [c, n])) as Levels;

describe('balance', () => {
  const results = [0, 1, 2, 3, 4, 5].map((n) => ({ n, r: fly(uniform(n)) }));

  it('prints a progression table', () => {
    for (const { n, r } of results) {
      console.log(
        `tier ${n}: ${r.distance.toFixed(0).padStart(6)} m  alt ${r.maxAltitude.toFixed(0).padStart(5)}  ` +
          `v ${(r.maxSpeed * 3.6).toFixed(0).padStart(4)} km/h  air ${r.airtime.toFixed(1).padStart(5)} s  coins ${r.coinMoney}`,
      );
    }
  });

  it('starter gear makes a short but non-trivial hop', () => {
    expect(results[0].r.distance).toBeGreaterThan(40);
    expect(results[0].r.distance).toBeLessThan(400);
  });

  it('each tier flies further than the last', () => {
    for (let i = 1; i < results.length; i++) expect(results[i].r.distance).toBeGreaterThan(results[i - 1].r.distance);
  });

  it('max gear can reach the goal', () => {
    expect(results[5].r.distance).toBeGreaterThan(GOAL_DISTANCE);
  });

  it('is deterministic', () => {
    expect(fly(uniform(3))).toEqual(fly(uniform(3)));
  });
});
