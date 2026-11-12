/**
 * Small async key-value storage on the device. The web build uses localStorage.
 * A native build (Capacitor) can swap in the Preferences plugin without touching
 * the rest of the app, which is why the interface is async.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function localStorageStore(prefix = 'grocery.'): KeyValueStore {
  return {
    async get(key) {
      return localStorage.getItem(prefix + key);
    },
    async set(key, value) {
      localStorage.setItem(prefix + key, value);
    },
    async remove(key) {
      localStorage.removeItem(prefix + key);
    },
  };
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
