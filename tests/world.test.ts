import { describe, expect, it } from 'vitest';
import { buildRamp, rampAt } from '../src/game/ramp';
import { RAMPS } from '../src/game/upgrades';
import { VALLEY } from '../src/game/maps';
import { mountainHeight, World } from '../src/game/world';
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

  it('has a mountain behind the launch site and a continuous ground', () => {
    expect(world.groundY(0)).toBeCloseTo(0, 6);
    expect(world.groundY(-100)).toBeGreaterThan(40);
    let prev = world.groundY(-300);
    for (let x = -299.5; x < 8000; x += 0.5) {
      const y = world.groundY(x);
      expect(Math.abs(y - prev)).toBeLessThan(1.5);
      prev = y;
    }
  });

  it('the mountain rises monotonically to its summit', () => {
    let prev = 0;
    for (let x = 0; x > -400; x -= 1) {
      const h = mountainHeight(x);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
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
    const names = VALLEY.biomes.map((b) => b.name);
    expect(world.biomeAt(0).a.name).toBe(names[0]);
    expect(world.biomeAt(1e6).a.name).toBe(names[names.length - 1]);
  });
});

describe('ramp', () => {
  it('starts on the mountain at the tier drop and kicks up at x = 0', () => {
    for (const item of RAMPS) {
      const r = buildRamp(item);
      expect(r.lip.x).toBeCloseTo(0, 6);
      // The start gate sits on the hillside, `height` above the valley floor.
      expect(r.top.y).toBeCloseTo(item.height + 0.7, 1);
      expect(r.lip.angle).toBeCloseTo((item.launchDeg * Math.PI) / 180, 6);
      expect(rampAt(r, r.length).x).toBeCloseTo(0, 6);
      // Smooth: no sudden direction changes along the deck.
      for (let i = 1; i < r.points.length; i++) {
        expect(Math.abs(r.points[i].angle - r.points[i - 1].angle)).toBeLessThan(0.12);
      }
    }
  });
});
