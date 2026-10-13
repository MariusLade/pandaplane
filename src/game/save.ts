import { storage } from '../core/storage';
import { EMPTY_RECORDS, type Records } from './economy';
import { START_LEVELS, type Levels } from './upgrades';

export interface SaveData {
  version: 1;
  money: number;
  day: number;
  levels: Levels;
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
    version: 1,
    money: 0,
    day: 1,
    levels: { ...START_LEVELS },
    best: { ...EMPTY_RECORDS },
    worldSeed: (Math.random() * 2 ** 31) | 0,
    goalReached: false,
    goalDay: null,
    totalEarned: 0,
    muted: false,
  };
}

export function loadSave(): SaveData | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return null;
    const fresh = newSave();
    return {
      ...fresh,
      ...data,
      levels: { ...fresh.levels, ...data.levels },
      best: { ...fresh.best, ...data.best },
    } as SaveData;
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
