import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/game/autopilot';
import { CANYON, STORM, VALLEY, type MapDef } from '../src/game/maps';
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

function fly(gear: Loadout, seed = 1234, day = 1, map: MapDef = VALLEY) {
  const f = new Flight(new World(seed, seed + day, map), gear);
  f.start();
  const dt = 1 / 120;
  while (f.phase !== 'done') f.step(dt, autopilot(f));
  return f.result();
}

/** Sensible builds at increasing budgets. */
const BUILDS: { name: string; gear: Equipped }[] = [
  { name: 'starter', gear: { ramp: 'bump', sled: 'box', glider: 'none', rocket: 'none', fuel: 'thimble', weapon: 'none' } },
  { name: 'early', gear: { ramp: 'wooden', sled: 'plastic', glider: 'leaf', rocket: 'firework', fuel: 'bottle', weapon: 'none' } },
  { name: 'mid', gear: { ramp: 'tall', sled: 'racing', glider: 'hang', rocket: 'model', fuel: 'jerry', weapon: 'none' } },
  { name: 'late', gear: { ramp: 'mega', sled: 'bobsled', glider: 'carbon', rocket: 'turbo', fuel: 'barrel', weapon: 'none' } },
  { name: 'endgame', gear: { ramp: 'mountain', sled: 'hover', glider: 'albatross', rocket: 'space', fuel: 'reactor', weapon: 'none' } },
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
    expect(results[results.length - 1].r.distance).toBeGreaterThan(VALLEY.goal);
  });

  it('no build breaks physics', () => {
    for (let t = 0; t <= 1; t += 0.1) expect(fly(atFraction(t)).distance).toBeLessThan(30000);
  });

  it('every item is a usable upgrade over the starter gear', () => {
    const base = fly(atFraction(0)).distance;
    for (const c of CATEGORIES) {
      if (c === 'weapon') continue;
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

  it('the canyon is harder, but its own endgame gear can cross it', () => {
    const valleyEnd = loadoutFor(BUILDS[BUILDS.length - 1].gear);
    const canyonValleyGear = fly(valleyEnd, 1234, 1, CANYON);
    const best = loadoutFor(
      { ramp: 'volcano', sled: 'obsidian', glider: 'phoenix', rocket: 'magma', fuel: 'lavacell', weapon: 'laser' },
      [],
      ['shield', 'suit'],
    );
    const canyonBest = fly(best, 1234, 1, CANYON);
    console.log(`canyon with valley endgame gear: ${canyonValleyGear.distance.toFixed(0)} m, kills ${canyonValleyGear.kills}`);
    console.log(`canyon with canyon endgame gear: ${canyonBest.distance.toFixed(0)} m, kills ${canyonBest.kills}`);
    expect(canyonValleyGear.distance).toBeLessThan(CANYON.goal);
    expect(canyonBest.distance).toBeGreaterThan(CANYON.goal);
  });

  it('the storm coast needs its own gear', () => {
    const canyonEnd = loadoutFor(
      { ramp: 'volcano', sled: 'obsidian', glider: 'phoenix', rocket: 'magma', fuel: 'lavacell', weapon: 'laser' },
      [],
      ['shield', 'suit'],
    );
    const stormEnd = loadoutFor(
      { ramp: 'cliff', sled: 'jetski', glider: 'stormkite', rocket: 'thunder', fuel: 'stormcell', weapon: 'zapper' },
      [],
      ['shield', 'rod'],
    );
    const a = fly(canyonEnd, 1234, 1, STORM);
    const b = fly(stormEnd, 1234, 1, STORM);
    console.log(`storm with canyon endgame gear: ${a.distance.toFixed(0)} m; with storm gear: ${b.distance.toFixed(0)} m`);
    expect(a.distance).toBeLessThan(STORM.goal);
    expect(b.distance).toBeGreaterThan(STORM.goal);
  });

  it('is deterministic', () => {
    expect(fly(atFraction(0.6))).toEqual(fly(atFraction(0.6)));
  });
});
