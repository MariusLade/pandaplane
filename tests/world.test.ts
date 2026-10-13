import { describe, expect, it } from 'vitest';
import { CLIFF_HEIGHT } from '../src/game/constants';
import { buildRamp, rampAt } from '../src/game/ramp';
import { RAMPS } from '../src/game/upgrades';
import { biomeAt, BIOMES, World } from '../src/game/world';
import { fbm1, hash, mulberry32 } from '../src/core/rng';

describe('rng', () => {
  it('mulberry32 is deterministic and in range', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hash and noise are stable and bounded', () => {
    expect(hash(1, 2, 3)).toBe(hash(1, 2, 3));
    expect(hash(1, 2, 3)).not.toBe(hash(1, 2, 4));
    for (let x = -50; x < 50; x += 0.37) {
      const n = fbm1(9, x);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
    }
  });
});

describe('world', () => {
  const world = new World(1234, 99);

  it('has a plateau at the launch site and a continuous ground', () => {
    expect(world.groundY(-5)).toBeCloseTo(CLIFF_HEIGHT, 0);
    let prev = world.groundY(0);
    for (let x = 0.5; x < 8000; x += 0.5) {
      const y = world.groundY(x);
      expect(Math.abs(y - prev)).toBeLessThan(1.5);
      prev = y;
    }
  });

  it('valley sits well below the cliff', () => {
    expect(world.groundY(120)).toBeLessThan(CLIFF_HEIGHT - 15);
  });

  it('terrain depends only on the world seed', () => {
    const other = new World(1234, 5);
    for (let x = 0; x < 3000; x += 97) expect(other.groundY(x)).toBe(world.groundY(x));
  });

  it('generates pickups above the ground, deterministically', () => {
    const a = world.pickupsIn(0, 3000);
    const b = new World(1234, 99).pickupsIn(0, 3000);
    expect(a.length).toBeGreaterThan(10);
    expect(a.map((p) => [p.kind, p.x, p.y])).toEqual(b.map((p) => [p.kind, p.x, p.y]));
    for (const p of a) expect(p.y).toBeGreaterThan(world.groundY(p.x));
  });

  it('walks through every biome in order', () => {
    const names = BIOMES.map((b) => b.name);
    expect(biomeAt(0).a.name).toBe(names[0]);
    expect(biomeAt(1e6).a.name).toBe(names[names.length - 1]);
  });
});

describe('ramp', () => {
  it('drops by the tier height and ends at x = 0 pointing up', () => {
    for (const tier of RAMPS) {
      const r = buildRamp(tier);
      expect(r.lip.x).toBeCloseTo(0, 6);
      expect(r.top.y - r.minY).toBeCloseTo(tier.height, 3);
      expect(r.lip.angle).toBeGreaterThan(0);
      expect(rampAt(r, r.length).x).toBeCloseTo(0, 6);
    }
  });
});
