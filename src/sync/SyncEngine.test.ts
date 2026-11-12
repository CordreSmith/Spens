import { describe, expect, it } from 'vitest';
import { addItem, setChecked, viewList, type ListDoc } from '../domain/list';
import { memoryStore, type KeyValueStore } from './KeyValueStore';
import { NeedsUserActionError, OfflineError, type ProviderDefinition, type StorageProvider } from './StorageProvider';
import { SyncEngine } from './SyncEngine';

/** A shared "cloud file" that several fake providers (phones) read and write. */
class FakeCloud {
  json: string | null = null;
  version = 0;
  downloads = 0;
  failNext: Error | null = null;
  /** Lets a test run code between a phone's pull and its push. */
  beforePush: (() => Promise<void>) | null = null;
}

function fakeDefinition(cloud: FakeCloud): ProviderDefinition {
  return {
    id: 'fake',
    displayName: 'Fake cloud',
    description: 'In-memory storage for tests',
    unavailableReason: () => null,
    create: (store: KeyValueStore): StorageProvider => {
      let connected = false;
      return {
        id: 'fake',
        displayName: 'Fake cloud',
        capabilities: { share: false },
        async init() {
          connected = (await store.get('fake.connected')) === 'yes';
        },
        isConnected: () => connected,
        describeConnection: () => 'Fake list',
        async createList(_name: string, initial: ListDoc) {
          cloud.json = JSON.stringify(initial);
          cloud.version++;
          connected = true;
          await store.set('fake.connected', 'yes');
        },
        async joinList() {
          connected = true;
          await store.set('fake.connected', 'yes');
          return true;
        },
        async shareList() {},
        async disconnect() {
          connected = false;
          await store.remove('fake.connected');
        },
        async resolveUserAction() {},
        async pull(knownRevision?: string) {
          throwIfFailing();
          if (knownRevision === String(cloud.version)) return 'unchanged';
          cloud.downloads++;
          return { doc: cloud.json ? JSON.parse(cloud.json) : null, revision: String(cloud.version) };
        },
        async push(doc: ListDoc) {
          const hook = cloud.beforePush;
          cloud.beforePush = null;
          await hook?.();
          throwIfFailing();
          cloud.json = JSON.stringify(doc);
          cloud.version++;
          return { revision: String(cloud.version) };
        },
      };

      function throwIfFailing() {
        const error = cloud.failNext;
        cloud.failNext = null;
        if (error) throw error;
      }
    },
  };
}

const me = { deviceId: 'phone-a', name: 'Me' };
const wife = { deviceId: 'phone-b', name: 'Wife' };

async function phone(cloud: FakeCloud, store: KeyValueStore = memoryStore()) {
  return SyncEngine.open(store, [fakeDefinition(cloud)], { pushDelayMs: 60_000 });
}

function toBuy(engine: SyncEngine) {
  return viewList(engine.getState().doc).toBuy.map((i) => i.name);
}

describe('SyncEngine', () => {
  it('shares items between two phones', async () => {
    const cloud = new FakeCloud();
    const a = await phone(cloud);
    a.change((doc) => addItem(doc, { name: 'Milk' }, me, 1).doc);
    await a.createList('fake', 'Groceries');

    const b = await phone(cloud);
    b.change((doc) => addItem(doc, { name: 'Bread' }, wife, 2).doc);
    await b.joinList('fake');
    await a.sync();

    expect(toBuy(a)).toEqual(['Milk', 'Bread']);
    expect(toBuy(b)).toEqual(['Milk', 'Bread']);
    expect(a.getState().status).toBe('synced');
    expect(b.getState().pendingChanges).toBe(false);
  });

  it('recovers a change when both phones push at the same moment', async () => {
    const cloud = new FakeCloud();
    const a = await phone(cloud);
    await a.createList('fake', 'Groceries');
    const b = await phone(cloud);
    await b.joinList('fake');

    a.change((doc) => addItem(doc, { name: 'Milk' }, me, 10).doc);
    b.change((doc) => addItem(doc, { name: 'Eggs' }, wife, 11).doc);
    // Phone B pulls, then phone A pushes before B pushes: B's push overwrites Milk.
    cloud.beforePush = () => a.sync();
    await b.sync();
    expect(JSON.parse(cloud.json!).items.milk).toBeUndefined();

    // Phone A still has Milk, sees the cloud copy lacks it and pushes it back.
    await a.sync();
    await b.sync();
    expect(toBuy(a).sort()).toEqual(['Eggs', 'Milk']);
    expect(toBuy(b).sort()).toEqual(['Eggs', 'Milk']);
  });

  it('skips the download when nothing changed', async () => {
    const cloud = new FakeCloud();
    const a = await phone(cloud);
    await a.createList('fake', 'Groceries');
    const before = cloud.downloads;
    await a.sync();
    await a.sync();
    expect(cloud.downloads).toBe(before);
  });

  it('keeps changes made offline and pushes them later', async () => {
    const cloud = new FakeCloud();
    const a = await phone(cloud);
    await a.createList('fake', 'Groceries');

    a.change((doc) => addItem(doc, { name: 'Tea' }, me, 5).doc);
    cloud.failNext = new OfflineError();
    await a.sync();
    expect(a.getState().status).toBe('offline');
    expect(a.getState().pendingChanges).toBe(true);

    await a.sync();
    expect(a.getState().status).toBe('synced');
    expect(Object.keys(JSON.parse(cloud.json!).items)).toEqual(['tea']);
  });

  it('asks the person to act when the provider needs it', async () => {
    const cloud = new FakeCloud();
    const a = await phone(cloud);
    await a.createList('fake', 'Groceries');
    cloud.failNext = new NeedsUserActionError('Sign-in expired', 'Sign in again');
    await a.sync();
    expect(a.getState()).toMatchObject({ status: 'needs-user-action', actionLabel: 'Sign in again' });
    await a.resolveUserAction();
    expect(a.getState().status).toBe('synced');
  });

  it('restores the list and the connection after the app restarts', async () => {
    const cloud = new FakeCloud();
    const store = memoryStore();
    const a = await phone(cloud, store);
    await a.createList('fake', 'Groceries');
    const { doc, id } = addItem(a.getState().doc, { name: 'Rice' }, me, 3);
    a.change(() => setChecked(doc, id, true, me, 4));
    await a.flush();

    const reopened = await phone(cloud, store);
    expect(viewList(reopened.getState().doc).inTrolley.map((i) => i.name)).toEqual(['Rice']);
    expect(reopened.getState().connection?.providerId).toBe('fake');
    expect(reopened.getState().pendingChanges).toBe(true);
  });

  it('keeps working on the phone alone when no storage is connected', async () => {
    const a = await phone(new FakeCloud());
    a.change((doc) => addItem(doc, { name: 'Salt' }, me, 1).doc);
    await a.sync();
    expect(a.getState().status).toBe('not-connected');
    expect(toBuy(a)).toEqual(['Salt']);
  });
});
