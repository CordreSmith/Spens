/** The small part of Google Identity Services and Google Picker that the Drive provider uses. */

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  }
  interface ClientConfigError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
    message?: string;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: '' | 'none' | 'consent' | 'select_account'; login_hint?: string }): void;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: ClientConfigError) => void;
  }): TokenClient;
  function hasGrantedAllScopes(response: TokenResponse, scope: string): boolean;
}

declare namespace google.picker {
  enum ViewId {
    DOCS = 'all',
  }
  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }
  interface PickedDoc {
    id: string;
    name: string;
  }
  interface ResponseObject {
    action: string;
    docs?: PickedDoc[];
  }
  class DocsView {
    constructor(viewId?: ViewId);
    setMimeTypes(mimeTypes: string): DocsView;
    setOwnedByMe(ownedByMe: boolean): DocsView;
    setMode(mode: DocsViewMode): DocsView;
  }
  enum DocsViewMode {
    LIST = 'list',
  }
  interface Picker {
    setVisible(visible: boolean): Picker;
    dispose(): void;
  }
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }
}

declare namespace gapi {
  function load(api: string, options: { callback: () => void; onerror?: () => void }): void;
}
