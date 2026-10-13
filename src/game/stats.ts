import { GRAVITY, PANDA_MASS } from './constants';
import { Flight } from './flight';
import {
  CATALOG,
  burnTime,
  totalMass,
  type FuelItem,
  type GliderItem,
  type Item,
  type Loadout,
  type RampItem,
  type RocketItem,
  type SledItem,
  type WeaponItem,
  type ShopCategory,
} from './upgrades';
import { World } from './world';

/**
 * Shop stats: how each item is described to the player. Values are plain
 * numbers; `better` says which direction is an improvement ('none' marks a
 * trade-off such as weight or launch angle).
 */
export interface StatDef {
  key: string;
  label: string;
  hint: string;
  better: 'higher' | 'lower' | 'none';
  value(item: Item, gear: Loadout): number;
  format(v: number): string;
}

const dummyWorld = new World(1, 1);
const launchCache = new Map<string, number>();

/** Simulated speed at the ramp lip for a ramp + sled pair, in m/s. */
export function launchSpeed(ramp: RampItem, sled: SledItem, gear: Loadout): number {
  const key = `${ramp.id}|${sled.id}|${totalMass({ ...gear, ramp, sled })}`;
  const hit = launchCache.get(key);
  if (hit !== undefined) return hit;
  const f = new Flight(dummyWorld, { ...gear, ramp, sled, rocket: { ...gear.rocket, thrust: 0 } });
  f.start();
  for (let i = 0; i < 120 * 30 && f.phase === 'ramp'; i++) f.step(1 / 120, { pitch: 0, boost: false });
  const v = Math.hypot(f.vx, f.vy);
  launchCache.set(key, v);
  return v;
}

const kmh = (v: number) => `${Math.round(v * 3.6)} km/h`;
const kg = (v: number) => `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)} kg`;

const weight: StatDef = {
  key: 'weight',
  label: 'Weight',
  hint: 'Heavier keeps its speed, but sinks and accelerates slower.',
  better: 'none',
  value: (i) => i.weight,
  format: kg,
};

export const STATS: Record<ShopCategory, StatDef[]> = {
  ramp: [
    {
      key: 'drop',
      label: 'Drop',
      hint: 'How far you slide down before the kicker.',
      better: 'higher',
      value: (i) => (i as RampItem).height,
      format: (v) => `${Math.round(v)} m`,
    },
    {
      key: 'angle',
      label: 'Launch angle',
      hint: 'Low = flat and fast. High = big air.',
      better: 'none',
      value: (i) => (i as RampItem).launchDeg,
      format: (v) => `${Math.round(v)}°`,
    },
    {
      key: 'speed',
      label: 'Launch speed',
      hint: 'With your current sled.',
      better: 'higher',
      value: (i, g) => launchSpeed(i as RampItem, g.sled, g),
      format: kmh,
    },
  ],
  sled: [
    {
      key: 'speed',
      label: 'Launch speed',
      hint: 'Off your current ramp. Less friction = faster.',
      better: 'higher',
      value: (i, g) => launchSpeed(g.ramp, i as SledItem, { ...g, sled: i as SledItem }),
      format: kmh,
    },
    {
      key: 'aero',
      label: 'Aerodynamics',
      hint: 'Less air drag in flight.',
      better: 'higher',
      value: (i) => 1 / (i as SledItem).drag,
      format: (v) => `${Math.round(v * 100)}%`,
    },
    weight,
  ],
  glider: [
    {
      key: 'lift',
      label: 'Updraft',
      hint: 'Lower stall speed: floats at slower speeds.',
      better: 'higher',
      value: (i) => {
        const g = i as GliderItem;
        return g.lift > 0 ? 100 / g.design.minSpeed : 0;
      },
      format: (v) => (v > 0 ? `floats from ${Math.round((100 / v) * 3.6)} km/h` : 'none'),
    },
    {
      key: 'glide',
      label: 'Glide ratio',
      hint: 'Metres forward per metre of height lost.',
      better: 'higher',
      value: (i) => (i as GliderItem).design.glideRatio,
      format: (v) => (v > 0 ? `${v.toFixed(1)} : 1` : '—'),
    },
    {
      key: 'control',
      label: 'Control',
      hint: 'How quickly you can tilt.',
      better: 'higher',
      value: (i) => (i as GliderItem).control,
      format: (v) => `${Math.round(v * 100)}%`,
    },
    weight,
  ],
  rocket: [
    {
      key: 'thrust',
      label: 'Thrust',
      hint: 'Push while boosting.',
      better: 'higher',
      value: (i) => (i as RocketItem).thrust,
      format: (v) => (v > 0 ? `${v.toFixed(0)} m/s²` : '—'),
    },
    {
      key: 'burn',
      label: 'Burn time',
      hint: 'With your current fuel tank.',
      better: 'higher',
      value: (i, g) => burnTime({ ...g, rocket: i as RocketItem }),
      format: (v) => `${v.toFixed(1)} s`,
    },
    weight,
  ],
  fuel: [
    {
      key: 'capacity',
      label: 'Capacity',
      hint: 'Seconds of boost at a normal burn rate.',
      better: 'higher',
      value: (i) => (i as FuelItem).seconds,
      format: (v) => `${v.toFixed(1)} s`,
    },
    {
      key: 'burn',
      label: 'Burn time',
      hint: 'With your current rocket.',
      better: 'higher',
      value: (i, g) => burnTime({ ...g, fuel: i as FuelItem }),
      format: (v) => `${v.toFixed(1)} s`,
    },
    weight,
  ],
  sensor: [weight],
  weapon: [
    {
      key: 'damage',
      label: 'Damage',
      hint: 'Crows have 1 HP, fire bats 2, bandit balloons 4.',
      better: 'higher',
      value: (i) => (i as WeaponItem).damage,
      format: (v) => (v > 0 ? `${v}` : '—'),
    },
    {
      key: 'rate',
      label: 'Fire rate',
      hint: 'Shots per second while FIRE is held.',
      better: 'higher',
      value: (i) => (i as WeaponItem).rate,
      format: (v) => (v > 0 ? `${v}/s` : '—'),
    },
    {
      key: 'ammo',
      label: 'Ammo',
      hint: 'Shots per flight.',
      better: 'higher',
      value: (i) => (i as WeaponItem).ammo,
      format: (v) => (v > 0 ? `${v}` : '—'),
    },
    weight,
  ],
  gadget: [weight],
};

/** Largest value of a stat across the category, for scaling bars. */
export function statMax(category: ShopCategory, stat: StatDef, gear: Loadout): number {
  let max = 0;
  for (const item of CATALOG[category] as Item[]) max = Math.max(max, stat.value(item, gear));
  return max || 1;
}

export interface BuildSummary {
  mass: number;
  launch: number;
  glide: number;
  boost: number;
  thrustToWeight: number;
}

export function buildSummary(gear: Loadout): BuildSummary {
  const mass = totalMass(gear);
  return {
    mass,
    launch: launchSpeed(gear.ramp, gear.sled, gear),
    glide: gear.glider.design.glideRatio,
    boost: burnTime(gear),
    thrustToWeight: gear.rocket.thrust > 0 ? (gear.rocket.thrust * PANDA_MASS) / mass / GRAVITY : 0,
  };
}
