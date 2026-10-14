import { storage } from '../core/storage';
import { EMPTY_RECORDS, type Records } from './economy';
import { MAP_ORDER, type MapId } from './maps';
import {
  CATALOG,
  CATEGORIES,
  GADGETS,
  MAX_GADGETS,
  SHOP_CATEGORIES,
  START_EQUIPPED,
  equipSensor,
  startOwned,
  type Equipped,
  type Owned,
} from './upgrades';

export interface MapProgress {
  best: Records;
  goalReached: boolean;
  goalDay: number | null;
}

export interface SaveData {
  version: 2;
  money: number;
  day: number;
  owned: Owned;
  equipped: Equipped;
  /** Equipped sensor ids (several at once, no two sharing a slot). */
  sensors: string[];
  /** Equipped gadget ids (up to MAX_GADGETS). */
  gadgets: string[];
  /** The map flights take place on. */
  map: MapId;
  unlocked: MapId[];
  progress: Record<MapId, MapProgress>;
  worldSeed: number;
  totalEarned: number;
  muted: boolean;
}

const KEY = 'pandaplane.save';

const freshProgress = (): MapProgress => ({ best: { ...EMPTY_RECORDS }, goalReached: false, goalDay: null });

export function newSave(): SaveData {
  return {
    version: 2,
    money: 0,
    day: 1,
    owned: startOwned(),
    equipped: { ...START_EQUIPPED },
    sensors: [],
    gadgets: [],
    map: 'valley',
    unlocked: ['valley'],
    progress: { valley: freshProgress(), canyon: freshProgress(), storm: freshProgress() },
    worldSeed: (Math.random() * 2 ** 31) | 0,
    totalEarned: 0,
    muted: false,
  };
}

/** Version 1 saves stored a linear upgrade level per category. */
function migrateV1(data: Record<string, unknown>): Record<string, unknown> {
  const levels = (data.levels ?? {}) as Record<string, number>;
  const owned = startOwned();
  const equipped = { ...START_EQUIPPED };
  for (const c of CATEGORIES) {
    if (c === 'weapon') continue;
    const list = CATALOG[c];
    const n = Math.min(list.length - 1, Math.max(0, levels[c] ?? 0));
    owned[c] = list.slice(0, n + 1).map((i) => i.id);
    equipped[c] = list[n].id;
  }
  const { levels: _drop, ...rest } = data;
  void _drop;
  return { ...rest, version: 2, owned, equipped };
}

export function loadSave(): SaveData | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    let data = JSON.parse(raw) as Record<string, unknown>;
    if (data.version === 1) data = migrateV1(data);
    if (data.version !== 2) return null;
    const fresh = newSave();
    const loaded = data as unknown as Partial<SaveData> & { best?: Records; goalReached?: boolean; goalDay?: number | null };

    const owned = startOwned();
    for (const c of SHOP_CATEGORIES) {
      const valid = new Set(CATALOG[c].map((i) => i.id));
      for (const id of loaded.owned?.[c] ?? []) if (valid.has(id) && !owned[c].includes(id)) owned[c].push(id);
    }
    const equipped = { ...START_EQUIPPED };
    for (const c of CATEGORIES) {
      const id = loaded.equipped?.[c];
      if (id && owned[c].includes(id)) equipped[c] = id;
    }
    let sensors: string[] = [];
    for (const id of loaded.sensors ?? []) if (owned.sensor.includes(id)) sensors = equipSensor(sensors, id).sensors;
    const gadgets = (loaded.gadgets ?? [])
      .filter((id) => owned.gadget.includes(id) && GADGETS.some((g) => g.id === id))
      .slice(0, MAX_GADGETS);

    // Older saves kept a single set of records for the first map.
    const progress = { ...fresh.progress };
    for (const id of MAP_ORDER) {
      const p = loaded.progress?.[id];
      if (p) progress[id] = { ...freshProgress(), ...p, best: { ...EMPTY_RECORDS, ...p.best } };
    }
    if (!loaded.progress && loaded.best) {
      progress.valley = {
        best: { ...EMPTY_RECORDS, ...loaded.best },
        goalReached: !!loaded.goalReached,
        goalDay: loaded.goalDay ?? null,
      };
    }
    const unlocked = MAP_ORDER.filter(
      (id, i) => id === 'valley' || loaded.unlocked?.includes(id) || progress[MAP_ORDER[i - 1]]?.goalReached,
    );
    const map = loaded.map && unlocked.includes(loaded.map) ? loaded.map : 'valley';

    return {
      ...fresh,
      money: loaded.money ?? 0,
      day: loaded.day ?? 1,
      worldSeed: loaded.worldSeed ?? fresh.worldSeed,
      totalEarned: loaded.totalEarned ?? 0,
      muted: loaded.muted ?? false,
      owned,
      equipped,
      sensors,
      gadgets,
      map,
      unlocked,
      progress,
    };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  storage.set(KEY, JSON.stringify(data));
}

export function clearSave(): void {
  storage.remove(KEY);
}
