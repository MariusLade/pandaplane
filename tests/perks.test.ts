import { describe, expect, it } from 'vitest';
import { Flight, type FlightInput } from '../src/game/flight';
import { START_EQUIPPED, loadoutFor, type Equipped } from '../src/game/upgrades';
import { World } from '../src/game/world';

const idle: FlightInput = { pitch: 0, boost: false };

function launched(gear: Partial<Equipped>) {
  const f = new Flight(new World(11, 11), loadoutFor({ ...START_EQUIPPED, ...gear }));
  f.start();
  while (f.phase === 'ramp') f.step(1 / 120, idle);
  return f;
}

describe('perks', () => {
  it('a spring kicker adds launch speed', () => {
    const plain = launched({ ramp: 'wooden' }).speed;
    const spring = launched({ ramp: 'catapult' }).speed;
    expect(spring).toBeGreaterThan(plain);
  });

  it('an icy deck launches faster than the same drop on wood', () => {
    expect(launched({ ramp: 'icechute' }).speed).toBeGreaterThan(launched({ ramp: 'tall' }).speed);
  });

  it('flaps add speed and run out', () => {
    const f = launched({ ramp: 'tall', glider: 'feathers' });
    const before = Math.hypot(f.vx, f.vy);
    f.step(1 / 120, { pitch: 0, boost: true });
    expect(f.flapsLeft).toBe(5);
    expect(Math.hypot(f.vx, f.vy)).toBeGreaterThan(before);
    // Holding the button is one flap; fresh presses are needed.
    for (let i = 0; i < 10; i++) f.step(1 / 120, { pitch: 0, boost: true });
    expect(f.flapsLeft).toBe(5);
    for (let i = 0; i < 20; i++) {
      f.step(1 / 120, idle);
      f.step(1 / 120, { pitch: 0, boost: true });
    }
    expect(f.flapsLeft).toBe(0);
  });

  it('the flying carpet never stalls', () => {
    const f = launched({ ramp: 'tall', glider: 'carpet' });
    for (let i = 0; i < 240 && f.phase === 'air'; i++) {
      f.step(1 / 120, { pitch: 1, boost: false });
      expect(f.stalled).toBe(false);
    }
  });

  it('refilling fuel is capped per flight', () => {
    const f = launched({ ramp: 'tall', rocket: 'kettle', fuel: 'thimble' });
    let burned = 0;
    for (let i = 0; i < 120 * 60 && f.phase === 'air'; i++) {
      const before = f.fuel;
      f.step(1 / 120, { pitch: 0, boost: true });
      burned += Math.max(0, before - f.fuel);
      for (let k = 0; k < 400 && f.phase === 'air'; k++) f.step(1 / 120, idle);
    }
    // One tank plus at most two refills.
    expect(burned).toBeLessThanOrEqual(f.maxFuel * 3 + 0.05);
  });
});

describe('ponds', () => {
  it('fill dips continuously and report their surface', () => {
    const w = new World(1234, 1);
    const ponds = w.pondsIn(0, 8000);
    expect(ponds.length).toBeGreaterThan(0);
    for (const p of ponds) {
      const mid = (p.x0 + p.x1) / 2;
      expect(w.groundY(mid)).toBeCloseTo(p.level, 6);
      expect(w.surfaceAt(mid)).toBe(p.kind);
      expect(w.rawGround(mid)).toBeLessThan(p.level);
      // Banks meet the water line without a step.
      expect(Math.abs(w.groundY(p.x0 - 0.01) - w.groundY(p.x0 + 0.01))).toBeLessThan(0.1);
      expect(Math.abs(w.groundY(p.x1 - 0.01) - w.groundY(p.x1 + 0.01))).toBeLessThan(0.1);
    }
  });
});
