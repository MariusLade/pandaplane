/**
 * Equipment catalogue. Every category is a shop of items sorted from cheapest to
 * most expensive. Items are not strictly better than one another: each trades
 * off things like lift, control, efficiency and weight, so players pick a build.
 *
 * All gameplay numbers that depend on gear live here so balancing happens in
 * one place.
 */
import { BODY_DRAG, PANDA_MASS } from './constants';

export type Category = 'ramp' | 'sled' | 'glider' | 'rocket' | 'fuel';

export const CATEGORIES: Category[] = ['ramp', 'sled', 'glider', 'rocket', 'fuel'];

export interface ItemBase {
  id: string;
  name: string;
  cost: number;
  blurb: string;
  /** Carried weight in kg (the panda itself weighs PANDA_MASS). */
  weight: number;
}

export interface RampItem extends ItemBase {
  /** Vertical drop from the start of the ramp down to the kicker, in metres. */
  height: number;
  /** Angle at the lip of the kicker, in degrees. */
  launchDeg: number;
}

export type SledStyle = 'box' | 'lid' | 'plastic' | 'toboggan' | 'racing' | 'iron' | 'bobsled' | 'hover';

export interface SledItem extends ItemBase {
  /** Friction coefficient on the ramp; also softens landings. */
  friction: number;
  /** Multiplier on body drag in the air. */
  drag: number;
  color: string;
  style: SledStyle;
}

export type GliderStyle = 'none' | 'leaf' | 'parasol' | 'paper' | 'stunt' | 'hang' | 'bat' | 'carbon' | 'albatross';

export interface GliderItem extends ItemBase {
  /** Lift coefficient scale (multiplies CL * v^2). 0 = no wings. */
  lift: number;
  /** Parasitic drag added by the wing. */
  drag: number;
  /** Induced drag factor (drag per CL^2); long thin wings have less. */
  induced: number;
  /** Multiplier on body drag: a harness tucks the panda in. */
  tuck: number;
  /** Stall angle of attack in degrees. */
  stallDeg: number;
  /** How strongly the nose turns into the airflow (1/s). */
  stability: number;
  /** Multiplier on how fast the player can pitch. */
  control: number;
  /** Visual size in metres. */
  span: number;
  color: string;
  style: GliderStyle;
  /** Design numbers, kept for the shop's stat bars. */
  design: { minSpeed: number; glideRatio: number };
}

export type RocketStyle = 'none' | 'firework' | 'soda' | 'model' | 'ion' | 'twin' | 'turbo' | 'space';

export interface RocketItem extends ItemBase {
  /** Thrust as acceleration for a reference-weight panda, m/s^2. 0 = no rocket. */
  thrust: number;
  /** Fuel burn rate multiplier (1 = one tank-second per second). */
  burn: number;
  color: string;
  style: RocketStyle;
}

export interface FuelItem extends ItemBase {
  /** Seconds of burn at a burn rate of 1. */
  seconds: number;
}

export type Item = RampItem | SledItem | GliderItem | RocketItem | FuelItem;

export const RAMPS: RampItem[] = [
  { id: 'bump', name: 'Snow Bump', cost: 0, weight: 0, height: 20, launchDeg: 20, blurb: 'A lump of snow with ambition.' },
  { id: 'plank', name: 'Plank Kicker', cost: 120, weight: 0, height: 22, launchDeg: 32, blurb: 'Short, steep and pointed at the sky.' },
  { id: 'wooden', name: 'Wooden Ramp', cost: 260, weight: 0, height: 30, launchDeg: 18, blurb: 'Nailed together by a very determined panda.' },
  { id: 'skijump', name: 'Ski Jump', cost: 600, weight: 0, height: 40, launchDeg: 11, blurb: 'Flat lip, big speed. Gliders love it.' },
  { id: 'tall', name: 'Tall Ramp', cost: 950, weight: 0, height: 48, launchDeg: 24, blurb: 'Taller. Scarier. Better.' },
  { id: 'launchpad', name: 'Launch Pad', cost: 1900, weight: 0, height: 56, launchDeg: 40, blurb: 'Fires you upwards. Great with rockets.' },
  { id: 'mega', name: 'Mega Ramp', cost: 2600, weight: 0, height: 72, launchDeg: 22, blurb: 'You can see your house from here.' },
  { id: 'mountain', name: 'Mountain Ramp', cost: 5200, weight: 0, height: 96, launchDeg: 25, blurb: 'Starts near the summit. Bring a scarf.' },
];

export const SLEDS: SledItem[] = [
  { id: 'box', name: 'Cardboard Box', cost: 0, weight: 2, friction: 0.22, drag: 1.0, color: '#b88a55', style: 'box', blurb: 'Soggy but loyal.' },
  { id: 'lid', name: 'Trash Can Lid', cost: 60, weight: 1, friction: 0.17, drag: 1.12, color: '#9aa3ad', style: 'lid', blurb: 'Feather-light. Spins like a frisbee.' },
  { id: 'plastic', name: 'Plastic Sled', cost: 140, weight: 3, friction: 0.14, drag: 0.92, color: '#e2493b', style: 'plastic', blurb: 'Slippery and red, so faster.' },
  { id: 'toboggan', name: 'Toboggan', cost: 320, weight: 10, friction: 0.1, drag: 0.85, color: '#9b5a2e', style: 'toboggan', blurb: 'Polished bamboo slats.' },
  { id: 'racing', name: 'Racing Sled', cost: 750, weight: 6, friction: 0.065, drag: 0.74, color: '#2f7de1', style: 'racing', blurb: 'Waxed runners and a racing stripe.' },
  { id: 'iron', name: 'Iron Sled', cost: 1300, weight: 45, friction: 0.05, drag: 0.8, color: '#4b4f57', style: 'iron', blurb: 'Heavy as a fridge. Nothing slows it down.' },
  { id: 'bobsled', name: 'Bobsled', cost: 2000, weight: 22, friction: 0.035, drag: 0.62, color: '#f2b705', style: 'bobsled', blurb: 'Aerodynamic panda pod.' },
  { id: 'hover', name: 'Hover Sled', cost: 4600, weight: 8, friction: 0.012, drag: 0.55, color: '#20c5b5', style: 'hover', blurb: 'Nobody knows how it works.' },
];

/** Reference body-drag multiplier used when deriving glider coefficients. */
const REF_SLED_DRAG = 0.8;

interface GliderDesign {
  id: string;
  name: string;
  cost: number;
  weight: number;
  blurb: string;
  /** Slowest speed (m/s) the wing can hold level flight at. */
  minSpeed: number;
  /** Best lift-to-drag ratio (how far it glides per metre of height). */
  glideRatio: number;
  /** Lift coefficient at the best glide; lower = it glides faster. */
  cruiseCl: number;
  stallDeg: number;
  control: number;
  stability: number;
  tuck: number;
  span: number;
  color: string;
  style: GliderStyle;
}

/** Turns intuitive design numbers into the aerodynamic coefficients the sim uses. */
function glider(d: GliderDesign): GliderItem {
  const stall = (d.stallDeg * Math.PI) / 180;
  const clMax = 5.2 * stall;
  const lift = 9.81 / (d.minSpeed * d.minSpeed * clMax);
  const induced = 1 / (2 * d.glideRatio * d.cruiseCl);
  const parasitic = (lift * d.cruiseCl) / (2 * d.glideRatio);
  const drag = Math.max(0.00003, parasitic - BODY_DRAG * REF_SLED_DRAG * d.tuck);
  return {
    id: d.id,
    name: d.name,
    cost: d.cost,
    weight: d.weight,
    blurb: d.blurb,
    lift,
    drag,
    induced,
    tuck: d.tuck,
    stallDeg: d.stallDeg,
    stability: d.stability,
    control: d.control,
    span: d.span,
    color: d.color,
    style: d.style,
    design: { minSpeed: d.minSpeed, glideRatio: d.glideRatio },
  };
}

const NO_GLIDER: GliderItem = {
  id: 'none',
  name: 'Flappy Arms',
  cost: 0,
  weight: 0,
  blurb: 'Flapping harder does not help.',
  lift: 0,
  drag: 0,
  induced: 0.07,
  tuck: 1,
  stallDeg: 14,
  stability: 0.6,
  control: 1,
  span: 0,
  color: '#000',
  style: 'none',
  design: { minSpeed: 0, glideRatio: 0 },
};

export const GLIDERS: GliderItem[] = [
  NO_GLIDER,
  glider({ id: 'leaf', name: 'Leaf Kite', cost: 150, weight: 1, minSpeed: 15, glideRatio: 2.5, cruiseCl: 0.9, stallDeg: 14, control: 1.1, stability: 1.4, tuck: 0.85, span: 2.2, color: '#6dbb4b', style: 'leaf', blurb: 'A large leaf on a stick.' }),
  glider({ id: 'parasol', name: 'Parasol', cost: 320, weight: 3, minSpeed: 10, glideRatio: 2.9, cruiseCl: 1.1, stallDeg: 22, control: 0.65, stability: 2.2, tuck: 0.9, span: 2.6, color: '#ff6fa8', style: 'parasol', blurb: 'Floats like a feather. Goes nowhere fast.' }),
  glider({ id: 'paper', name: 'Paper Wings', cost: 450, weight: 2, minSpeed: 18, glideRatio: 3.5, cruiseCl: 0.8, stallDeg: 15, control: 1.2, stability: 1.7, tuck: 0.6, span: 2.8, color: '#f4efe1', style: 'paper', blurb: 'Folded with great care.' }),
  glider({ id: 'stunt', name: 'Stunt Wings', cost: 850, weight: 4, minSpeed: 23, glideRatio: 3.8, cruiseCl: 0.55, stallDeg: 19, control: 1.9, stability: 1.5, tuck: 0.5, span: 2.6, color: '#e2493b', style: 'stunt', blurb: 'Twitchy and fast. Loop-de-loops guaranteed.' }),
  glider({ id: 'hang', name: 'Hang Glider', cost: 1150, weight: 14, minSpeed: 18, glideRatio: 5, cruiseCl: 0.75, stallDeg: 16, control: 0.95, stability: 2.0, tuck: 0.4, span: 3.6, color: '#ff7a3d', style: 'hang', blurb: 'An actual flying machine! A bit heavy.' }),
  glider({ id: 'bat', name: 'Bat Wings', cost: 1700, weight: 6, minSpeed: 20, glideRatio: 5.5, cruiseCl: 0.65, stallDeg: 17, control: 1.5, stability: 1.9, tuck: 0.35, span: 3.4, color: '#5b3f8c', style: 'bat', blurb: 'Spooky, nimble and surprisingly efficient.' }),
  glider({ id: 'carbon', name: 'Carbon Glider', cost: 2900, weight: 8, minSpeed: 22, glideRatio: 7, cruiseCl: 0.6, stallDeg: 17, control: 1.2, stability: 2.3, tuck: 0.2, span: 4.2, color: '#3a3f4b', style: 'carbon', blurb: 'Light, stiff and expensive.' }),
  glider({ id: 'albatross', name: 'Albatross Wings', cost: 6200, weight: 18, minSpeed: 21, glideRatio: 9.5, cruiseCl: 0.5, stallDeg: 18, control: 0.75, stability: 2.6, tuck: 0.12, span: 5.0, color: '#ffffff', style: 'albatross', blurb: 'Glides forever. Turns like a cruise ship.' }),
];

export const ROCKETS: RocketItem[] = [
  { id: 'none', name: 'No Rocket', cost: 0, weight: 0, thrust: 0, burn: 1, color: '#000', style: 'none', blurb: 'No rocket. Just vibes.' },
  { id: 'firework', name: 'Firework', cost: 220, weight: 2, thrust: 8, burn: 1, color: '#e2493b', style: 'firework', blurb: 'Points mostly the right way.' },
  { id: 'soda', name: 'Soda Bottle', cost: 420, weight: 3, thrust: 6, burn: 0.6, color: '#2fb35a', style: 'soda', blurb: 'Gentle fizz that lasts and lasts.' },
  { id: 'model', name: 'Model Rocket', cost: 1000, weight: 5, thrust: 12, burn: 1, color: '#f2f2f2', style: 'model', blurb: 'Comes with tiny fins.' },
  { id: 'twin', name: 'Twin Boosters', cost: 2600, weight: 12, thrust: 21, burn: 1.3, color: '#ff9f1c', style: 'twin', blurb: 'Double the kick, double the thirst.' },
  { id: 'ion', name: 'Ion Drive', cost: 3000, weight: 8, thrust: 7, burn: 0.45, color: '#4fc3ff', style: 'ion', blurb: 'Weak push, sips fuel. Very sci-fi.' },
  { id: 'turbo', name: 'Turbo Rocket', cost: 3600, weight: 10, thrust: 17, burn: 1, color: '#2f7de1', style: 'turbo', blurb: 'Loud enough to wake hibernators.' },
  { id: 'space', name: 'Space Rocket', cost: 8200, weight: 24, thrust: 24, burn: 0.9, color: '#f2b705', style: 'space', blurb: 'Rated for orbit, almost.' },
];

export const FUELS: FuelItem[] = [
  { id: 'thimble', name: 'Thimble', cost: 0, weight: 0.2, seconds: 1.5, blurb: 'A thimble of rocket juice.' },
  { id: 'bottle', name: 'Water Bottle', cost: 120, weight: 1, seconds: 2.5, blurb: 'Please do not drink.' },
  { id: 'jerry', name: 'Jerry Can', cost: 380, weight: 5, seconds: 4, blurb: 'Sloshes reassuringly.' },
  { id: 'flask', name: 'Carbon Flask', cost: 900, weight: 1.5, seconds: 4.5, blurb: 'Light as air, holds a decent gulp.' },
  { id: 'barrel', name: 'Barrel', cost: 1100, weight: 14, seconds: 6.5, blurb: 'Heavy, but worth it.' },
  { id: 'tanker', name: 'Tanker', cost: 2300, weight: 30, seconds: 9.5, blurb: 'Where does the panda even keep this?' },
  { id: 'reactor', name: 'Reactor', cost: 5400, weight: 8, seconds: 12, blurb: 'Bamboo-powered fusion.' },
];

export interface CatalogMap {
  ramp: RampItem[];
  sled: SledItem[];
  glider: GliderItem[];
  rocket: RocketItem[];
  fuel: FuelItem[];
}

export const CATALOG: CatalogMap = { ramp: RAMPS, sled: SLEDS, glider: GLIDERS, rocket: ROCKETS, fuel: FUELS };

export const CATEGORY_LABEL: Record<Category, string> = {
  ramp: 'Ramps',
  sled: 'Sleds',
  glider: 'Gliders',
  rocket: 'Rockets',
  fuel: 'Fuel tanks',
};

export const CATEGORY_ICON: Record<Category, string> = {
  ramp: '⛷️',
  sled: '🛷',
  glider: '🪁',
  rocket: '🚀',
  fuel: '⛽',
};

/** Which item is equipped in each category, by id. */
export type Equipped = Record<Category, string>;
/** Ids of owned items per category. */
export type Owned = Record<Category, string[]>;

export const START_EQUIPPED: Equipped = { ramp: 'bump', sled: 'box', glider: 'none', rocket: 'none', fuel: 'thimble' };

export function startOwned(): Owned {
  return { ramp: ['bump'], sled: ['box'], glider: ['none'], rocket: ['none'], fuel: ['thimble'] };
}

export function findItem<C extends Category>(category: C, id: string): CatalogMap[C][number] | undefined {
  return (CATALOG[category] as Item[]).find((i) => i.id === id) as CatalogMap[C][number] | undefined;
}

export interface Loadout {
  ramp: RampItem;
  sled: SledItem;
  glider: GliderItem;
  rocket: RocketItem;
  fuel: FuelItem;
}

export function loadoutFor(equipped: Equipped): Loadout {
  return {
    ramp: findItem('ramp', equipped.ramp) ?? RAMPS[0],
    sled: findItem('sled', equipped.sled) ?? SLEDS[0],
    glider: findItem('glider', equipped.glider) ?? GLIDERS[0],
    rocket: findItem('rocket', equipped.rocket) ?? ROCKETS[0],
    fuel: findItem('fuel', equipped.fuel) ?? FUELS[0],
  };
}

/** Pick items by their index in each (cost-sorted) list. Handy for tests and demos. */
export function loadoutByIndex(idx: Record<Category, number>): Loadout {
  const at = <T>(list: T[], i: number) => list[Math.max(0, Math.min(list.length - 1, i))];
  return {
    ramp: at(RAMPS, idx.ramp),
    sled: at(SLEDS, idx.sled),
    glider: at(GLIDERS, idx.glider),
    rocket: at(ROCKETS, idx.rocket),
    fuel: at(FUELS, idx.fuel),
  };
}

/** Panda plus everything it carries. The ramp is not carried. */
export function totalMass(g: Loadout): number {
  const rocketParts = g.rocket.thrust > 0 ? g.rocket.weight + g.fuel.weight : 0;
  return PANDA_MASS + g.sled.weight + g.glider.weight + rocketParts;
}

/** Seconds of boost the loadout gets. */
export function burnTime(g: Loadout): number {
  return g.rocket.thrust > 0 ? g.fuel.seconds / g.rocket.burn : 0;
}
