/**
 * Tiny key/value persistence wrapper. Uses localStorage on the web; swap the
 * backend (e.g. Capacitor Preferences) when porting to mobile.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();

export const storage: KeyValueStore = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};
