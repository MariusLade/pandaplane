import { describe, expect, it } from 'vitest';
import { computeEarnings, EMPTY_RECORDS, updateRecords } from '../src/game/economy';
import type { FlightResult } from '../src/game/flight';

const result: FlightResult = {
  distance: 200,
  maxAltitude: 60,
  maxSpeed: 25,
  airtime: 6,
  coinMoney: 12,
  coinCount: 3,
  reachedGoal: false,
};

describe('economy', () => {
  it('pays for every stat and adds a record bonus', () => {
    const e = computeEarnings(result, EMPTY_RECORDS);
    expect(e.total).toBe(e.lines.reduce((s, l) => s + l.amount, 0));
    expect(e.lines.some((l) => l.label === 'New record!')).toBe(true);
    expect(e.newRecords).toEqual(['distance', 'altitude', 'speed', 'airtime']);
  });

  it('gives no record bonus when the record stands', () => {
    const best = updateRecords(EMPTY_RECORDS, { ...result, distance: 500 });
    const e = computeEarnings(result, best);
    expect(e.lines.some((l) => l.label === 'New record!')).toBe(false);
    expect(e.newRecords).not.toContain('distance');
  });
});
