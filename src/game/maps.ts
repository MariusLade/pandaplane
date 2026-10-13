import { hexToRgb, type RGB } from '../core/math';

/**
 * Map definitions. Everything that makes a map look and play differently —
 * biomes, terrain style, sky, scenery, hazards and enemies — is data here, so
 * the world generator and renderer stay generic.
 */
export type MapId = 'valley' | 'canyon';

export type EnemyKind = 'crow' | 'bandit' | 'bat';

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

export const MAPS: Record<MapId, MapDef> = { valley: VALLEY, canyon: CANYON };
export const MAP_ORDER: MapId[] = ['valley', 'canyon'];
