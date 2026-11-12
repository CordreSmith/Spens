/**
 * Keeps the list on this device and in step with the connected storage provider.
 *
 * Every change is saved on the device first, so the app works offline. A sync
 * pulls the remote copy, merges it with the local one and pushes the result when
 * the remote copy is missing anything. Because merging is a CRDT merge, two phones
 * that push at the same moment can't lose each other's changes: the next sync of
 * either phone puts the missing changes back.
 *
 * The engine has no browser or platform code. The UI decides when to call `sync()`
 * (on open, on focus, on a timer), so a native build can use its own app events.
 */
import { docsEqual, emptyDoc, mergeDocs, parseDoc, type ListDoc } from '../domain/list';
import type { KeyValueStore } from './KeyValueStore';
import {
  NeedsUserActionError,
  OfflineError,
  type ProviderDefinition,
  type StorageProvider,
} from './StorageProvider';

export type SyncStatus = 'not-connected' | 'syncing' | 'synced' | 'offline' | 'needs-user-action' | 'error';

export interface EngineState {
  doc: ListDoc;
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Explains the offline / error / needs-user-action status. */
  message: string | null;
  /** Button text for needs-user-action. */
  actionLabel: string | null;
  /** Local changes that the provider does not have yet. */
  pendingChanges: boolean;
  connection: {
    providerId: string;
    providerName: string;
    label: string | null;
    canShare: boolean;
  } | null;
}

interface SyncMeta {
  providerId: string | null;
  revision: string | null;
  /** Count of local changes, and how many of them the provider has. */
  localSeq: number;
  pushedSeq: number;
  lastSyncedAt: number | null;
}

export interface SyncEngineOptions {
  /** Delay between a local change and the push it triggers. */
  pushDelayMs?: number;
  now?: () => number;
}

const DOC_KEY = 'doc';
const META_KEY = 'sync';

export class SyncEngine {
  private provider: StorageProvider | null = null;
  private state: EngineState;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private runAgain = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();

  static async open(
    store: KeyValueStore,
    definitions: readonly ProviderDefinition[],
    options: SyncEngineOptions = {},
  ): Promise<SyncEngine> {
    const doc = await loadDoc();
    const meta = await loadMeta();
    const engine = new SyncEngine(store, definitions, options, doc, meta);
    const definition = definitions.find((d) => d.id === meta.providerId);
    if (definition && !definition.unavailableReason()) {
      const provider = definition.create(store);
      await provider.init();
      if (provider.isConnected()) engine.provider = provider;
    }
    engine.refreshState();
    return engine;

    async function loadDoc(): Promise<ListDoc> {
      const raw = await store.get(DOC_KEY);
      if (!raw) return emptyDoc();
      try {
        return parseDoc(JSON.parse(raw));
      } catch {
        return emptyDoc();
      }
    }

    async function loadMeta(): Promise<SyncMeta> {
      const fallback: SyncMeta = { providerId: null, revision: null, localSeq: 0, pushedSeq: 0, lastSyncedAt: null };
      const raw = await store.get(META_KEY);
      if (!raw) return fallback;
      try {
        return { ...fallback, ...(JSON.parse(raw) as Partial<SyncMeta>) };
      } catch {
        return fallback;
      }
    }
  }

  private constructor(
    private readonly store: KeyValueStore,
    readonly definitions: readonly ProviderDefinition[],
    private readonly options: SyncEngineOptions,
    doc: ListDoc,
    private meta: SyncMeta,
  ) {
    this.state = {
      doc,
      status: 'not-connected',
      lastSyncedAt: meta.lastSyncedAt,
      message: null,
      actionLabel: null,
      pendingChanges: false,
      connection: null,
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): EngineState => this.state;

  /** Applies a local change, saves it on the device and schedules a push. */
  change(mutate: (doc: ListDoc) => ListDoc): void {
    const next = mutate(this.state.doc);
    if (next === this.state.doc) return;
    this.meta = { ...this.meta, localSeq: this.meta.localSeq + 1 };
    this.setDoc(next);
    this.saveMeta();
    this.refreshState();
    if (!this.provider) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.sync();
    }, this.options.pushDelayMs ?? 800);
  }

  /** Pulls, merges and pushes. Safe to call often; overlapping calls share one run. */
  sync(): Promise<void> {
    if (!this.provider) return Promise.resolve();
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = this.runSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async createList(providerId: string, name: string): Promise<void> {
    const provider = await this.prepareProvider(providerId);
    await provider.createList(name, this.state.doc);
    await this.attach(provider);
  }

  /** Returns false if the person cancelled. */
  async joinList(providerId: string): Promise<boolean> {
    const provider = await this.prepareProvider(providerId);
    if (!(await provider.joinList())) return false;
    await this.attach(provider);
    return true;
  }

  async shareList(email: string): Promise<void> {
    if (!this.provider?.capabilities.share) throw new Error('This storage cannot share lists.');
    await this.provider.shareList(email);
  }

  /** Stops syncing on this device. The items stay on this phone and in the remote list. */
  async disconnect(): Promise<void> {
    const provider = this.provider;
    this.provider = null;
    this.meta = { ...this.meta, providerId: null, revision: null, lastSyncedAt: null };
    this.saveMeta();
    this.setStatus('not-connected');
    await provider?.disconnect();
  }

  /** Call straight from a tap: the provider may open a sign-in popup. */
  async resolveUserAction(): Promise<void> {
    if (!this.provider) return;
    try {
      await this.provider.resolveUserAction();
    } catch (error) {
      this.handleError(error);
      return;
    }
    await this.sync();
  }

  private async prepareProvider(providerId: string): Promise<StorageProvider> {
    const definition = this.definitions.find((d) => d.id === providerId);
    if (!definition) throw new Error(`Unknown storage: ${providerId}`);
    const reason = definition.unavailableReason();
    if (reason) throw new Error(reason);
    if (this.provider) await this.disconnect();
    const provider = definition.create(this.store);
    await provider.init();
    return provider;
  }

  private async attach(provider: StorageProvider): Promise<void> {
    this.provider = provider;
    this.meta = { ...this.meta, providerId: provider.id, revision: null };
    this.saveMeta();
    this.refreshState();
    await this.sync();
  }

  private async runSync(): Promise<void> {
    const provider = this.provider;
    if (!provider) return;
    this.setStatus('syncing');
    try {
      do {
        this.runAgain = false;
        const pulled = await provider.pull(this.meta.revision ?? undefined);
        if (this.provider !== provider) return;
        let needsPush = this.meta.localSeq > this.meta.pushedSeq;
        if (pulled !== 'unchanged') {
          const merged = mergeDocs(this.state.doc, pulled.doc ?? emptyDoc());
          this.meta = { ...this.meta, revision: pulled.revision };
          if (!docsEqual(merged, this.state.doc)) this.setDoc(merged);
          if (!pulled.doc || !docsEqual(merged, pulled.doc)) needsPush = true;
        }
        if (needsPush) {
          const seq = this.meta.localSeq;
          const { revision } = await provider.push(this.state.doc);
          if (this.provider !== provider) return;
          this.meta = { ...this.meta, revision, pushedSeq: Math.max(this.meta.pushedSeq, seq) };
          // A change made while the push was in flight needs another round.
          if (this.meta.localSeq > seq) this.runAgain = true;
        }
        this.meta = { ...this.meta, lastSyncedAt: this.now() };
        this.saveMeta();
      } while (this.runAgain);
      this.setStatus('synced');
    } catch (error) {
      if (this.provider === provider) this.handleError(error);
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof NeedsUserActionError) {
      this.setStatus('needs-user-action', error.message, error.actionLabel);
    } else if (error instanceof OfflineError) {
      this.setStatus('offline', error.message);
    } else {
      this.setStatus('error', error instanceof Error ? error.message : String(error));
    }
  }

  private setDoc(doc: ListDoc): void {
    this.state = { ...this.state, doc };
    const json = JSON.stringify(doc);
    this.writes = this.writes.then(() => this.store.set(DOC_KEY, json)).catch(() => undefined);
    this.emit();
  }

  private saveMeta(): void {
    const json = JSON.stringify(this.meta);
    this.writes = this.writes.then(() => this.store.set(META_KEY, json)).catch(() => undefined);
  }

  private setStatus(status: SyncStatus, message: string | null = null, actionLabel: string | null = null): void {
    this.state = { ...this.state, status, message, actionLabel };
    this.refreshState();
  }

  /** Recomputes the derived parts of the state and notifies listeners. */
  private refreshState(): void {
    const provider = this.provider;
    const status = provider ? this.state.status : 'not-connected';
    this.state = {
      ...this.state,
      status: provider && status === 'not-connected' ? 'synced' : status,
      lastSyncedAt: this.meta.lastSyncedAt,
      pendingChanges: this.meta.localSeq > this.meta.pushedSeq,
      connection: provider
        ? {
            providerId: provider.id,
            providerName: provider.displayName,
            label: provider.describeConnection(),
            canShare: provider.capabilities.share,
          }
        : null,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  /** Waits for queued device writes. For tests and clean shutdown. */
  flush(): Promise<void> {
    return this.writes;
  }
}
