import { hexToRgb, type RGB } from '../core/math';

/**
 * Map definitions. Everything that makes a map look and play differently —
 * biomes, terrain style, sky, scenery, hazards and enemies — is data here, so
 * the world generator and renderer stay generic.
 */
export type MapId = 'valley' | 'canyon' | 'storm';

export type EnemyKind = 'crow' | 'bandit' | 'bat' | 'gull' | 'fish';

export type PondKind = 'ice' | 'water' | 'lava';

export interface Biome {
  name: string;
  start: number;
  ground: RGB;
  groundDeep: RGB;
  lip: RGB;
  hills: RGB;
  /** Snow caps on far mountains, glitter on the ground. */
  snowy: boolean;
  /** Grass tufts along the surface. */
  grass: boolean;
  /** Glowing cracks in the ground. */
  embers: boolean;
  /** What fills dips in the terrain. */
  pond: PondKind;
  /** Scenery props and their odds per 4 m of ground (interpreted by the renderer). */
  scenery: [string, number][];
  /** Enemy mix (weights) and metres between spawns; omit for peaceful biomes. */
  enemies?: [EnemyKind, number][];
  enemyGap?: number;
  /** Chance per terrain cell of a rising thermal column. */
  thermals?: number;
  /** Chance per gust cell of a band of horizontal wind. */
  wind?: number;
  /** Average metres between lightning strikes; omit for fair weather. */
  lightning?: number;
  /** Rain intensity, 0..1. */
  rain?: number;
}

export interface TerrainStyle {
  /** Hill amplitude at the start, metres. */
  amp0: number;
  /** Metres of travel per extra metre of amplitude. */
  ampGrowth: number;
  ampMax: number;
  ridge: number;
  detail: number;
  /** Mesa terrace height in metres (0 = rolling hills). */
  terrace: number;
  /** Sea level: everything below it is open water. Omit for dry maps. */
  sea?: number;
  /** Shifts the hills up or down (islands poke out of the sea). */
  base?: number;
  /** How far the ground dips just after the launch, metres (default 14). */
  runout?: number;
}

export interface SkyStyle {
  lowTop: RGB;
  lowBottom: RGB;
  highTop: RGB;
  highBottom: RGB;
  sun: string;
  sunGlow: string;
  /** Volcano with a smoke plume in the far background. */
  volcano: boolean;
  /** Brooding storm clouds and a lighthouse beam in the far background. */
  storm?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  tagline: string;
  goal: number;
  goalName: string;
  biomes: Biome[];
  terrain: TerrainStyle;
  sky: SkyStyle;
  /** Multiplier on flight earnings (harder maps pay more). */
  pay: number;
  seedSalt: number;
  /** Emoji for the goal (progress bars, toasts, victory). */
  icon: string;
  /** What the panda says on arriving in the hangar after switching here. */
  hello: string;
  /** Victory story: "…our panda <story>". */
  story: string;
  /** What unlocking this map adds, for the unlock banner. */
  unlockNote: string;
}

interface BiomeSpec {
  name: string;
  start: number;
  colors: [string, string, string, string];
  snowy?: boolean;
  grass?: boolean;
  embers?: boolean;
  pond: PondKind;
  scenery: [string, number][];
  enemies?: [EnemyKind, number][];
  enemyGap?: number;
  thermals?: number;
  wind?: number;
  lightning?: number;
  rain?: number;
}

const biome = (b: BiomeSpec): Biome => ({
  name: b.name,
  start: b.start,
  ground: hexToRgb(b.colors[0]),
  groundDeep: hexToRgb(b.colors[1]),
  lip: hexToRgb(b.colors[2]),
  hills: hexToRgb(b.colors[3]),
  snowy: b.snowy ?? false,
  grass: b.grass ?? false,
  embers: b.embers ?? false,
  pond: b.pond,
  scenery: b.scenery,
  enemies: b.enemies,
  enemyGap: b.enemyGap,
  thermals: b.thermals,
  wind: b.wind,
  lightning: b.lightning,
  rain: b.rain,
});

const VALLEY_GOAL = 7000;

export const VALLEY: MapDef = {
  id: 'valley',
  name: 'Bamboo Valley',
  tagline: 'Snowy peaks, pine forests and the sweetest bamboo in the world.',
  goal: VALLEY_GOAL,
  goalName: 'Panda Paradise',
  pay: 1,
  seedSalt: 0,
  icon: '🎋',
  hello: 'Home sweet bamboo.',
  story: 'finally reached the sweetest bamboo in the world.',
  unlockNote: '',
  terrain: { amp0: 10, ampGrowth: 180, ampMax: 34, ridge: 1.6, detail: 1.6, terrace: 0 },
  sky: {
    lowTop: hexToRgb('#4aa3ee'),
    lowBottom: hexToRgb('#d4f0ff'),
    highTop: hexToRgb('#173f8f'),
    highBottom: hexToRgb('#7fb8ee'),
    sun: '#fff8dc',
    sunGlow: '255,248,214',
    volcano: false,
  },
  biomes: [
    biome({
      name: 'Snowy Peaks',
      start: -Infinity,
      colors: ['#e3edf8', '#9fb2cc', '#ffffff', '#b8c9e2'],
      snowy: true,
      pond: 'ice',
      scenery: [['snowpine', 0.34], ['dead', 0.03], ['rock', 0.07], ['drift', 0.08], ['snowman', 0.006]],
    }),
    biome({
      name: 'Pine Valley',
      start: 1400,
      colors: ['#9cc386', '#55794f', '#d6ecc4', '#8fb3a0'],
      grass: true,
      pond: 'water',
      scenery: [['pine', 0.28], ['birch', 0.08], ['bush', 0.1], ['rock', 0.06], ['mushroom', 0.02]],
    }),
    biome({
      name: 'Flower Meadows',
      start: 3000,
      colors: ['#86cf62', '#3f8a3a', '#b4ec86', '#97c98c'],
      grass: true,
      pond: 'water',
      scenery: [['oak', 0.13], ['birch', 0.05], ['bush', 0.12], ['flowers', 0.28], ['mushroom', 0.04], ['rock', 0.03]],
    }),
    biome({
      name: 'Bamboo Forest',
      start: 4800,
      colors: ['#62b25a', '#2e6b35', '#93d86e', '#7fb88a'],
      grass: true,
      pond: 'water',
      scenery: [['bamboo', 0.42], ['bush', 0.1], ['rock', 0.04], ['flowers', 0.05]],
    }),
    biome({
      name: 'Panda Paradise',
      start: VALLEY_GOAL - 200,
      colors: ['#a5e06a', '#4f9a3c', '#e4f79a', '#b5d58a'],
      grass: true,
      pond: 'water',
      scenery: [['cherry', 0.22], ['bamboo', 0.2], ['lantern', 0.05], ['flowers', 0.25], ['bush', 0.05]],
    }),
  ],
};

const CANYON_GOAL = 11000;

export const CANYON: MapDef = {
  id: 'canyon',
  name: 'Ember Canyon',
  tagline: 'A volcanic canyon at sunset, full of thermals, lava and grumpy birds.',
  goal: CANYON_GOAL,
  goalName: 'Golden Pagoda',
  pay: 1.6,
  seedSalt: 4242,
  icon: '🏯',
  hello: 'Ember Canyon. Bring sunscreen.',
  story: 'crossed the canyon of fire and rang the bell of the Golden Pagoda.',
  unlockNote: 'Plus new shops: Weapons and Gadgets, and new top-tier gear.',
  terrain: { amp0: 14, ampGrowth: 150, ampMax: 58, ridge: 1.8, detail: 2.2, terrace: 9 },
  sky: {
    lowTop: hexToRgb('#6a3a8c'),
    lowBottom: hexToRgb('#ffb072'),
    highTop: hexToRgb('#2a1546'),
    highBottom: hexToRgb('#c0607a'),
    sun: '#ffcf7a',
    sunGlow: '255,170,90',
    volcano: true,
  },
  biomes: [
    biome({
      name: 'Ash Slopes',
      start: -Infinity,
      colors: ['#8d8a8f', '#55525a', '#bdb8be', '#7a6276'],
      pond: 'lava',
      scenery: [['charred', 0.12], ['rock', 0.08], ['basalt', 0.05]],
      enemies: [['crow', 1]],
      enemyGap: 170,
      thermals: 0.15,
    }),
    biome({
      name: 'Red Canyon',
      start: 1500,
      colors: ['#d9774a', '#9c4a2c', '#f2a46b', '#b0604a'],
      pond: 'water',
      scenery: [['cactus', 0.14], ['shrub', 0.1], ['rock', 0.08], ['palm', 0.02]],
      enemies: [['crow', 2], ['bandit', 1]],
      enemyGap: 140,
      thermals: 0.3,
    }),
    biome({
      name: 'Lava Fields',
      start: 4500,
      colors: ['#3a3036', '#1e181c', '#ff7a3d', '#5a3a44'],
      embers: true,
      pond: 'lava',
      scenery: [['basalt', 0.12], ['charred', 0.08], ['rock', 0.05]],
      enemies: [['bat', 2], ['bandit', 1], ['crow', 1]],
      enemyGap: 115,
      thermals: 0.75,
    }),
    biome({
      name: 'Crystal Ridge',
      start: 7500,
      colors: ['#5b4a8a', '#33285a', '#c8b6ff', '#6c5a9c'],
      pond: 'water',
      scenery: [['crystal', 0.22], ['rock', 0.06], ['charred', 0.03]],
      enemies: [['crow', 1], ['bat', 1], ['bandit', 1]],
      enemyGap: 100,
      thermals: 0.35,
    }),
    biome({
      name: 'Golden Pagoda',
      start: CANYON_GOAL - 200,
      colors: ['#e0b04a', '#9c7424', '#ffe08a', '#c99a5b'],
      grass: true,
      pond: 'water',
      scenery: [['cherry', 0.18], ['bamboo', 0.15], ['lantern', 0.08], ['flowers', 0.2]],
    }),
  ],
};

const STORM_GOAL = 15000;

export const STORM: MapDef = {
  id: 'storm',
  name: 'Storm Coast',
  tagline: 'A chain of islands under a brewing storm: gusts, lightning and flying fish.',
  goal: STORM_GOAL,
  goalName: 'The Lighthouse',
  pay: 2.2,
  seedSalt: 9191,
  icon: '🗼',
  hello: 'Storm Coast. I packed an umbrella.',
  story: 'braved the storm, dodged the lightning and lit the old lighthouse.',
  unlockNote: 'Plus storm gear: a wind sock, a lightning rod, a storm kite, a jet ski and more.',
  terrain: { amp0: 12, ampGrowth: 260, ampMax: 46, ridge: 1.3, detail: 1.2, terrace: 0, sea: -6, base: -4, runout: 3 },
  sky: {
    lowTop: hexToRgb('#3d5a80'),
    lowBottom: hexToRgb('#b8d4d8'),
    highTop: hexToRgb('#141c33'),
    highBottom: hexToRgb('#4f6d8f'),
    sun: '#f4f1de',
    sunGlow: '230,240,255',
    volcano: false,
    storm: true,
  },
  biomes: [
    biome({
      name: 'Palm Beach',
      start: -Infinity,
      colors: ['#f0d8a0', '#c09a62', '#fff3cf', '#7fa8a4'],
      pond: 'water',
      scenery: [['palm', 0.16], ['shrub', 0.06], ['shell', 0.08], ['rock', 0.04], ['parasol', 0.015]],
      enemies: [['gull', 1]],
      enemyGap: 190,
      wind: 0.25,
    }),
    biome({
      name: 'Coral Shallows',
      start: 2200,
      colors: ['#e9cf95', '#b48f58', '#fff0c4', '#6f9fa6'],
      pond: 'water',
      scenery: [['palm', 0.12], ['shell', 0.08], ['rock', 0.06], ['shrub', 0.05]],
      enemies: [['gull', 2], ['fish', 2]],
      enemyGap: 150,
      wind: 0.4,
      rain: 0.15,
    }),
    biome({
      name: 'Open Sea',
      start: 5500,
      colors: ['#8f8a7c', '#5b574d', '#c9c2ad', '#4f6f84'],
      pond: 'water',
      scenery: [['basalt', 0.08], ['rock', 0.08], ['palm', 0.04], ['shell', 0.04]],
      enemies: [['fish', 3], ['gull', 2]],
      enemyGap: 125,
      wind: 0.55,
      lightning: 520,
      rain: 0.45,
    }),
    biome({
      name: 'Storm Front',
      start: 9500,
      colors: ['#5e6670', '#363c45', '#a3adb8', '#3a4a5e'],
      pond: 'water',
      scenery: [['basalt', 0.1], ['charred', 0.06], ['rock', 0.08]],
      enemies: [['gull', 2], ['fish', 2], ['bat', 1]],
      enemyGap: 105,
      wind: 0.7,
      lightning: 230,
      rain: 1,
    }),
    biome({
      name: 'The Lighthouse',
      start: STORM_GOAL - 200,
      colors: ['#8fc46a', '#4f8a3c', '#d4f0a0', '#7fa8a4'],
      grass: true,
      pond: 'water',
      scenery: [['flowers', 0.2], ['shrub', 0.08], ['lantern', 0.05], ['palm', 0.05]],
    }),
  ],
};

export const MAPS: Record<MapId, MapDef> = { valley: VALLEY, canyon: CANYON, storm: STORM };
export const MAP_ORDER: MapId[] = ['valley', 'canyon', 'storm'];
