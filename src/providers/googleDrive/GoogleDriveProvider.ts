/**
 * Stores the shared list as one JSON file in the Google Drive of the person who
 * creates it. That person shares the file with the rest of the household.
 *
 * Privacy: the app asks only for the `drive.file` scope. With it the app can see
 * the files it created and the files a person picks in Google Picker, and nothing
 * else in their Drive. The list never touches any server other than Google Drive.
 *
 * Sign-in uses Google Identity Services in the browser. Browser access tokens last
 * about an hour and can't be refreshed without a tap, so an expired token surfaces
 * as a NeedsUserActionError ("Meld by Google aan") instead of a silent failure.
 * A native build can replace this file's auth part with native Google sign-in.
 */
import { parseDoc, type ListDoc } from '../../domain/list';
import { LocalizedError, translate, type Message } from '../../i18n/messages';
import {
  NeedsUserActionError,
  OfflineError,
  type ProviderContext,
  type ProviderDefinition,
  type RemoteSnapshot,
  type StorageProvider,
} from '../../sync/StorageProvider';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'gdrive.token';
const LIST_KEY = 'gdrive.list';

interface GoogleConfig {
  clientId: string;
  apiKey: string;
  appId: string;
}

interface SavedToken {
  accessToken: string;
  expiresAt: number;
}

interface ConnectedList {
  fileId: string;
  fileName: string;
  ownerName: string | null;
  ownedByMe: boolean;
}

interface FileMeta {
  id: string;
  name: string;
  version: string;
  owners?: { displayName?: string; me?: boolean }[];
}

export const googleDriveDefinition: ProviderDefinition = {
  id: 'google-drive',
  displayName: 'Google Drive',
  description: 'drive.description',
  unavailableReason() {
    return readConfig() ? null : { key: 'drive.notConfigured' };
  },
  create(context) {
    const config = readConfig();
    if (!config) throw new LocalizedError('drive.notConfigured');
    return new GoogleDriveProvider(context, config);
  },
};

function readConfig(): GoogleConfig | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const appId = import.meta.env.VITE_GOOGLE_APP_ID;
  return clientId && apiKey && appId ? { clientId, apiKey, appId } : null;
}

class GoogleDriveProvider implements StorageProvider {
  readonly id = googleDriveDefinition.id;
  readonly displayName = googleDriveDefinition.displayName;
  readonly capabilities = { share: true };

  private token: SavedToken | null = null;
  private list: ConnectedList | null = null;

  constructor(
    private readonly context: ProviderContext,
    private readonly config: GoogleConfig,
  ) {}

  async init(): Promise<void> {
    this.token = readJson<SavedToken>(await this.context.store.get(TOKEN_KEY));
    this.list = readJson<ConnectedList>(await this.context.store.get(LIST_KEY));
    // Load the sign-in script early, so a later tap can open the sign-in popup at once.
    void loadGoogleIdentity().catch(() => undefined);

    function readJson<T>(raw: string | null): T | null {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
  }

  isConnected(): boolean {
    return this.list !== null;
  }

  describeConnection(): Message | null {
    if (!this.list) return null;
    const file = this.list.fileName;
    if (this.list.ownedByMe) return { key: 'drive.connectionMine', params: { file } };
    if (!this.list.ownerName) return { key: 'drive.connectionSharedUnknown', params: { file } };
    return { key: 'drive.connectionShared', params: { file, owner: this.list.ownerName } };
  }

  async createList(name: string, initial: ListDoc): Promise<void> {
    await this.getToken(true);
    const boundary = `grocery-${crypto.randomUUID()}`;
    const metadata = {
      name: `${name}.json`,
      mimeType: 'application/json',
      appProperties: { groceryApp: 'list' },
    };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(initial)}\r\n--${boundary}--`;
    const file = await this.request<FileMeta>(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,version,owners(displayName,me)`,
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    );
    await this.saveList(file);
  }

  async joinList(): Promise<boolean> {
    const token = await this.getToken(true);
    await loadPicker();
    const picked = await pickFile(this.config, translate(this.context.language(), 'drive.pickerTitle'));
    if (!picked) return false;
    const file = await this.request<FileMeta>(
      `${API}/files/${encodeURIComponent(picked.id)}?fields=id,name,version,owners(displayName,me)`,
    );
    // Check that the file really is a grocery list before connecting to it.
    const content = await this.download(file.id);
    if (content !== null) {
      try {
        parseDoc(content);
      } catch {
        throw new LocalizedError('drive.notAList', { file: file.name });
      }
    }
    await this.saveList(file);
    return true;

    async function loadPicker(): Promise<void> {
      await loadScript('https://apis.google.com/js/api.js');
      await new Promise<void>((resolve, reject) =>
        gapi.load('picker', { callback: resolve, onerror: () => reject(new OfflineError('drive.unreachable')) }),
      );
    }

    function pickFile(config: GoogleConfig, title: string): Promise<google.picker.PickedDoc | null> {
      return new Promise((resolve) => {
        const shared = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setMimeTypes('application/json')
          .setOwnedByMe(false)
          .setMode(google.picker.DocsViewMode.LIST);
        const mine = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setMimeTypes('application/json')
          .setOwnedByMe(true)
          .setMode(google.picker.DocsViewMode.LIST);
        const picker = new google.picker.PickerBuilder()
          .setTitle(title)
          .addView(shared)
          .addView(mine)
          .setAppId(config.appId)
          .setDeveloperKey(config.apiKey)
          .setOAuthToken(token)
          .setCallback((data) => {
            if (data.action === google.picker.Action.PICKED) {
              picker.dispose();
              resolve(data.docs?.[0] ?? null);
            } else if (data.action === google.picker.Action.CANCEL) {
              picker.dispose();
              resolve(null);
            }
          })
          .build();
        picker.setVisible(true);
      });
    }
  }

  async shareList(email: string): Promise<void> {
    const list = this.requireList();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new LocalizedError('drive.invalidEmail');
    await this.getToken(true);
    const message = translate(this.context.language(), 'drive.inviteEmail', {
      url: `${location.origin}${import.meta.env.BASE_URL}`,
      file: list.fileName,
    });
    await this.request(
      `${API}/files/${encodeURIComponent(list.fileId)}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(message)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: address }) },
    );
  }

  async disconnect(): Promise<void> {
    this.list = null;
    await this.context.store.remove(LIST_KEY);
  }

  async resolveUserAction(): Promise<void> {
    this.token = null;
    await this.getToken(true);
  }

  async pull(knownRevision?: string): Promise<RemoteSnapshot | 'unchanged'> {
    const list = this.requireList();
    const meta = await this.request<FileMeta>(`${API}/files/${encodeURIComponent(list.fileId)}?fields=version`);
    if (knownRevision !== undefined && meta.version === knownRevision) return 'unchanged';
    const content = await this.download(list.fileId);
    return { doc: content === null ? null : parseDoc(content), revision: meta.version };
  }

  async push(doc: ListDoc): Promise<{ revision: string }> {
    const list = this.requireList();
    const file = await this.request<FileMeta>(
      `${UPLOAD_API}/files/${encodeURIComponent(list.fileId)}?uploadType=media&fields=version`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) },
    );
    return { revision: file.version };
  }

  private requireList(): ConnectedList {
    if (!this.list) throw new LocalizedError('drive.noList');
    return this.list;
  }

  private async saveList(file: FileMeta): Promise<void> {
    const owner = file.owners?.[0];
    this.list = {
      fileId: file.id,
      fileName: file.name.replace(/\.json$/i, ''),
      ownerName: owner?.displayName ?? null,
      ownedByMe: owner?.me ?? false,
    };
    await this.context.store.set(LIST_KEY, JSON.stringify(this.list));
  }

  /** Returns the parsed file content, or null when the file is empty. */
  private async download(fileId: string): Promise<unknown> {
    const text = await this.request<string>(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {}, 'text');
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new LocalizedError('drive.damaged');
    }
  }

  /** Returns a valid access token. Without `interactive`, an expired token asks the person to sign in again. */
  private async getToken(interactive: boolean): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) return this.token.accessToken;
    if (!interactive) throw new NeedsUserActionError('drive.expired', 'drive.signIn');
    await loadGoogleIdentity();
    const response = await new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.config.clientId,
        scope: SCOPE,
        callback: resolve,
        error_callback: (error) =>
          reject(new LocalizedError(error.type === 'popup_failed_to_open' ? 'drive.popupBlocked' : 'drive.cancelled')),
      });
      client.requestAccessToken({ prompt: '' });
    });
    if (response.error) {
      throw new LocalizedError('drive.signInFailed', { detail: response.error_description ?? response.error });
    }
    if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) throw new LocalizedError('drive.scopeMissing');
    this.token = { accessToken: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 };
    await this.context.store.set(TOKEN_KEY, JSON.stringify(this.token));
    return this.token.accessToken;
  }

  private async request<T>(url: string, init: RequestInit = {}, as: 'json' | 'text' = 'json'): Promise<T> {
    const token = await this.getToken(false);
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        cache: 'no-store',
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new OfflineError();
    }
    if (response.ok) return (as === 'text' ? await response.text() : await response.json()) as T;

    if (response.status === 401) {
      this.token = null;
      await this.context.store.remove(TOKEN_KEY);
      throw new NeedsUserActionError('drive.expired', 'drive.signIn');
    }
    if (response.status === 404) throw new LocalizedError('drive.gone');
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      const detail = await response.text().catch(() => '');
      if (response.status === 403 && !/rateLimit|userRateLimit/i.test(detail)) throw new LocalizedError('drive.refused');
      throw new OfflineError('drive.busy');
    }
    throw new LocalizedError('drive.httpError', { status: response.status });
  }
}

function loadGoogleIdentity(): Promise<void> {
  return loadScript('https://accounts.google.com/gsi/client');
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const element = document.createElement('script');
      element.src = src;
      element.async = true;
      element.onload = () => resolve();
      element.onerror = () => {
        scripts.delete(src);
        element.remove();
        reject(new OfflineError('drive.unreachable'));
      };
      document.head.appendChild(element);
    });
    scripts.set(src, loading);
  }
  return loading;
}
