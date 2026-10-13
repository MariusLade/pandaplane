/**
 * Upgrade catalogue. Every category has a list of tiers; tier 0 is what the panda
 * starts with. All gameplay numbers that depend on gear live here so balancing is
 * done in one place.
 */

export type Category = 'ramp' | 'sled' | 'glider' | 'rocket' | 'fuel';

export const CATEGORIES: Category[] = ['ramp', 'sled', 'glider', 'rocket', 'fuel'];

export interface Tier {
  name: string;
  cost: number;
  blurb: string;
}

export interface RampTier extends Tier {
  /** Vertical drop of the ramp in metres. */
  height: number;
  /** Angle at the lip of the ramp, in degrees. */
  launchDeg: number;
}

export interface SledTier extends Tier {
  /** Friction coefficient on the ramp and on landing. */
  friction: number;
  /** Multiplier on body drag in the air. */
  drag: number;
  color: string;
}

export interface GliderTier extends Tier {
  /** Lift coefficient scale (per metre, multiplies CL * v^2). 0 = no wings. */
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
  span: number;
  color: string;
}

export interface RocketTier extends Tier {
  /** Thrust acceleration in m/s^2. 0 = no rocket. */
  thrust: number;
  color: string;
}

export interface FuelTier extends Tier {
  /** Seconds of burn time. */
  seconds: number;
}

export const RAMPS: RampTier[] = [
  { name: 'Snow Bump', cost: 0, height: 8, launchDeg: 18, blurb: 'A lump of snow with ambition.' },
  { name: 'Wooden Ramp', cost: 100, height: 14, launchDeg: 20, blurb: 'Nailed together by a very determined panda.' },
  { name: 'Tall Ramp', cost: 320, height: 22, launchDeg: 22, blurb: 'Taller. Scarier. Better.' },
  { name: 'Ski Jump', cost: 900, height: 32, launchDeg: 24, blurb: 'Olympic-grade wobbliness.' },
  { name: 'Mega Ramp', cost: 2200, height: 46, launchDeg: 26, blurb: 'You can see your house from here.' },
  { name: 'Mountain Ramp', cost: 5200, height: 64, launchDeg: 28, blurb: 'Basically a cliff with paperwork.' },
];

export const SLEDS: SledTier[] = [
  { name: 'Cardboard Box', cost: 0, friction: 0.22, drag: 1.0, color: '#b88a55', blurb: 'Soggy but loyal.' },
  { name: 'Plastic Sled', cost: 80, friction: 0.15, drag: 0.92, color: '#e2493b', blurb: 'Slippery and red, so faster.' },
  { name: 'Toboggan', cost: 260, friction: 0.1, drag: 0.85, color: '#9b5a2e', blurb: 'Polished bamboo slats.' },
  { name: 'Racing Sled', cost: 750, friction: 0.065, drag: 0.76, color: '#2f7de1', blurb: 'Waxed runners, racing stripe.' },
  { name: 'Bobsled', cost: 1900, friction: 0.04, drag: 0.66, color: '#f2b705', blurb: 'Aerodynamic panda pod.' },
  { name: 'Hover Sled', cost: 4600, friction: 0.015, drag: 0.56, color: '#20c5b5', blurb: 'Nobody knows how it works.' },
];

export const GLIDERS: GliderTier[] = [
  { name: 'Flappy Arms', cost: 0, lift: 0, drag: 0, induced: 0.07, tuck: 1, stallDeg: 14, stability: 0.6, span: 0, color: '#000', blurb: 'Flapping harder does not help.' },
  { name: 'Leaf Kite', cost: 150, lift: 0.0301, drag: 0.0037, induced: 0.222, tuck: 0.85, stallDeg: 14, stability: 1.4, span: 2.2, color: '#6dbb4b', blurb: 'A large leaf on a stick.' },
  { name: 'Paper Wings', cost: 420, lift: 0.0222, drag: 0.00135, induced: 0.179, tuck: 0.6, stallDeg: 15, stability: 1.7, span: 2.8, color: '#f4efe1', blurb: 'Folded with great care.' },
  { name: 'Hang Glider', cost: 1100, lift: 0.0169, drag: 0.00039, induced: 0.143, tuck: 0.4, stallDeg: 16, stability: 2.0, span: 3.6, color: '#ff7a3d', blurb: 'An actual flying machine!' },
  { name: 'Carbon Glider', cost: 2700, lift: 0.0131, drag: 0.00017, induced: 0.119, tuck: 0.2, stallDeg: 17, stability: 2.3, span: 4.2, color: '#3a3f4b', blurb: 'Light, stiff and expensive.' },
  { name: 'Albatross Wings', cost: 6200, lift: 0.0104, drag: 5e-05, induced: 0.111, tuck: 0.12, stallDeg: 18, stability: 2.6, span: 5.0, color: '#ffffff', blurb: 'Borrowed from a very large bird.' },
];

export const ROCKETS: RocketTier[] = [
  { name: 'None', cost: 0, thrust: 0, color: '#000', blurb: 'No rocket. Just vibes.' },
  { name: 'Firework', cost: 220, thrust: 8, color: '#e2493b', blurb: 'Points mostly the right way.' },
  { name: 'Soda Rocket', cost: 650, thrust: 11, color: '#2fb35a', blurb: 'Fizzy propulsion.' },
  { name: 'Model Rocket', cost: 1600, thrust: 14, color: '#f2f2f2', blurb: 'Comes with tiny fins.' },
  { name: 'Turbo Rocket', cost: 3600, thrust: 17, color: '#2f7de1', blurb: 'Loud enough to wake hibernators.' },
  { name: 'Space Rocket', cost: 8200, thrust: 20, color: '#f2b705', blurb: 'Rated for orbit, almost.' },
];

export const FUELS: FuelTier[] = [
  { name: 'Thimble', cost: 0, seconds: 1.5, blurb: 'A thimble of rocket juice.' },
  { name: 'Water Bottle', cost: 120, seconds: 2.5, blurb: 'Please do not drink.' },
  { name: 'Jerry Can', cost: 380, seconds: 4, blurb: 'Sloshes reassuringly.' },
  { name: 'Barrel', cost: 950, seconds: 6, blurb: 'Heavy, but worth it.' },
  { name: 'Tanker', cost: 2300, seconds: 9, blurb: 'Where does the panda even keep this?' },
  { name: 'Reactor', cost: 5400, seconds: 13, blurb: 'Bamboo-powered fusion.' },
];

export const CATALOG: Record<Category, Tier[]> = {
  ramp: RAMPS,
  sled: SLEDS,
  glider: GLIDERS,
  rocket: ROCKETS,
  fuel: FUELS,
};

export const CATEGORY_LABEL: Record<Category, string> = {
  ramp: 'Ramp',
  sled: 'Sled',
  glider: 'Glider',
  rocket: 'Rocket',
  fuel: 'Fuel',
};

export type Levels = Record<Category, number>;

export const START_LEVELS: Levels = { ramp: 0, sled: 0, glider: 0, rocket: 0, fuel: 0 };

export interface Loadout {
  ramp: RampTier;
  sled: SledTier;
  glider: GliderTier;
  rocket: RocketTier;
  fuel: FuelTier;
}

export function loadoutFor(levels: Levels): Loadout {
  const pick = <T>(list: T[], i: number): T => list[Math.max(0, Math.min(list.length - 1, i | 0))];
  return {
    ramp: pick(RAMPS, levels.ramp),
    sled: pick(SLEDS, levels.sled),
    glider: pick(GLIDERS, levels.glider),
    rocket: pick(ROCKETS, levels.rocket),
    fuel: pick(FUELS, levels.fuel),
  };
}

export function nextTier(category: Category, levels: Levels): Tier | null {
  return CATALOG[category][levels[category] + 1] ?? null;
}
