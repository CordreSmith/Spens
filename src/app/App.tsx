import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  addItem,
  setChecked,
  setDeleted,
  updateItem,
  viewList,
  type Actor,
  type ItemView,
} from '../domain/list';
import {
  errorToMessage,
  LANGUAGE_NAMES,
  LANGUAGES,
  translate,
  type Language,
  type Message,
  type MessageKey,
  type MessageParams,
} from '../i18n/messages';
import type { KeyValueStore } from '../sync/KeyValueStore';
import type { EngineState, SyncEngine } from '../sync/SyncEngine';
import {
  applyTheme,
  resolveLanguage,
  savePreferences,
  type LanguagePreference,
  type Preferences,
  type ThemePreference,
} from './preferences';
import { saveActor } from './profile';

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

interface Translator {
  language: Language;
  t: (key: MessageKey, params?: MessageParams) => string;
  /** Translates a message that came from the sync engine or a provider. */
  tm: (message: Message) => string;
}

const I18n = createContext<Translator>(makeTranslator('af'));

function useT(): Translator {
  return useContext(I18n);
}

function makeTranslator(language: Language): Translator {
  return {
    language,
    t: (key, params) => translate(language, key, params),
    tm: (message) => translate(language, message.key, message.params),
  };
}

export function App({
  engine,
  store,
  initialActor,
  initialPreferences,
  languageRef,
}: {
  engine: SyncEngine;
  store: KeyValueStore;
  initialActor: Actor;
  initialPreferences: Preferences;
  /** Lets non-React code (storage providers) read the current language. */
  languageRef: { current: Language };
}) {
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  const view = useMemo(() => viewList(state.doc), [state.doc]);
  const [actor, setActor] = useState(initialActor);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const deviceLanguages = useDeviceLanguages();
  const language = resolveLanguage(preferences.language, deviceLanguages);
  const translator = useMemo(() => makeTranslator(language), [language]);
  const { t, tm } = translator;
  useAutoSync(engine);

  useEffect(() => {
    languageRef.current = language;
    document.documentElement.lang = language;
  }, [language, languageRef]);

  useEffect(() => applyTheme(preferences.theme), [preferences.theme]);

  useEffect(() => {
    if (preferences !== initialPreferences) void savePreferences(store, preferences);
  }, [preferences, initialPreferences, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), toast.undo ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`item-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const editing = editingId ? [...view.toBuy, ...view.inTrolley].find((i) => i.id === editingId) ?? null : null;

  function showToast(message: string, undo?: () => void) {
    setToast({ id: Date.now(), message, undo });
  }

  function handleAdd(name: string, quantity: string): boolean {
    let result: ReturnType<typeof addItem>;
    try {
      result = addItem(engine.getState().doc, { name, quantity }, actor);
    } catch (error) {
      showToast(tm(errorToMessage(error)));
      return false;
    }
    engine.change(() => result.doc);
    if (result.outcome === 'already-on-list') {
      showToast(t('toast.alreadyOnList', { name: result.doc.items[result.id].name.value }));
    }
    setHighlightId(result.id);
    return true;
  }

  function handleRemove(items: ItemView[], message: string) {
    const ids = items.map((i) => i.id);
    engine.change((doc) => setDeleted(doc, ids, true, actor));
    showToast(message, () => engine.change((doc) => setDeleted(doc, ids, false, actor)));
  }

  async function handleNameChange(name: string) {
    const next = { ...actor, name: name.trim() };
    setActor(next);
    await saveActor(store, next);
  }

  function handlePreferencesChange(patch: Partial<Preferences>) {
    // Functional update: two quick taps must not overwrite each other's change.
    setPreferences((current) => ({ ...current, ...patch }));
  }

  return (
    <I18n.Provider value={translator}>
      <div className="app">
        <header className="topbar">
          <h1>Spens</h1>
          <SyncPill state={state} onClick={() => setSettingsOpen(true)} />
          <button className="icon-button" aria-label={t('app.settings')} onClick={() => setSettingsOpen(true)}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
                transform="translate(-1 0)"
              />
            </svg>
          </button>
        </header>

        {state.status === 'needs-user-action' && (
          <div className="banner banner-warn" role="alert">
            <span>{state.problem && tm(state.problem)}</span>
            <button className="button button-small" onClick={() => void engine.resolveUserAction()}>
              {state.action && t(state.action)}
            </button>
          </div>
        )}
        {state.status === 'not-connected' && (
          <div className="banner">
            <span>{t('banner.localOnly')}</span>
            <button className="button button-small button-quiet" onClick={() => setSettingsOpen(true)}>
              {t('banner.share')}
            </button>
          </div>
        )}

        <AddBar suggestions={view.suggestions} onAdd={handleAdd} />

        <main>
          <section aria-labelledby="to-buy">
            <h2 id="to-buy" className="section-title">
              {t('list.toBuy')} <span className="count">{view.toBuy.length}</span>
            </h2>
            {view.toBuy.length === 0 ? (
              <p className="empty">{t('list.empty')}</p>
            ) : (
              <ul className="items">
                {view.toBuy.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    me={actor.name}
                    highlight={item.id === highlightId}
                    onToggle={() => engine.change((doc) => setChecked(doc, item.id, true, actor))}
                    onEdit={() => setEditingId(item.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {view.inTrolley.length > 0 && (
            <section aria-labelledby="in-trolley" className="trolley">
              <h2 id="in-trolley" className="section-title">
                {t('list.trolley')} <span className="count">{view.inTrolley.length}</span>
              </h2>
              <ul className="items">
                {view.inTrolley.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    me={actor.name}
                    highlight={item.id === highlightId}
                    onToggle={() => engine.change((doc) => setChecked(doc, item.id, false, actor))}
                    onEdit={() => setEditingId(item.id)}
                  />
                ))}
              </ul>
              <button
                className="button button-wide"
                onClick={() =>
                  handleRemove(
                    view.inTrolley,
                    view.inTrolley.length === 1
                      ? t('toast.removedBoughtOne')
                      : t('toast.removedBoughtMany', { count: view.inTrolley.length }),
                  )
                }
              >
                {t('list.doneShopping')}
              </button>
            </section>
          )}
        </main>

        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                className="toast-action"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                {t('toast.undo')}
              </button>
            )}
          </div>
        )}

        <EditSheet
          item={editing}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            if (!editing) return;
            try {
              engine.change((doc) => updateItem(doc, editing.id, patch, actor));
              setEditingId(null);
            } catch (error) {
              showToast(tm(errorToMessage(error)));
            }
          }}
          onRemove={() => {
            if (!editing) return;
            handleRemove([editing], t('toast.removed', { name: editing.name }));
            setEditingId(null);
          }}
        />

        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          engine={engine}
          state={state}
          name={actor.name}
          preferences={preferences}
          onNameChange={handleNameChange}
          onPreferencesChange={handlePreferencesChange}
          onDone={showToast}
        />

        <WelcomeSheet
          open={!actor.name}
          preferences={preferences}
          onPreferencesChange={handlePreferencesChange}
          onSave={handleNameChange}
        />
      </div>
    </I18n.Provider>
  );
}

/** Syncs when the app opens, comes back to the front, goes online, and every 15 s while visible. */
function useAutoSync(engine: SyncEngine) {
  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') void engine.sync();
    };
    syncIfVisible();
    const timer = setInterval(syncIfVisible, 15_000);
    document.addEventListener('visibilitychange', syncIfVisible);
    window.addEventListener('online', syncIfVisible);
    window.addEventListener('focus', syncIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', syncIfVisible);
      window.removeEventListener('online', syncIfVisible);
      window.removeEventListener('focus', syncIfVisible);
    };
  }, [engine]);
}

/** The phone's languages, kept current when the person changes them in the phone settings. */
function useDeviceLanguages(): readonly string[] {
  const [languages, setLanguages] = useState<readonly string[]>(() => readLanguages());
  useEffect(() => {
    const update = () => setLanguages(readLanguages());
    window.addEventListener('languagechange', update);
    return () => window.removeEventListener('languagechange', update);
  }, []);
  return languages;

  function readLanguages(): readonly string[] {
    return navigator.languages?.length ? [...navigator.languages] : [navigator.language];
  }
}

function SyncPill({ state, onClick }: { state: EngineState; onClick: () => void }) {
  const { t, tm } = useT();
  const { label, tone } = describe();
  return (
    <button className={`sync-pill sync-${tone}`} onClick={onClick} title={state.problem ? tm(state.problem) : undefined}>
      <span className="dot" aria-hidden="true" />
      {t(label)}
    </button>
  );

  function describe(): { label: MessageKey; tone: 'ok' | 'busy' | 'warn' | 'off' } {
    switch (state.status) {
      case 'not-connected':
        return { label: 'sync.localOnly', tone: 'off' };
      case 'syncing':
        return { label: 'sync.syncing', tone: 'busy' };
      case 'synced':
        return state.pendingChanges ? { label: 'sync.saving', tone: 'busy' } : { label: 'sync.synced', tone: 'ok' };
      case 'offline':
        return { label: 'sync.offline', tone: 'warn' };
      case 'needs-user-action':
        return { label: 'sync.needsAction', tone: 'warn' };
      case 'error':
        return { label: 'sync.error', tone: 'warn' };
    }
  }
}

function AddBar({ suggestions, onAdd }: { suggestions: string[]; onAdd: (name: string, quantity: string) => boolean }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (onAdd(name, quantity)) {
      setName('');
      setQuantity('');
    }
    nameRef.current?.focus();
  }

  return (
    <form className="add-bar" onSubmit={submit}>
      <input
        ref={nameRef}
        className="input add-name"
        placeholder={t('add.placeholder')}
        aria-label={t('add.nameLabel')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        list="suggestions"
        autoComplete="off"
        enterKeyHint="done"
      />
      <input
        className="input add-qty"
        placeholder={t('add.quantityPlaceholder')}
        aria-label={t('add.quantityLabel')}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        autoComplete="off"
        enterKeyHint="done"
      />
      <button className="button button-primary add-button" type="submit" aria-label={t('add.buttonLabel')} disabled={!name.trim()}>
        {t('add.button')}
      </button>
      <datalist id="suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </form>
  );
}

function ItemRow({
  item,
  me,
  highlight,
  onToggle,
  onEdit,
}: {
  item: ItemView;
  me: string;
  highlight: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { t } = useT();
  const byOther = item.addedBy && item.addedBy !== me;
  return (
    <li id={`item-${item.id}`} className={`item${item.checked ? ' item-checked' : ''}${highlight ? ' item-highlight' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={t(item.checked ? 'item.uncheck' : 'item.check', { name: item.name })}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="item-body" onClick={onEdit} aria-label={t('item.edit', { name: item.name })}>
        <span className="item-line">
          <span className="item-name">{item.name}</span>
          {item.quantity && <span className="qty">{item.quantity}</span>}
        </span>
        {(item.note || byOther) && (
          <span className="item-meta">
            {item.note}
            {item.note && byOther && ' · '}
            {byOther && t('item.addedBy', { name: item.addedBy })}
          </span>
        )}
      </button>
    </li>
  );
}

function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <div className="sheet-header">
          <h2>{title}</h2>
          {dismissible && (
            <button className="icon-button" aria-label={t('sheet.close')} onClick={onClose}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** A row of buttons where exactly one is selected. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LanguageChoice({ value, onChange }: { value: LanguagePreference; onChange: (value: LanguagePreference) => void }) {
  const { t } = useT();
  return (
    <Segmented<LanguagePreference>
      label={t('settings.language')}
      value={value}
      options={[
        ...LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAMES[language] })),
        { value: 'device', label: t('settings.followDevice') },
      ]}
      onChange={onChange}
    />
  );
}

function EditSheet({
  item,
  onClose,
  onSave,
  onRemove,
}: {
  item: ItemView | null;
  onClose: () => void;
  onSave: (patch: { name: string; quantity: string; note: string }) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet open={item !== null} onClose={onClose} title={t('edit.title')}>
      {item && (
        <form
          key={item.id}
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onSave({
              name: String(data.get('name') ?? ''),
              quantity: String(data.get('quantity') ?? ''),
              note: String(data.get('note') ?? ''),
            });
          }}
        >
          <label className="field">
            <span>{t('edit.name')}</span>
            <input className="input" name="name" defaultValue={item.name} required autoComplete="off" />
          </label>
          <label className="field">
            <span>{t('edit.quantity')}</span>
            <input className="input" name="quantity" defaultValue={item.quantity} placeholder={t('edit.quantityPlaceholder')} autoComplete="off" />
          </label>
          <label className="field">
            <span>{t('edit.note')}</span>
            <input className="input" name="note" defaultValue={item.note} placeholder={t('edit.notePlaceholder')} autoComplete="off" />
          </label>
          {item.addedBy && <p className="hint">{t('edit.addedBy', { name: item.addedBy })}</p>}
          <div className="row">
            <button type="button" className="button button-danger" onClick={onRemove}>
              {t('edit.remove')}
            </button>
            <button type="submit" className="button button-primary">
              {t('edit.save')}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function WelcomeSheet({
  open,
  preferences,
  onPreferencesChange,
  onSave,
}: {
  open: boolean;
  preferences: Preferences;
  onPreferencesChange: (patch: Partial<Preferences>) => void;
  onSave: (name: string) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  return (
    <Sheet open={open} onClose={() => undefined} title={t('welcome.title')} dismissible={false}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name);
        }}
      >
        <LanguageChoice value={preferences.language} onChange={(language) => onPreferencesChange({ language })} />
        <p>{t('welcome.text')}</p>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('welcome.placeholder')}
          autoFocus
          autoComplete="given-name"
        />
        <button type="submit" className="button button-primary" disabled={!name.trim()}>
          {t('welcome.start')}
        </button>
      </form>
    </Sheet>
  );
}

function SettingsSheet({
  open,
  onClose,
  engine,
  state,
  name,
  preferences,
  onNameChange,
  onPreferencesChange,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  engine: SyncEngine;
  state: EngineState;
  name: string;
  preferences: Preferences;
  onNameChange: (name: string) => void;
  onPreferencesChange: (patch: Partial<Preferences>) => void;
  onDone: (message: string) => void;
}) {
  const { t, tm, language } = useT();
  const available = engine.definitions.filter((d) => !d.unavailableReason());
  const [providerId, setProviderId] = useState(available[0]?.id ?? engine.definitions[0]?.id ?? '');
  /** null until the person types, so the default name follows the language. */
  const [listName, setListName] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const definition = engine.definitions.find((d) => d.id === providerId);
  const unavailable = definition?.unavailableReason() ?? null;
  const connection = state.connection;
  const shownListName = listName ?? t('settings.defaultListName');

  /** Runs an action that may open Google's own UI. That UI must not sit under this modal sheet. */
  async function run(action: () => Promise<string | null>, closeFirst: boolean) {
    setError(null);
    setBusy(true);
    if (closeFirst) onClose();
    try {
      const message = await action();
      if (message) onDone(message);
    } catch (e) {
      const message = tm(errorToMessage(e));
      if (closeFirst) onDone(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <div className="stack">
        <label className="field">
          <span>{t('settings.name')}</span>
          <input
            className="input"
            defaultValue={name}
            key={name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== name && onNameChange(e.target.value)}
            autoComplete="given-name"
          />
        </label>

        <LanguageChoice value={preferences.language} onChange={(value) => onPreferencesChange({ language: value })} />
        <Segmented<ThemePreference>
          label={t('settings.theme')}
          value={preferences.theme}
          options={[
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'device', label: t('settings.followDevice') },
          ]}
          onChange={(value) => onPreferencesChange({ theme: value })}
        />

        <h3>{t('settings.sharedList')}</h3>
        {connection ? (
          <>
            <div className="card">
              <strong>{connection.label ? tm(connection.label) : connection.providerName}</strong>
              <span className="hint">{statusLine()}</span>
            </div>
            <button className="button" disabled={busy} onClick={() => void engine.sync()}>
              {t('settings.syncNow')}
            </button>
            {connection.canShare && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await engine.shareList(email);
                    setEmail('');
                    return t('settings.inviteSent', { email: email.trim() });
                  }, false);
                }}
              >
                <label className="field">
                  <span>{t('settings.shareWith')}</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('settings.emailPlaceholder')}
                    autoComplete="email"
                  />
                </label>
                <button className="button button-primary" type="submit" disabled={busy || !email.trim()}>
                  {t('settings.sendInvite')}
                </button>
              </form>
            )}
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void run(async () => (await engine.disconnect(), t('settings.disconnected')), false)}
            >
              {t('settings.disconnect')}
            </button>
          </>
        ) : (
          <>
            <p className="hint">{t('settings.localOnlyHint')}</p>
            {engine.definitions.length > 1 && (
              <div className="choices" role="radiogroup" aria-label={t('settings.storage')}>
                {engine.definitions.map((d) => (
                  <label key={d.id} className="choice">
                    <input type="radio" name="provider" checked={providerId === d.id} onChange={() => setProviderId(d.id)} />
                    {d.displayName}
                  </label>
                ))}
              </div>
            )}
            {definition && (
              <div className="card">
                <strong>{definition.displayName}</strong>
                <span className="hint">{t(definition.description)}</span>
              </div>
            )}
            {unavailable ? (
              <p className="error">{tm(unavailable)}</p>
            ) : (
              <>
                <label className="field">
                  <span>{t('settings.newListName')}</span>
                  <input className="input" value={shownListName} onChange={(e) => setListName(e.target.value)} />
                </label>
                <button
                  className="button button-primary"
                  disabled={busy || !shownListName.trim()}
                  onClick={() =>
                    void run(async () => {
                      await engine.createList(providerId, shownListName.trim());
                      return t('settings.created');
                    }, true)
                  }
                >
                  {t('settings.create')}
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => ((await engine.joinList(providerId)) ? t('settings.joined') : null), true)
                  }
                >
                  {t('settings.join')}
                </button>
              </>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        <p className="hint small">{t('settings.privacy')}</p>
      </div>
    </Sheet>
  );

  function statusLine(): string {
    if (state.problem && state.status !== 'synced' && state.status !== 'syncing') return tm(state.problem);
    if (state.status === 'syncing') return t('sync.syncing');
    return state.lastSyncedAt ? t('settings.lastSynced', { when: timeAgo(state.lastSyncedAt) }) : t('settings.notSynced');

    function timeAgo(at: number): string {
      const seconds = Math.round((Date.now() - at) / 1000);
      if (seconds < 60) return t('time.justNow');
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return t('time.minutesAgo', { count: minutes });
      return new Date(at).toLocaleString(language === 'af' ? 'af-ZA' : 'en-ZA');
    }
  }
}
