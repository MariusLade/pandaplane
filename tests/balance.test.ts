import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/game/autopilot';
import { GOAL_DISTANCE } from '../src/game/constants';
import { Flight } from '../src/game/flight';
import {
  CATALOG,
  CATEGORIES,
  loadoutByIndex,
  loadoutFor,
  type Category,
  type Equipped,
  type Loadout,
} from '../src/game/upgrades';
import { World } from '../src/game/world';

function fly(gear: Loadout, seed = 1234, day = 1) {
  const f = new Flight(new World(seed, seed + day), gear);
  f.start();
  const dt = 1 / 120;
  while (f.phase !== 'done') f.step(dt, autopilot(f));
  return f.result();
}

/** Sensible builds at increasing budgets. */
const BUILDS: { name: string; gear: Equipped }[] = [
  { name: 'starter', gear: { ramp: 'bump', sled: 'box', glider: 'none', rocket: 'none', fuel: 'thimble' } },
  { name: 'early', gear: { ramp: 'wooden', sled: 'plastic', glider: 'leaf', rocket: 'firework', fuel: 'bottle' } },
  { name: 'mid', gear: { ramp: 'tall', sled: 'racing', glider: 'hang', rocket: 'model', fuel: 'jerry' } },
  { name: 'late', gear: { ramp: 'mega', sled: 'bobsled', glider: 'carbon', rocket: 'turbo', fuel: 'barrel' } },
  { name: 'endgame', gear: { ramp: 'mountain', sled: 'hover', glider: 'albatross', rocket: 'space', fuel: 'reactor' } },
];

const atFraction = (t: number) =>
  loadoutByIndex(
    Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(t * (CATALOG[c].length - 1))])) as Record<Category, number>,
  );

describe('balance', () => {
  const results = BUILDS.map((b) => ({ name: b.name, r: fly(loadoutFor(b.gear)) }));

  it('prints a progression table', () => {
    for (const { name, r } of results) {
      console.log(
        `${name.padEnd(8)}: ${r.distance.toFixed(0).padStart(6)} m  alt ${r.maxAltitude.toFixed(0).padStart(5)}  ` +
          `v ${(r.maxSpeed * 3.6).toFixed(0).padStart(4)} km/h  air ${r.airtime.toFixed(1).padStart(5)} s`,
      );
    }
  });

  it('starter gear makes a short but non-trivial hop', () => {
    expect(results[0].r.distance).toBeGreaterThan(30);
    expect(results[0].r.distance).toBeLessThan(250);
  });

  it('pricier builds fly further', () => {
    for (let i = 1; i < results.length; i++) expect(results[i].r.distance).toBeGreaterThan(results[i - 1].r.distance);
  });

  it('the endgame build can reach the goal', () => {
    expect(results[results.length - 1].r.distance).toBeGreaterThan(GOAL_DISTANCE);
  });

  it('no build breaks physics', () => {
    for (let t = 0; t <= 1; t += 0.1) expect(fly(atFraction(t)).distance).toBeLessThan(30000);
  });

  it('every item is a usable upgrade over the starter gear', () => {
    const base = fly(atFraction(0)).distance;
    for (const c of CATEGORIES) {
      CATALOG[c].forEach((_, i) => {
        if (i === 0) return;
        const idx = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
        idx[c] = i;
        // A rocket needs nothing else to be useful; fuel only matters with a rocket.
        if (c === 'fuel') idx.rocket = 1;
        const d = fly(loadoutByIndex(idx)).distance;
        expect(d, `${c} #${i}`).toBeGreaterThan(base * 0.9);
      });
    }
  });

  it('is deterministic', () => {
    expect(fly(atFraction(0.6))).toEqual(fly(atFraction(0.6)));
  });
});
