/**
 * Equipment catalogue. Every category is a shop of items sorted from cheapest to
 * most expensive. Items are not strictly better than one another: each trades
 * off things like lift, control, efficiency and weight, so players pick a build.
 *
 * All gameplay numbers that depend on gear live here so balancing happens in
 * one place.
 */
import { BODY_DRAG, PANDA_MASS } from './constants';
import type { MapId } from './maps';

/** Gear slots that hold exactly one item each. */
export type Category = 'ramp' | 'sled' | 'glider' | 'rocket' | 'fuel' | 'weapon';

export const CATEGORIES: Category[] = ['ramp', 'sled', 'glider', 'rocket', 'fuel', 'weapon'];

/** How many gadgets can be worn at once. */
export const MAX_GADGETS = 2;

export interface ItemBase {
  id: string;
  name: string;
  cost: number;
  blurb: string;
  /** Carried weight in kg (the panda itself weighs PANDA_MASS). */
  weight: number;
  /** A special ability, shown as a badge in the shop. */
  perk?: string;
  /** Only sold once this map is unlocked. */
  unlock?: MapId;
}

export interface RampItem extends ItemBase {
  /** Vertical drop from the start of the ramp down to the kicker, in metres. */
  height: number;
  /** Angle at the lip of the kicker, in degrees. */
  launchDeg: number;
  /** Extra speed (m/s) a spring adds at the lip. */
  kick?: number;
  /** Multiplier on deck friction (icy decks are slippery). */
  ice?: number;
  style?: 'wood' | 'catapult' | 'ice' | 'spring';
}

export type SledStyle =
  | 'box'
  | 'lid'
  | 'plastic'
  | 'wok'
  | 'toboggan'
  | 'racing'
  | 'inflatable'
  | 'iron'
  | 'surfboard'
  | 'bobsled'
  | 'hover'
  | 'obsidian';

export interface SledItem extends ItemBase {
  /** Friction coefficient on the ramp; also softens landings. */
  friction: number;
  /** Multiplier on body drag in the air. */
  drag: number;
  /** Multiplier on friction when sliding along the ground after landing. */
  groundGlide?: number;
  /** Bounciness on landing (replaces the normal, rather dead, restitution). */
  bounce?: number;
  color: string;
  style: SledStyle;
}

export type GliderStyle =
  | 'none'
  | 'leaf'
  | 'propeller'
  | 'parasol'
  | 'paper'
  | 'stunt'
  | 'hang'
  | 'bat'
  | 'carpet'
  | 'carbon'
  | 'feathers'
  | 'albatross'
  | 'dragon'
  | 'phoenix';

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
  /** Multiplier on how fast the player can pitch. */
  control: number;
  /** Visual size in metres. */
  span: number;
  /** Flaps available: press BOOST (when the rocket is empty) for a wing beat. */
  flaps?: number;
  /** Rotor drag that only resists falling (a propeller hat). */
  rotor?: number;
  /** Keeps its lift past the stall angle instead of dropping out. */
  noStall?: boolean;
  /** Multiplier on how strongly thermals lift it. */
  thermal?: number;
  color: string;
  style: GliderStyle;
  /** Design numbers, kept for the shop's stat bars. */
  design: { minSpeed: number; glideRatio: number };
}

export type RocketStyle =
  | 'none'
  | 'firework'
  | 'soda'
  | 'cola'
  | 'model'
  | 'kettle'
  | 'twin'
  | 'ion'
  | 'turbo'
  | 'afterburner'
  | 'space'
  | 'magma';

export interface RocketItem extends ItemBase {
  /** Thrust as acceleration for a reference-weight panda, m/s^2. 0 = no rocket. */
  thrust: number;
  /** Fuel burn rate multiplier (1 = one tank-second per second). */
  burn: number;
  /** Boost seconds regained per second while not boosting. */
  regen?: number;
  /** Seconds of continuous burn to spool up: thrust ramps from 60% to 200%. */
  spool?: number;
  color: string;
  style: RocketStyle;
}

export type FuelStyle = 'tank' | 'solar' | 'nitro' | 'lava';

export interface FuelItem extends ItemBase {
  /** Seconds of burn at a burn rate of 1. */
  seconds: number;
  /** Boost seconds regained per second while not boosting. */
  regen?: number;
  /** Multiplier on rocket thrust. */
  thrustMul?: number;
  style?: FuelStyle;
}

/** What a sensor can display. The HUD shows a readout only if a sensor provides it. */
export type SensorFeature =
  | 'speed'
  | 'climb'
  | 'altitude'
  | 'agl'
  | 'proximity'
  | 'fuel'
  | 'pitch'
  | 'horizon'
  | 'stallHorn'
  | 'aoa';

/** Instrument slots: two sensors that share a slot cannot be equipped together. */
export type SensorSlot = 'speed' | 'altitude' | 'pitch' | 'stall' | 'fuel';

export type SensorStyle = 'dial' | 'level' | 'horn' | 'watch' | 'pitot' | 'radar' | 'ball' | 'vane' | 'gauge';

export interface SensorItem extends ItemBase {
  slots: SensorSlot[];
  features: SensorFeature[];
  color: string;
  style: SensorStyle;
}

export type WeaponStyle = 'none' | 'peas' | 'sling' | 'crackers' | 'bees' | 'snow' | 'laser';

export interface WeaponItem extends ItemBase {
  /** Damage per hit (crows have 1 HP, bats 2, bandits 4). */
  damage: number;
  /** Shots per second while FIRE is held. */
  rate: number;
  ammo: number;
  /** Muzzle speed, m/s, on top of the panda's own speed. */
  speed: number;
  /** Random aim wobble, radians. */
  spread: number;
  /** Shots arc under gravity. */
  gravity?: boolean;
  /** Shots steer towards the nearest enemy. */
  homing?: boolean;
  /** Explodes on hit, damaging everything within this radius (m). */
  blast?: number;
  /** Instant beam up to this range (m). */
  hitscan?: number;
  /** Enemies a shot can pass through. */
  pierce?: number;
  color: string;
  style: WeaponStyle;
}

export type GadgetStyle = 'magnet' | 'charm' | 'belt' | 'radar' | 'shield' | 'helmet' | 'suit';

export interface GadgetItem extends ItemBase {
  /** Pulls coins in from this far away (m). */
  magnet?: number;
  /** Multiplier on coin value. */
  coinMul?: number;
  /** Multiplier on weapon ammo. */
  ammoMul?: number;
  /** Hits absorbed per flight. */
  shield?: number;
  /** Ramming enemies destroys them without slowing you. */
  spikes?: boolean;
  /** Lava launches you instead of scorching you; thermals lift harder. */
  heatSuit?: boolean;
  /** Arrows on screen point at incoming enemies. */
  threatRadar?: boolean;
  color: string;
  style: GadgetStyle;
}

export type Item = RampItem | SledItem | GliderItem | RocketItem | FuelItem | SensorItem | WeaponItem | GadgetItem;

export const RAMPS: RampItem[] = [
  { id: 'bump', name: 'Snow Bump', cost: 0, weight: 0, height: 20, launchDeg: 20, blurb: 'A lump of snow with ambition.' },
  { id: 'plank', name: 'Plank Kicker', cost: 120, weight: 0, height: 22, launchDeg: 32, blurb: 'Short, steep and pointed at the sky.' },
  { id: 'wooden', name: 'Wooden Ramp', cost: 260, weight: 0, height: 30, launchDeg: 18, blurb: 'Nailed together by a very determined panda.' },
  { id: 'catapult', name: 'Bamboo Catapult', cost: 480, weight: 0, height: 14, launchDeg: 44, kick: 13, style: 'catapult', perk: 'Spring: +47 km/h at the lip', blurb: 'Tiny ramp, huge bamboo spring. BOING.' },
  { id: 'skijump', name: 'Ski Jump', cost: 600, weight: 0, height: 40, launchDeg: 11, blurb: 'Flat lip, big speed. Gliders love it.' },
  { id: 'tall', name: 'Tall Ramp', cost: 950, weight: 0, height: 48, launchDeg: 24, blurb: 'Taller. Scarier. Better.' },
  { id: 'icechute', name: 'Ice Chute', cost: 1400, weight: 0, height: 46, launchDeg: 16, ice: 0.15, style: 'ice', perk: 'Ice deck: almost no friction', blurb: 'Frozen solid. Your sled barely touches it.' },
  { id: 'launchpad', name: 'Launch Pad', cost: 1900, weight: 0, height: 56, launchDeg: 40, blurb: 'Fires you upwards. Great with rockets.' },
  { id: 'mega', name: 'Mega Ramp', cost: 2600, weight: 0, height: 72, launchDeg: 22, blurb: 'You can see your house from here.' },
  { id: 'springboard', name: 'Spring Board', cost: 3600, weight: 0, height: 62, launchDeg: 30, kick: 9, style: 'spring', perk: 'Spring: +32 km/h at the lip', blurb: 'A mega ramp with a trampoline at the end.' },
  { id: 'mountain', name: 'Mountain Ramp', cost: 5200, weight: 0, height: 96, launchDeg: 25, blurb: 'Starts near the summit. Bring a scarf.' },
  { id: 'volcano', name: 'Volcano Ramp', cost: 9000, weight: 0, height: 125, launchDeg: 24, unlock: 'canyon', perk: 'Starts right at the crater rim', blurb: 'Built from cooled lava. Mostly cooled.' },
];

export const SLEDS: SledItem[] = [
  { id: 'box', name: 'Cardboard Box', cost: 0, weight: 2, friction: 0.22, drag: 1.0, color: '#b88a55', style: 'box', blurb: 'Soggy but loyal.' },
  { id: 'lid', name: 'Trash Can Lid', cost: 60, weight: 1, friction: 0.17, drag: 1.12, color: '#9aa3ad', style: 'lid', blurb: 'Feather-light. Spins like a frisbee.' },
  { id: 'plastic', name: 'Plastic Sled', cost: 140, weight: 3, friction: 0.14, drag: 0.92, color: '#e2493b', style: 'plastic', blurb: 'Slippery and red, so faster.' },
  { id: 'wok', name: 'Frying Wok', cost: 220, weight: 4, friction: 0.16, drag: 1.0, groundGlide: 0.3, color: '#3b3f46', style: 'wok', perk: 'Skims the ground after landing', blurb: 'Skips across the snow like a pancake.' },
  { id: 'toboggan', name: 'Toboggan', cost: 320, weight: 10, friction: 0.1, drag: 0.85, color: '#9b5a2e', style: 'toboggan', blurb: 'Polished bamboo slats.' },
  { id: 'racing', name: 'Racing Sled', cost: 750, weight: 6, friction: 0.065, drag: 0.74, color: '#2f7de1', style: 'racing', blurb: 'Waxed runners and a racing stripe.' },
  { id: 'inflatable', name: 'Bouncy Castle', cost: 950, weight: 5, friction: 0.12, drag: 1.25, bounce: 0.72, color: '#ff6fa8', style: 'inflatable', perk: 'Bounces off the ground', blurb: 'Every crash is a trampoline.' },
  { id: 'iron', name: 'Iron Sled', cost: 1300, weight: 45, friction: 0.05, drag: 0.8, color: '#4b4f57', style: 'iron', blurb: 'Heavy as a fridge. Nothing slows it down.' },
  { id: 'surfboard', name: 'Snow Surfboard', cost: 1650, weight: 7, friction: 0.055, drag: 0.82, groundGlide: 0.2, color: '#20a4f3', style: 'surfboard', perk: 'Surfs the ground after landing', blurb: 'Catch a wave. Of snow.' },
  { id: 'bobsled', name: 'Bobsled', cost: 2000, weight: 22, friction: 0.035, drag: 0.62, color: '#f2b705', style: 'bobsled', blurb: 'Aerodynamic panda pod.' },
  { id: 'hover', name: 'Hover Sled', cost: 4600, weight: 8, friction: 0.012, drag: 0.55, color: '#20c5b5', style: 'hover', blurb: 'Nobody knows how it works.' },
  { id: 'obsidian', name: 'Obsidian Board', cost: 8000, weight: 10, friction: 0.008, drag: 0.5, groundGlide: 0.4, color: '#2a2233', style: 'obsidian', unlock: 'canyon', perk: 'Glassy: skims after landing', blurb: 'Polished volcanic glass. Unbelievably slick.' },
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
  tuck: number;
  span: number;
  color: string;
  style: GliderStyle;
  flaps?: number;
  rotor?: number;
  noStall?: boolean;
  thermal?: number;
  unlock?: MapId;
  perk?: string;
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
    control: d.control,
    span: d.span,
    color: d.color,
    style: d.style,
    design: { minSpeed: d.minSpeed, glideRatio: d.glideRatio },
    flaps: d.flaps,
    thermal: d.thermal,
    unlock: d.unlock,
    rotor: d.rotor,
    noStall: d.noStall,
    perk: d.perk,
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
  control: 1,
  span: 0,
  color: '#000',
  style: 'none',
  design: { minSpeed: 0, glideRatio: 0 },
};

export const GLIDERS: GliderItem[] = [
  NO_GLIDER,
  glider({ id: 'leaf', name: 'Leaf Kite', cost: 150, weight: 1, minSpeed: 15, glideRatio: 2.5, cruiseCl: 0.9, stallDeg: 14, control: 1.1, tuck: 0.85, span: 2.2, color: '#6dbb4b', style: 'leaf', blurb: 'A large leaf on a stick.' }),
  glider({ id: 'propeller', name: 'Propeller Beanie', cost: 250, weight: 1, minSpeed: 27, glideRatio: 2.2, cruiseCl: 0.9, stallDeg: 15, control: 1.1, tuck: 0.9, span: 1.4, rotor: 0.014, color: '#ffd23d', style: 'propeller', perk: 'Rotor: slows every fall', blurb: 'Barely a wing. Spins happily and lands you gently.' }),
  glider({ id: 'parasol', name: 'Parasol', cost: 320, weight: 3, minSpeed: 10, glideRatio: 3.2, cruiseCl: 1.1, stallDeg: 22, control: 0.65, tuck: 0.9, span: 2.6, color: '#ff6fa8', style: 'parasol', blurb: 'Floats like a feather. Goes nowhere fast.' }),
  glider({ id: 'paper', name: 'Paper Wings', cost: 450, weight: 2, minSpeed: 18, glideRatio: 3.5, cruiseCl: 0.8, stallDeg: 15, control: 1.2, tuck: 0.6, span: 2.8, color: '#f4efe1', style: 'paper', blurb: 'Folded with great care.' }),
  glider({ id: 'stunt', name: 'Stunt Wings', cost: 850, weight: 4, minSpeed: 23, glideRatio: 3.8, cruiseCl: 0.55, stallDeg: 19, control: 1.9, tuck: 0.5, span: 2.6, color: '#e2493b', style: 'stunt', blurb: 'Twitchy and fast. Loop-de-loops guaranteed.' }),
  glider({ id: 'hang', name: 'Hang Glider', cost: 1150, weight: 14, minSpeed: 18, glideRatio: 5, cruiseCl: 0.75, stallDeg: 16, control: 0.95, tuck: 0.4, span: 3.6, color: '#ff7a3d', style: 'hang', blurb: 'An actual flying machine! A bit heavy.' }),
  glider({ id: 'bat', name: 'Bat Wings', cost: 1700, weight: 6, minSpeed: 20, glideRatio: 5.5, cruiseCl: 0.65, stallDeg: 17, control: 1.5, tuck: 0.35, span: 3.4, color: '#5b3f8c', style: 'bat', blurb: 'Spooky, nimble and surprisingly efficient.' }),
  glider({ id: 'carpet', name: 'Flying Carpet', cost: 2200, weight: 5, minSpeed: 17, glideRatio: 5, cruiseCl: 0.7, stallDeg: 16, control: 1.3, tuck: 0.3, span: 3.2, noStall: true, color: '#c0392b', style: 'carpet', perk: 'Never stalls', blurb: 'A magic rug that simply refuses to fall out of the sky.' }),
  glider({ id: 'carbon', name: 'Carbon Glider', cost: 2900, weight: 8, minSpeed: 22, glideRatio: 7, cruiseCl: 0.6, stallDeg: 17, control: 1.2, tuck: 0.2, span: 4.2, color: '#3a3f4b', style: 'carbon', blurb: 'Light, stiff and expensive.' }),
  glider({ id: 'feathers', name: 'Feathered Wings', cost: 3800, weight: 7, minSpeed: 20, glideRatio: 6.5, cruiseCl: 0.6, stallDeg: 17, control: 1.35, tuck: 0.25, span: 3.8, flaps: 6, color: '#a0703c', style: 'feathers', perk: '6 flaps: press BOOST to flap', blurb: 'Real flapping! Once the rocket is empty, BOOST beats your wings.' }),
  glider({ id: 'albatross', name: 'Albatross Wings', cost: 6200, weight: 18, minSpeed: 21, glideRatio: 9.5, cruiseCl: 0.5, stallDeg: 18, control: 0.75, tuck: 0.12, span: 5.0, color: '#ffffff', style: 'albatross', blurb: 'Glides forever. Turns like a cruise ship.' }),
  glider({ id: 'dragon', name: 'Dragon Wings', cost: 9500, weight: 22, minSpeed: 20, glideRatio: 10.5, cruiseCl: 0.5, stallDeg: 19, control: 0.95, tuck: 0.12, span: 5.2, flaps: 3, color: '#2e9e6b', style: 'dragon', perk: '3 mighty flaps', blurb: 'Ancient, enormous and a little bit smug.' }),
  glider({ id: 'phoenix', name: 'Phoenix Wings', cost: 14000, weight: 16, minSpeed: 19, glideRatio: 12, cruiseCl: 0.5, stallDeg: 19, control: 1.15, tuck: 0.1, span: 5.4, flaps: 2, thermal: 2, unlock: 'canyon', color: '#ff7a3d', style: 'phoenix', perk: 'Double thermal lift · 2 flaps', blurb: 'Reborn from the volcano. Loves hot air.' }),
];

export const ROCKETS: RocketItem[] = [
  { id: 'none', name: 'No Rocket', cost: 0, weight: 0, thrust: 0, burn: 1, color: '#000', style: 'none', blurb: 'No rocket. Just vibes.' },
  { id: 'firework', name: 'Firework', cost: 220, weight: 2, thrust: 8, burn: 1, color: '#e2493b', style: 'firework', blurb: 'Points mostly the right way.' },
  { id: 'soda', name: 'Soda Bottle', cost: 420, weight: 3, thrust: 6, burn: 0.6, color: '#2fb35a', style: 'soda', blurb: 'Gentle fizz that lasts and lasts.' },
  { id: 'cola', name: 'Cola Geyser', cost: 700, weight: 3, thrust: 32, burn: 4, color: '#5a2d1a', style: 'cola', perk: 'All the fizz in one blast', blurb: 'Drop the mints in and HOLD ON.' },
  { id: 'model', name: 'Model Rocket', cost: 1000, weight: 5, thrust: 12, burn: 1, color: '#f2f2f2', style: 'model', blurb: 'Comes with tiny fins.' },
  { id: 'kettle', name: 'Steam Kettle', cost: 1500, weight: 6, thrust: 9, burn: 1, regen: 0.22, color: '#c9ced6', style: 'kettle', perk: 'Refills twice while coasting', blurb: 'Gentle steam power. Let it rest and it refills.' },
  { id: 'twin', name: 'Twin Boosters', cost: 2600, weight: 12, thrust: 21, burn: 1.3, color: '#ff9f1c', style: 'twin', blurb: 'Double the kick, double the thirst.' },
  { id: 'ion', name: 'Ion Drive', cost: 3000, weight: 8, thrust: 7, burn: 0.45, color: '#4fc3ff', style: 'ion', blurb: 'Weak push, sips fuel. Very sci-fi.' },
  { id: 'turbo', name: 'Turbo Rocket', cost: 3600, weight: 10, thrust: 17, burn: 1, color: '#2f7de1', style: 'turbo', blurb: 'Loud enough to wake hibernators.' },
  { id: 'afterburner', name: 'Afterburner', cost: 5600, weight: 14, thrust: 15, burn: 1, spool: 3, color: '#6b7280', style: 'afterburner', perk: 'Spools up to 2× thrust', blurb: 'Starts sluggish, ends furious. Keep it lit!' },
  { id: 'space', name: 'Space Rocket', cost: 8200, weight: 24, thrust: 24, burn: 0.9, color: '#f2b705', style: 'space', blurb: 'Rated for orbit, almost.' },
  { id: 'magma', name: 'Magma Thruster', cost: 13000, weight: 26, thrust: 30, burn: 0.85, color: '#ff5a2a', style: 'magma', unlock: 'canyon', perk: 'The strongest push there is', blurb: 'Bottled volcano. Handle with oven mitts.' },
];

export const FUELS: FuelItem[] = [
  { id: 'thimble', name: 'Thimble', cost: 0, weight: 0.2, seconds: 1.5, blurb: 'A thimble of rocket juice.' },
  { id: 'bottle', name: 'Water Bottle', cost: 120, weight: 1, seconds: 2.5, blurb: 'Please do not drink.' },
  { id: 'jerry', name: 'Jerry Can', cost: 380, weight: 5, seconds: 4, blurb: 'Sloshes reassuringly.' },
  { id: 'flask', name: 'Carbon Flask', cost: 900, weight: 1.5, seconds: 4.5, blurb: 'Light as air, holds a decent gulp.' },
  { id: 'barrel', name: 'Barrel', cost: 1100, weight: 14, seconds: 6.5, blurb: 'Heavy, but worth it.' },
  { id: 'solar', name: 'Solar Panel', cost: 1300, weight: 3, seconds: 1.5, regen: 0.3, style: 'solar', perk: 'Recharges twice while coasting', blurb: 'Tiny battery, endless sunshine.' },
  { id: 'tanker', name: 'Tanker', cost: 2300, weight: 30, seconds: 9.5, blurb: 'Where does the panda even keep this?' },
  { id: 'nitro', name: 'Nitro Canister', cost: 2900, weight: 4, seconds: 3, thrustMul: 1.6, style: 'nitro', perk: '+60% rocket thrust', blurb: 'Small, angry and extremely fast.' },
  { id: 'reactor', name: 'Reactor', cost: 5400, weight: 8, seconds: 12, blurb: 'Bamboo-powered fusion.' },
  { id: 'lavacell', name: 'Lava Cell', cost: 9500, weight: 6, seconds: 14, regen: 0.2, style: 'lava', unlock: 'canyon', perk: 'Huge, and recharges twice', blurb: 'A glowing core of molten bamboo.' },
];

export const SENSORS: SensorItem[] = [
  { id: 'speedo', name: 'Speedometer', cost: 60, weight: 0.3, slots: ['speed'], features: ['speed'], color: '#2f7de1', style: 'dial', blurb: 'Tells you how fast you are going. Usually: not enough.' },
  { id: 'baro', name: 'Barometer', cost: 80, weight: 0.5, slots: ['altitude'], features: ['altitude'], color: '#5aa54a', style: 'dial', blurb: 'Altitude above the valley floor, from air pressure.' },
  { id: 'fuelgauge', name: 'Fuel Gauge', cost: 90, weight: 0.2, slots: ['fuel'], features: ['fuel'], color: '#ff7a3d', style: 'gauge', blurb: 'No more guessing when the rocket will cough out.' },
  { id: 'level', name: 'Bubble Level', cost: 120, weight: 0.2, slots: ['pitch'], features: ['pitch'], color: '#f2b705', style: 'level', blurb: "Shows your nose angle. It's a bubble. In a tube." },
  { id: 'horn', name: 'Stall Horn', cost: 220, weight: 0.4, slots: ['stall'], features: ['stallHorn'], color: '#e2493b', style: 'horn', blurb: 'HONKS when your wings stop working.' },
  { id: 'wrist', name: 'Wrist Computer', cost: 350, weight: 0.4, slots: ['speed', 'altitude', 'pitch'], features: ['speed', 'altitude', 'pitch'], color: '#3a3f4b', style: 'watch', blurb: 'Speed, altitude and pitch in one cheap gadget. Hogs three slots.' },
  { id: 'pitot', name: 'Pitot Tube', cost: 480, weight: 1, slots: ['speed'], features: ['speed', 'climb'], color: '#9aa3ad', style: 'pitot', blurb: 'Airspeed plus climb rate, so you see when you are sinking.' },
  { id: 'radar', name: 'Radar Altimeter', cost: 650, weight: 1.5, slots: ['altitude'], features: ['agl', 'proximity'], color: '#20c5b5', style: 'radar', blurb: 'Height above the ground below you, and a terrain warning.' },
  { id: 'attitude', name: 'Attitude Indicator', cost: 850, weight: 1.2, slots: ['pitch'], features: ['pitch', 'horizon'], color: '#4a6fd1', style: 'ball', blurb: 'An artificial horizon showing your nose and where you are really heading.' },
  { id: 'aoa', name: 'AoA Meter', cost: 1200, weight: 0.8, slots: ['stall'], features: ['aoa'], color: '#9b5de5', style: 'vane', blurb: 'Shows how close you are to stalling, before it happens.' },
];

export const SENSOR_FEATURE_LABEL: Record<SensorFeature, string> = {
  speed: 'Speed',
  climb: 'Climb rate',
  altitude: 'Altitude',
  agl: 'Height above ground',
  proximity: 'Terrain warning',
  fuel: 'Fuel level',
  pitch: 'Pitch angle',
  horizon: 'Flight path',
  stallHorn: 'Stall alarm',
  aoa: 'Stall margin',
};

export const SENSOR_SLOT_LABEL: Record<SensorSlot, string> = {
  speed: 'Speed',
  altitude: 'Altitude',
  pitch: 'Pitch',
  stall: 'Stall',
  fuel: 'Fuel',
};

/** Sensors that can't be equipped alongside `item` (they share a slot). */
export function sensorConflicts(item: SensorItem): SensorItem[] {
  return SENSORS.filter((s) => s.id !== item.id && s.slots.some((slot) => item.slots.includes(slot)));
}

/** Equip a sensor, unequipping anything that shares a slot. Returns the new list and what was removed. */
export function equipSensor(current: string[], id: string): { sensors: string[]; removed: SensorItem[] } {
  const item = SENSORS.find((s) => s.id === id);
  if (!item) return { sensors: current, removed: [] };
  const clash = new Set(sensorConflicts(item).map((s) => s.id));
  const removed = SENSORS.filter((s) => current.includes(s.id) && clash.has(s.id));
  return { sensors: [...current.filter((c) => !clash.has(c) && c !== id), id], removed };
}

export const WEAPONS: WeaponItem[] = [
  { id: 'none', name: 'Bare Paws', cost: 0, weight: 0, damage: 0, rate: 0, ammo: 0, speed: 0, spread: 0, color: '#000', style: 'none', blurb: 'Pandas are lovers, not fighters.' },
  { id: 'peas', name: 'Pea Shooter', cost: 300, weight: 1.5, damage: 1, rate: 4, ammo: 40, speed: 70, spread: 0.03, color: '#6dbb4b', style: 'peas', unlock: 'canyon', blurb: 'A bamboo tube and a lot of peas.' },
  { id: 'sling', name: 'Pinecone Slingshot', cost: 650, weight: 1, damage: 3, rate: 1.4, ammo: 20, speed: 58, spread: 0.02, gravity: true, pierce: 1, color: '#8a5a32', style: 'sling', unlock: 'canyon', perk: 'Heavy hits that pierce', blurb: 'Lob pinecones. They arc, so aim a bit high.' },
  { id: 'crackers', name: 'Firecracker Launcher', cost: 1500, weight: 4, damage: 2, rate: 1.2, ammo: 14, speed: 48, spread: 0.03, blast: 8, color: '#e2493b', style: 'crackers', unlock: 'canyon', perk: 'Explodes: hits everything nearby', blurb: 'Bang! Pop! Fizz! Sorry, birds.' },
  { id: 'bees', name: 'Bee Hive', cost: 2600, weight: 3, damage: 1, rate: 3, ammo: 36, speed: 34, spread: 0.25, homing: true, color: '#ffd23d', style: 'bees', unlock: 'canyon', perk: 'Homing: bees find their target', blurb: 'Friendly bees with a strong sense of justice.' },
  { id: 'snow', name: 'Snowball Gatling', cost: 4000, weight: 8, damage: 1, rate: 10, ammo: 150, speed: 85, spread: 0.1, color: '#e8f4ff', style: 'snow', unlock: 'canyon', perk: '10 shots a second', blurb: 'Brrrrrrrrt. Brought from the Snowy Peaks.' },
  { id: 'laser', name: 'Laser Monocle', cost: 7500, weight: 0.5, damage: 4, rate: 2.5, ammo: 30, speed: 0, spread: 0, hitscan: 160, color: '#ff3b6b', style: 'laser', unlock: 'canyon', perk: 'Instant beam, 160 m range', blurb: 'Very fancy. Very pew.' },
];

export const GADGETS: GadgetItem[] = [
  { id: 'magnet', name: 'Coin Magnet', cost: 500, weight: 1.5, magnet: 16, color: '#e2493b', style: 'magnet', unlock: 'canyon', perk: 'Pulls in coins from 16 m', blurb: 'Coins simply cannot resist you.' },
  { id: 'charm', name: 'Lucky Bamboo', cost: 900, weight: 0.2, coinMul: 1.5, color: '#5aa54a', style: 'charm', unlock: 'canyon', perk: 'Coins are worth 50% more', blurb: 'A little sprig of good fortune.' },
  { id: 'belt', name: 'Ammo Belt', cost: 1100, weight: 3, ammoMul: 2, color: '#8a5a32', style: 'belt', unlock: 'canyon', perk: 'Double ammo', blurb: 'Pockets for days.' },
  { id: 'radar', name: 'Threat Radar', cost: 1300, weight: 0.8, threatRadar: true, color: '#20c5b5', style: 'radar', unlock: 'canyon', perk: 'Arrows point at incoming enemies', blurb: 'Beep. Beep. Crow at two o\'clock.' },
  { id: 'shield', name: 'Bubble Shield', cost: 1700, weight: 2, shield: 2, color: '#7fd8ff', style: 'shield', unlock: 'canyon', perk: 'Blocks 2 hits per flight', blurb: 'A very strong soap bubble.' },
  { id: 'helmet', name: 'Spiky Helmet', cost: 2300, weight: 3, spikes: true, color: '#9aa3ad', style: 'helmet', unlock: 'canyon', perk: 'Ram enemies without slowing', blurb: 'Pointy end forward.' },
  { id: 'suit', name: 'Heat Suit', cost: 3200, weight: 4, heatSuit: true, color: '#c0c6cf', style: 'suit', unlock: 'canyon', perk: 'Lava launches you · stronger thermals', blurb: 'Shiny, crinkly and fireproof.' },
];

export interface CatalogMap {
  ramp: RampItem[];
  sled: SledItem[];
  glider: GliderItem[];
  rocket: RocketItem[];
  fuel: FuelItem[];
  sensor: SensorItem[];
  weapon: WeaponItem[];
  gadget: GadgetItem[];
}

export const CATALOG: CatalogMap = {
  ramp: RAMPS,
  sled: SLEDS,
  glider: GLIDERS,
  rocket: ROCKETS,
  fuel: FUELS,
  sensor: SENSORS,
  weapon: WEAPONS,
  gadget: GADGETS,
};

/** Every shop in the hangar. */
export type ShopCategory = Category | 'sensor' | 'gadget';
export const SHOP_CATEGORIES: ShopCategory[] = ['ramp', 'sled', 'glider', 'rocket', 'fuel', 'sensor', 'weapon', 'gadget'];
/** Shops that only open once this map is unlocked. */
export const SHOP_UNLOCK: Partial<Record<ShopCategory, MapId>> = { weapon: 'canyon', gadget: 'canyon' };

export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  ramp: 'Ramps',
  sled: 'Sleds',
  glider: 'Gliders',
  rocket: 'Rockets',
  fuel: 'Fuel tanks',
  sensor: 'Sensors',
  weapon: 'Weapons',
  gadget: 'Gadgets',
};

export const CATEGORY_ICON: Record<ShopCategory, string> = {
  ramp: '⛷️',
  sled: '🛷',
  glider: '🪁',
  rocket: '🚀',
  fuel: '⛽',
  sensor: '📟',
  weapon: '🎯',
  gadget: '🧲',
};

/** Which item is equipped in each category, by id. */
export type Equipped = Record<Category, string>;
/** Ids of owned items per shop. */
export type Owned = Record<ShopCategory, string[]>;

export const START_EQUIPPED: Equipped = {
  ramp: 'bump',
  sled: 'box',
  glider: 'none',
  rocket: 'none',
  fuel: 'thimble',
  weapon: 'none',
};

export function startOwned(): Owned {
  return {
    ramp: ['bump'],
    sled: ['box'],
    glider: ['none'],
    rocket: ['none'],
    fuel: ['thimble'],
    weapon: ['none'],
    sensor: [],
    gadget: [],
  };
}

export function findItem<C extends ShopCategory>(category: C, id: string): CatalogMap[C][number] | undefined {
  return (CATALOG[category] as Item[]).find((i) => i.id === id) as CatalogMap[C][number] | undefined;
}

export interface Loadout {
  ramp: RampItem;
  sled: SledItem;
  glider: GliderItem;
  rocket: RocketItem;
  fuel: FuelItem;
  weapon: WeaponItem;
  sensors: SensorItem[];
  gadgets: GadgetItem[];
}

export function loadoutFor(equipped: Equipped, sensors: string[] = [], gadgets: string[] = []): Loadout {
  return {
    ramp: findItem('ramp', equipped.ramp) ?? RAMPS[0],
    sled: findItem('sled', equipped.sled) ?? SLEDS[0],
    glider: findItem('glider', equipped.glider) ?? GLIDERS[0],
    rocket: findItem('rocket', equipped.rocket) ?? ROCKETS[0],
    fuel: findItem('fuel', equipped.fuel) ?? FUELS[0],
    weapon: findItem('weapon', equipped.weapon ?? 'none') ?? WEAPONS[0],
    sensors: SENSORS.filter((s) => sensors.includes(s.id)),
    gadgets: GADGETS.filter((g) => gadgets.includes(g.id)).slice(0, MAX_GADGETS),
  };
}

/** Pick items by their index in each (cost-sorted) list. Handy for tests and demos. */
export function loadoutByIndex(
  idx: Partial<Record<Category, number>>,
  sensors: string[] = [],
  gadgets: string[] = [],
): Loadout {
  const at = <T>(list: T[], i: number) => list[Math.max(0, Math.min(list.length - 1, i))];
  return {
    ramp: at(RAMPS, idx.ramp ?? 0),
    sled: at(SLEDS, idx.sled ?? 0),
    glider: at(GLIDERS, idx.glider ?? 0),
    rocket: at(ROCKETS, idx.rocket ?? 0),
    fuel: at(FUELS, idx.fuel ?? 0),
    weapon: at(WEAPONS, idx.weapon ?? 0),
    sensors: SENSORS.filter((s) => sensors.includes(s.id)),
    gadgets: GADGETS.filter((g) => gadgets.includes(g.id)),
  };
}

/** Panda plus everything it carries. The ramp is not carried. */
export function totalMass(g: Loadout): number {
  const rocketParts = g.rocket.thrust > 0 ? g.rocket.weight + g.fuel.weight : 0;
  const instruments = g.sensors.reduce((m, s) => m + s.weight, 0);
  const gadgets = g.gadgets.reduce((m, s) => m + s.weight, 0);
  return PANDA_MASS + g.sled.weight + g.glider.weight + rocketParts + instruments + gadgets + g.weapon.weight;
}

/** Union of everything the equipped sensors can show. */
export function sensorFeatures(g: Loadout): Set<SensorFeature> {
  return new Set(g.sensors.flatMap((s) => s.features));
}

/** Seconds of boost the loadout gets. */
export function burnTime(g: Loadout): number {
  return g.rocket.thrust > 0 ? g.fuel.seconds / g.rocket.burn : 0;
}

/** Combined numeric gadget effects: the biggest magnet, total shield, product of multipliers. */
export const gadgetMax = (g: Loadout, key: 'magnet'): number => g.gadgets.reduce((m, x) => Math.max(m, x[key] ?? 0), 0);
export const gadgetSum = (g: Loadout, key: 'shield'): number => g.gadgets.reduce((m, x) => m + (x[key] ?? 0), 0);
export const gadgetMul = (g: Loadout, key: 'coinMul' | 'ammoMul'): number => g.gadgets.reduce((m, x) => m * (x[key] ?? 1), 1);
export const hasGadget = (g: Loadout, key: 'spikes' | 'heatSuit' | 'threatRadar'): boolean => g.gadgets.some((x) => x[key]);

/** Is an item for sale yet? */
export function itemUnlocked(item: Item, unlocked: readonly MapId[]): boolean {
  return !item.unlock || unlocked.includes(item.unlock);
}
