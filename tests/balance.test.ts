import { describe, expect, it } from 'vitest';
import { autopilot } from '../src/game/autopilot';
import { GOAL_DISTANCE } from '../src/game/constants';
import { Flight } from '../src/game/flight';
import { CATALOG, CATEGORIES, loadoutByIndex, type Category, type Loadout } from '../src/game/upgrades';
import { World } from '../src/game/world';

function fly(gear: Loadout, seed = 1234, day = 1) {
  const f = new Flight(new World(seed, seed + day), gear);
  f.start();
  const dt = 1 / 120;
  while (f.phase !== 'done') f.step(dt, autopilot(f));
  return f.result();
}

/** Every category at the same relative position in its (cost-sorted) shop. */
const atFraction = (t: number) =>
  loadoutByIndex(
    Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(t * (CATALOG[c].length - 1))])) as Record<Category, number>,
  );

const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

describe('balance', () => {
  const results = STEPS.map((t) => ({ t, r: fly(atFraction(t)) }));

  it('prints a progression table', () => {
    for (const { t, r } of results) {
      console.log(
        `shop ${String(t * 100).padStart(3)}%: ${r.distance.toFixed(0).padStart(6)} m  alt ${r.maxAltitude.toFixed(0).padStart(5)}  ` +
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

  it('the most expensive build can reach the goal', () => {
    expect(results[results.length - 1].r.distance).toBeGreaterThan(GOAL_DISTANCE);
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
