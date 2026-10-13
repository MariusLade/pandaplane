import { storage } from '../core/storage';
import { EMPTY_RECORDS, type Records } from './economy';
import { CATALOG, CATEGORIES, START_EQUIPPED, startOwned, type Equipped, type Owned } from './upgrades';

export interface SaveData {
  version: 2;
  money: number;
  day: number;
  owned: Owned;
  equipped: Equipped;
  best: Records;
  worldSeed: number;
  goalReached: boolean;
  goalDay: number | null;
  totalEarned: number;
  muted: boolean;
}

const KEY = 'pandaplane.save';

export function newSave(): SaveData {
  return {
    version: 2,
    money: 0,
    day: 1,
    owned: startOwned(),
    equipped: { ...START_EQUIPPED },
    best: { ...EMPTY_RECORDS },
    worldSeed: (Math.random() * 2 ** 31) | 0,
    goalReached: false,
    goalDay: null,
    totalEarned: 0,
    muted: false,
  };
}

/** Version 1 saves stored a linear upgrade level per category. */
function migrateV1(data: Record<string, unknown>): Partial<SaveData> {
  const levels = (data.levels ?? {}) as Record<string, number>;
  const owned = startOwned();
  const equipped = { ...START_EQUIPPED };
  for (const c of CATEGORIES) {
    const list = CATALOG[c];
    const n = Math.min(list.length - 1, Math.max(0, levels[c] ?? 0));
    owned[c] = list.slice(0, n + 1).map((i) => i.id);
    equipped[c] = list[n].id;
  }
  const { levels: _drop, ...rest } = data;
  void _drop;
  return { ...(rest as Partial<SaveData>), version: 2, owned, equipped };
}

export function loadSave(): SaveData | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    let data = JSON.parse(raw) as Record<string, unknown>;
    if (data.version === 1) data = migrateV1(data) as Record<string, unknown>;
    if (data.version !== 2) return null;
    const fresh = newSave();
    const loaded = data as unknown as Partial<SaveData>;
    const owned = startOwned();
    for (const c of CATEGORIES) {
      const valid = new Set(CATALOG[c].map((i) => i.id));
      for (const id of loaded.owned?.[c] ?? []) if (valid.has(id) && !owned[c].includes(id)) owned[c].push(id);
    }
    const equipped = { ...START_EQUIPPED };
    for (const c of CATEGORIES) {
      const id = loaded.equipped?.[c];
      if (id && owned[c].includes(id)) equipped[c] = id;
    }
    return { ...fresh, ...loaded, version: 2, owned, equipped, best: { ...fresh.best, ...loaded.best } };
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
