import { describe, expect, it } from 'vitest';
import { Flight } from '../src/game/flight';
import {
  SENSORS,
  START_EQUIPPED,
  equipSensor,
  loadoutFor,
  sensorConflicts,
  sensorFeatures,
  totalMass,
} from '../src/game/upgrades';
import { World } from '../src/game/world';

describe('sensors', () => {
  it('each sensor conflicts exactly with those sharing a slot', () => {
    const wrist = SENSORS.find((s) => s.id === 'wrist')!;
    const clashes = sensorConflicts(wrist).map((s) => s.id).sort();
    expect(clashes).toEqual(['attitude', 'baro', 'level', 'pitot', 'radar', 'speedo']);
    const fuel = SENSORS.find((s) => s.id === 'fuelgauge')!;
    expect(sensorConflicts(fuel)).toEqual([]);
  });

  it('equipping swaps out conflicting sensors and keeps the rest', () => {
    let list: string[] = [];
    list = equipSensor(list, 'speedo').sensors;
    list = equipSensor(list, 'baro').sensors;
    list = equipSensor(list, 'horn').sensors;
    expect(list.sort()).toEqual(['baro', 'horn', 'speedo']);
    const r = equipSensor(list, 'wrist');
    expect(r.sensors.sort()).toEqual(['horn', 'wrist']);
    expect(r.removed.map((s) => s.id).sort()).toEqual(['baro', 'speedo']);
    const r2 = equipSensor(r.sensors, 'aoa');
    expect(r2.sensors.sort()).toEqual(['aoa', 'wrist']);
  });

  it('never leaves two sensors in the same slot', () => {
    for (const a of SENSORS)
      for (const b of SENSORS) {
        const list = equipSensor(equipSensor([], a.id).sensors, b.id).sensors;
        const slots = list.flatMap((id) => SENSORS.find((s) => s.id === id)!.slots);
        expect(new Set(slots).size).toBe(slots.length);
      }
  });

  it('sensors add weight and features', () => {
    const bare = loadoutFor(START_EQUIPPED);
    const kitted = loadoutFor(START_EQUIPPED, ['radar', 'pitot']);
    expect(totalMass(kitted)).toBeCloseTo(totalMass(bare) + 2.5, 6);
    expect([...sensorFeatures(kitted)].sort()).toEqual(['agl', 'climb', 'proximity', 'speed']);
    expect(sensorFeatures(bare).size).toBe(0);
  });
});

describe('pitch control', () => {
  it('holds its pitch in the air without input', () => {
    const f = new Flight(new World(5, 5), loadoutFor({ ...START_EQUIPPED, glider: 'hang', ramp: 'tall' }));
    f.start();
    while (f.phase === 'ramp') f.step(1 / 120, { pitch: 0, boost: false });
    const launch = f.pitch;
    for (let i = 0; i < 120 && !f.onGround; i++) f.step(1 / 120, { pitch: 0, boost: false });
    expect(f.pitch).toBeCloseTo(launch, 10);
  });
});
