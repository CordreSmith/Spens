/**
 * The plugin contract for where the shared list lives.
 *
 * A provider stores ONE opaque list document and hands it back. It never merges
 * or resolves conflicts: the SyncEngine merges with `mergeDocs`, which is safe
 * against lost writes, so a provider can be as simple as "read a file, write a file".
 *
 * To add a provider (Dropbox, WebDAV/Nextcloud, a home server, iCloud in a native
 * build, ...): implement `StorageProvider`, describe it with a `ProviderDefinition`
 * and add it to `src/sync/providers.ts`. Nothing else in the app changes.
 */
import type { ListDoc } from '../domain/list';
import type { KeyValueStore } from './KeyValueStore';

export interface RemoteSnapshot {
  /** null when the remote list exists but is empty or was never written. */
  doc: ListDoc | null;
  /** Opaque version marker (ETag, file version, ...). Passed back to `pull` to skip unchanged downloads. */
  revision: string;
}

export interface StorageProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: {
    /** The provider can invite another person to the list by email. */
    share: boolean;
  };

  /** Loads saved connection state. Must not show any UI. */
  init(): Promise<void>;
  /** True when a list is connected and pull/push can run. */
  isConnected(): boolean;
  /** Short label for the connected list, for example "Grocery list · shared by Cordre". */
  describeConnection(): string | null;

  /** Creates a new shared list that starts with `initial`. May show sign-in UI. */
  createList(name: string, initial: ListDoc): Promise<void>;
  /** Connects to a list another person shared. May show sign-in or picker UI. Returns false if the user cancelled. */
  joinList(): Promise<boolean>;
  /** Invites another person to the connected list. Only when `capabilities.share`. */
  shareList(email: string): Promise<void>;
  /** Forgets the connected list on this device. The remote list is kept. */
  disconnect(): Promise<void>;
  /**
   * Fixes the problem behind a NeedsUserActionError, for example by signing in again.
   * The UI calls this straight from a tap, so the provider may open a popup.
   */
  resolveUserAction(): Promise<void>;

  /** Reads the remote list. Returns 'unchanged' when `knownRevision` is still current. */
  pull(knownRevision?: string): Promise<RemoteSnapshot | 'unchanged'>;
  /** Replaces the remote list with `doc`. Returns the new revision. */
  push(doc: ListDoc): Promise<{ revision: string }>;
}

export interface ProviderDefinition {
  id: string;
  displayName: string;
  description: string;
  /** Why this provider can't be used in this build (missing config, unsupported platform), or null. */
  unavailableReason(): string | null;
  create(store: KeyValueStore): StorageProvider;
}

/** The provider needs the person to do something (sign in again, grant access) before sync can go on. */
export class NeedsUserActionError extends Error {
  constructor(
    message: string,
    /** Button text for the fix, for example "Sign in to Google again". */
    readonly actionLabel: string,
  ) {
    super(message);
    this.name = 'NeedsUserActionError';
  }
}

/** The device has no connection to the provider. Sync retries later on its own. */
export class OfflineError extends Error {
  constructor(message = 'No connection. Changes are saved on this phone and sync when you are back online.') {
    super(message);
    this.name = 'OfflineError';
  }
}
