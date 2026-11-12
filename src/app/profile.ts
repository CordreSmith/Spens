import type { Actor } from '../domain/list';
import type { KeyValueStore } from '../sync/KeyValueStore';

const PROFILE_KEY = 'profile';

/** This install's identity: a random device id (for merge stamps) plus the name shown on items. */
export async function loadActor(store: KeyValueStore): Promise<Actor> {
  const raw = await store.get(PROFILE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Partial<Actor>;
      if (typeof saved.deviceId === 'string') return { deviceId: saved.deviceId, name: saved.name ?? '' };
    } catch {
      // Fall through and make a new profile.
    }
  }
  const actor: Actor = { deviceId: crypto.randomUUID(), name: '' };
  await saveActor(store, actor);
  return actor;
}

export function saveActor(store: KeyValueStore, actor: Actor): Promise<void> {
  return store.set(PROFILE_KEY, JSON.stringify(actor));
}
