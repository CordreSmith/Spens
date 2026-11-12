import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import {
  addItem,
  setChecked,
  setDeleted,
  updateItem,
  viewList,
  type Actor,
  type ItemView,
} from '../domain/list';
import type { KeyValueStore } from '../sync/KeyValueStore';
import type { EngineState, SyncEngine } from '../sync/SyncEngine';
import { saveActor } from './profile';

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export function App({ engine, store, initialActor }: { engine: SyncEngine; store: KeyValueStore; initialActor: Actor }) {
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  const view = useMemo(() => viewList(state.doc), [state.doc]);
  const [actor, setActor] = useState(initialActor);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useAutoSync(engine);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.undo ? 6000 : 3000);
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
      showToast(error instanceof Error ? error.message : String(error));
      return false;
    }
    engine.change(() => result.doc);
    if (result.outcome === 'already-on-list') {
      showToast(`${result.doc.items[result.id].name.value} is already on the list`);
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

  return (
    <div className="app">
      <header className="topbar">
        <h1>Groceries</h1>
        <SyncPill state={state} onClick={() => setSettingsOpen(true)} />
        <button className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
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
          <span>{state.message}</span>
          <button className="button button-small" onClick={() => void engine.resolveUserAction()}>
            {state.actionLabel}
          </button>
        </div>
      )}
      {state.status === 'not-connected' && (
        <div className="banner">
          <span>This list is only on this phone.</span>
          <button className="button button-small button-quiet" onClick={() => setSettingsOpen(true)}>
            Share it
          </button>
        </div>
      )}

      <AddBar suggestions={view.suggestions} onAdd={handleAdd} />

      <main>
        <section aria-labelledby="to-buy">
          <h2 id="to-buy" className="section-title">
            To buy <span className="count">{view.toBuy.length}</span>
          </h2>
          {view.toBuy.length === 0 ? (
            <p className="empty">Nothing to buy. Add an item above.</p>
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
              In the trolley <span className="count">{view.inTrolley.length}</span>
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
                  `Removed ${view.inTrolley.length} bought ${view.inTrolley.length === 1 ? 'item' : 'items'}`,
                )
              }
            >
              Done shopping · remove bought items
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
              Undo
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
            showToast(error instanceof Error ? error.message : String(error));
          }
        }}
        onRemove={() => {
          if (!editing) return;
          handleRemove([editing], `Removed ${editing.name}`);
          setEditingId(null);
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        engine={engine}
        state={state}
        name={actor.name}
        onNameChange={handleNameChange}
        onDone={showToast}
      />

      <WelcomeSheet open={!actor.name} onSave={handleNameChange} />
    </div>
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

function SyncPill({ state, onClick }: { state: EngineState; onClick: () => void }) {
  const { label, tone } = describe();
  return (
    <button className={`sync-pill sync-${tone}`} onClick={onClick} title={state.message ?? undefined}>
      <span className="dot" aria-hidden="true" />
      {label}
    </button>
  );

  function describe(): { label: string; tone: 'ok' | 'busy' | 'warn' | 'off' } {
    switch (state.status) {
      case 'not-connected':
        return { label: 'This phone only', tone: 'off' };
      case 'syncing':
        return { label: 'Syncing…', tone: 'busy' };
      case 'synced':
        return state.pendingChanges ? { label: 'Saving…', tone: 'busy' } : { label: 'Synced', tone: 'ok' };
      case 'offline':
        return { label: 'Offline', tone: 'warn' };
      case 'needs-user-action':
        return { label: 'Sign-in needed', tone: 'warn' };
      case 'error':
        return { label: 'Sync problem', tone: 'warn' };
    }
  }
}

function AddBar({ suggestions, onAdd }: { suggestions: string[]; onAdd: (name: string, quantity: string) => boolean }) {
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
        placeholder="Add an item…"
        aria-label="Item name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        list="suggestions"
        autoComplete="off"
        enterKeyHint="done"
      />
      <input
        className="input add-qty"
        placeholder="Qty"
        aria-label="Quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        autoComplete="off"
        enterKeyHint="done"
      />
      <button className="button button-primary add-button" type="submit" aria-label="Add item" disabled={!name.trim()}>
        Add
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
  const byOther = item.addedBy && item.addedBy !== me;
  return (
    <li id={`item-${item.id}`} className={`item${item.checked ? ' item-checked' : ''}${highlight ? ' item-highlight' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.checked ? `Put ${item.name} back on the list` : `Mark ${item.name} as in the trolley`}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="item-body" onClick={onEdit} aria-label={`Edit ${item.name}`}>
        <span className="item-line">
          <span className="item-name">{item.name}</span>
          {item.quantity && <span className="qty">{item.quantity}</span>}
        </span>
        {(item.note || byOther) && (
          <span className="item-meta">
            {item.note}
            {item.note && byOther && ' · '}
            {byOther && `added by ${item.addedBy}`}
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
            <button className="icon-button" aria-label="Close" onClick={onClose}>
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
  return (
    <Sheet open={item !== null} onClose={onClose} title="Edit item">
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
            <span>Item</span>
            <input className="input" name="name" defaultValue={item.name} required autoComplete="off" />
          </label>
          <label className="field">
            <span>Quantity</span>
            <input className="input" name="quantity" defaultValue={item.quantity} placeholder="For example 2, 1 kg, a big one" autoComplete="off" />
          </label>
          <label className="field">
            <span>Note</span>
            <input className="input" name="note" defaultValue={item.note} placeholder="For example the low-fat one" autoComplete="off" />
          </label>
          {item.addedBy && <p className="hint">Added by {item.addedBy}</p>}
          <div className="row">
            <button type="button" className="button button-danger" onClick={onRemove}>
              Remove
            </button>
            <button type="submit" className="button button-primary">
              Save
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function WelcomeSheet({ open, onSave }: { open: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Sheet open={open} onClose={() => undefined} title="Welcome" dismissible={false}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name);
        }}
      >
        <p>What is your name? The list shows it next to the items you add.</p>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus autoComplete="given-name" />
        <button type="submit" className="button button-primary" disabled={!name.trim()}>
          Start
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
  onNameChange,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  engine: SyncEngine;
  state: EngineState;
  name: string;
  onNameChange: (name: string) => void;
  onDone: (message: string) => void;
}) {
  const available = engine.definitions.filter((d) => !d.unavailableReason());
  const [providerId, setProviderId] = useState(available[0]?.id ?? engine.definitions[0]?.id ?? '');
  const [listName, setListName] = useState('Grocery list');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const definition = engine.definitions.find((d) => d.id === providerId);
  const unavailable = definition?.unavailableReason() ?? null;
  const connection = state.connection;

  /** Runs an action that may open Google's own UI. That UI must not sit under this modal sheet. */
  async function run(action: () => Promise<string | null>, closeFirst: boolean) {
    setError(null);
    setBusy(true);
    if (closeFirst) onClose();
    try {
      const message = await action();
      if (message) onDone(message);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (closeFirst) onDone(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="stack">
        <label className="field">
          <span>Your name</span>
          <input
            className="input"
            defaultValue={name}
            key={name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== name && onNameChange(e.target.value)}
            autoComplete="given-name"
          />
        </label>

        <h3>Shared list</h3>
        {connection ? (
          <>
            <div className="card">
              <strong>{connection.label ?? connection.providerName}</strong>
              <span className="hint">{statusLine(state)}</span>
            </div>
            <button className="button" disabled={busy} onClick={() => void engine.sync()}>
              Sync now
            </button>
            {connection.canShare && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await engine.shareList(email);
                    setEmail('');
                    return `Invite sent to ${email.trim()}`;
                  }, false);
                }}
              >
                <label className="field">
                  <span>Share with (Google account email)</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" autoComplete="email" />
                </label>
                <button className="button button-primary" type="submit" disabled={busy || !email.trim()}>
                  Send invite
                </button>
              </form>
            )}
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void run(async () => (await engine.disconnect(), 'Stopped syncing on this phone'), false)}
            >
              Stop syncing on this phone
            </button>
          </>
        ) : (
          <>
            <p className="hint">The list is only on this phone. Connect it to shared storage so your household sees the same list.</p>
            {engine.definitions.length > 1 && (
              <div className="choices" role="radiogroup" aria-label="Storage">
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
                <span className="hint">{definition.description}</span>
              </div>
            )}
            {unavailable ? (
              <p className="error">{unavailable}</p>
            ) : (
              <>
                <label className="field">
                  <span>New list name</span>
                  <input className="input" value={listName} onChange={(e) => setListName(e.target.value)} />
                </label>
                <button
                  className="button button-primary"
                  disabled={busy || !listName.trim()}
                  onClick={() =>
                    void run(async () => {
                      await engine.createList(providerId, listName.trim());
                      return 'Shared list created. Open Settings to invite someone.';
                    }, true)
                  }
                >
                  Create a new shared list
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => ((await engine.joinList(providerId)) ? 'Joined the shared list' : null), true)
                  }
                >
                  Join a list shared with me
                </button>
              </>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        <p className="hint small">
          Your list is kept on this phone and in the storage you connect. The app sends it nowhere else.
        </p>
      </div>
    </Sheet>
  );

  function statusLine(s: EngineState): string {
    if (s.message && s.status !== 'synced' && s.status !== 'syncing') return s.message;
    if (s.status === 'syncing') return 'Syncing…';
    return s.lastSyncedAt ? `Last synced ${timeAgo(s.lastSyncedAt)}` : 'Not synced yet';

    function timeAgo(at: number): string {
      const seconds = Math.round((Date.now() - at) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return `${minutes} min ago`;
      return new Date(at).toLocaleString();
    }
  }
}
