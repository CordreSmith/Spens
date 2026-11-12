/**
 * The shared grocery list document and every operation on it.
 *
 * The document is a state-based CRDT: each field of each item carries its own
 * last-writer-wins stamp. Two copies of the list can be edited independently
 * (two phones, offline) and `mergeDocs` always produces the same result no matter
 * the order the copies are merged in. Storage providers therefore only have to
 * store and return one JSON blob; they never need to resolve conflicts.
 *
 * Items are never hard-deleted. A removed item keeps `deleted: true` and doubles
 * as purchase history (it feeds the add-item suggestions and is revived when the
 * same name is added again). A household's distinct grocery items stay in the
 * hundreds, so the document stays small.
 */

export const SCHEMA_VERSION = 1;

export interface ItemFields {
  name: string;
  quantity: string;
  note: string;
  checked: boolean;
  deleted: boolean;
  addedBy: string;
  addedAt: number;
}

export type FieldName = keyof ItemFields;

export const FIELD_NAMES: readonly FieldName[] = [
  'name',
  'quantity',
  'note',
  'checked',
  'deleted',
  'addedBy',
  'addedAt',
];

/** A value plus the time and device of its last write. */
export interface Stamped<T> {
  value: T;
  at: number;
  by: string;
}

export type GroceryItem = { id: string } & { [K in FieldName]: Stamped<ItemFields[K]> };

export interface ListDoc {
  schema: typeof SCHEMA_VERSION;
  items: Record<string, GroceryItem>;
}

/** Who makes a change: a stable per-install device id plus the person's display name. */
export interface Actor {
  deviceId: string;
  name: string;
}

export interface ItemView {
  id: string;
  name: string;
  quantity: string;
  note: string;
  checked: boolean;
  addedBy: string;
  addedAt: number;
}

export interface ListView {
  toBuy: ItemView[];
  inTrolley: ItemView[];
  /** Names of items bought or removed before, most recent first. */
  suggestions: string[];
}

export type AddOutcome = 'added' | 'readded' | 'already-on-list';

export class UnsupportedSchemaError extends Error {
  constructor(readonly schema: number) {
    super(`This list was saved by a newer version of the app (format ${schema}). Update the app to open it.`);
    this.name = 'UnsupportedSchemaError';
  }
}

export function emptyDoc(): ListDoc {
  return { schema: SCHEMA_VERSION, items: {} };
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function addItem(
  doc: ListDoc,
  input: { name: string; quantity?: string; note?: string },
  actor: Actor,
  now: number = Date.now(),
): { doc: ListDoc; id: string; outcome: AddOutcome } {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('An item needs a name.');
  const key = normalizeName(name);
  const quantity = (input.quantity ?? '').trim();

  const existing = Object.values(doc.items).find((item) => normalizeName(item.name.value) === key);

  if (existing && !existing.deleted.value && !existing.checked.value) {
    return { doc, id: existing.id, outcome: 'already-on-list' };
  }

  if (existing) {
    // Bought or removed before: bring the same item back so its history and note carry over.
    const patch: Partial<ItemFields> = {
      name,
      quantity,
      checked: false,
      deleted: false,
      addedBy: actor.name,
      addedAt: now,
    };
    if (input.note !== undefined) patch.note = input.note.trim();
    return { doc: writeFields(doc, existing.id, patch, actor, now), id: existing.id, outcome: 'readded' };
  }

  // Deterministic id: two phones adding "Milk" while offline end up with one item.
  const id = doc.items[key] ? `${key}~${randomSuffix()}` : key;
  const stamp = <T,>(value: T): Stamped<T> => ({ value, at: now, by: actor.deviceId });
  const item: GroceryItem = {
    id,
    name: stamp(name),
    quantity: stamp(quantity),
    note: stamp((input.note ?? '').trim()),
    checked: stamp(false),
    deleted: stamp(false),
    addedBy: stamp(actor.name),
    addedAt: stamp(now),
  };
  return { doc: { ...doc, items: { ...doc.items, [id]: item } }, id, outcome: 'added' };

  function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 8);
  }
}

export function updateItem(
  doc: ListDoc,
  id: string,
  patch: Partial<Pick<ItemFields, 'name' | 'quantity' | 'note'>>,
  actor: Actor,
  now: number = Date.now(),
): ListDoc {
  const clean: Partial<ItemFields> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('An item needs a name.');
    clean.name = name;
  }
  if (patch.quantity !== undefined) clean.quantity = patch.quantity.trim();
  if (patch.note !== undefined) clean.note = patch.note.trim();
  return writeFields(doc, id, clean, actor, now);
}

export function setChecked(doc: ListDoc, id: string, checked: boolean, actor: Actor, now: number = Date.now()): ListDoc {
  return writeFields(doc, id, { checked }, actor, now);
}

/** Removes items from the list (deleted = true) or restores them (deleted = false, for undo). */
export function setDeleted(
  doc: ListDoc,
  ids: readonly string[],
  deleted: boolean,
  actor: Actor,
  now: number = Date.now(),
): ListDoc {
  return ids.reduce((current, id) => writeFields(current, id, { deleted }, actor, now), doc);
}

/** Merges two copies of the list. Commutative, associative and idempotent. */
export function mergeDocs(a: ListDoc, b: ListDoc): ListDoc {
  const items: Record<string, GroceryItem> = { ...a.items };
  for (const [id, theirs] of Object.entries(b.items)) {
    const ours = items[id];
    items[id] = ours ? mergeItem(ours, theirs) : theirs;
  }
  return { schema: SCHEMA_VERSION, items };

  function mergeItem(x: GroceryItem, y: GroceryItem): GroceryItem {
    const merged = { id: x.id } as GroceryItem;
    for (const field of FIELD_NAMES) {
      (merged as Record<FieldName, Stamped<unknown>>)[field] = isNewer(y[field], x[field]) ? y[field] : x[field];
    }
    return merged;
  }

  function isNewer(candidate: Stamped<unknown>, current: Stamped<unknown>): boolean {
    if (candidate.at !== current.at) return candidate.at > current.at;
    return candidate.by > current.by;
  }
}

export function docsEqual(a: ListDoc, b: ListDoc): boolean {
  const aIds = Object.keys(a.items);
  if (aIds.length !== Object.keys(b.items).length) return false;
  return aIds.every((id) => {
    const x = a.items[id];
    const y = b.items[id];
    return (
      y !== undefined &&
      FIELD_NAMES.every((f) => x[f].at === y[f].at && x[f].by === y[f].by && x[f].value === y[f].value)
    );
  });
}

export function viewList(doc: ListDoc): ListView {
  const live = Object.values(doc.items).filter((item) => !item.deleted.value);
  const toBuy = live
    .filter((item) => !item.checked.value)
    .sort((x, y) => x.addedAt.value - y.addedAt.value)
    .map(toView);
  const inTrolley = live
    .filter((item) => item.checked.value)
    .sort((x, y) => y.checked.at - x.checked.at)
    .map(toView);

  const seen = new Set(live.map((item) => normalizeName(item.name.value)));
  const suggestions: string[] = [];
  for (const item of Object.values(doc.items)
    .filter((i) => i.deleted.value)
    .sort((x, y) => y.deleted.at - x.deleted.at)) {
    const key = normalizeName(item.name.value);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(item.name.value);
  }
  return { toBuy, inTrolley, suggestions };

  function toView(item: GroceryItem): ItemView {
    return {
      id: item.id,
      name: item.name.value,
      quantity: item.quantity.value,
      note: item.note.value,
      checked: item.checked.value,
      addedBy: item.addedBy.value,
      addedAt: item.addedAt.value,
    };
  }
}

/**
 * Validates a document read from storage. Malformed items are dropped instead of
 * failing the whole list, so one bad write can't lock both phones out.
 */
export function parseDoc(raw: unknown): ListDoc {
  if (!isRecord(raw)) throw new Error('The stored list is not a valid grocery list.');
  if (typeof raw.schema === 'number' && raw.schema > SCHEMA_VERSION) throw new UnsupportedSchemaError(raw.schema);
  if (raw.schema !== SCHEMA_VERSION || !isRecord(raw.items)) {
    throw new Error('The stored list is not a valid grocery list.');
  }
  const items: Record<string, GroceryItem> = {};
  for (const [id, value] of Object.entries(raw.items)) {
    if (isValidItem(id, value)) items[id] = value;
  }
  return { schema: SCHEMA_VERSION, items };

  function isValidItem(id: string, value: unknown): value is GroceryItem {
    if (!isRecord(value) || value.id !== id) return false;
    const expected: Record<FieldName, string> = {
      name: 'string',
      quantity: 'string',
      note: 'string',
      checked: 'boolean',
      deleted: 'boolean',
      addedBy: 'string',
      addedAt: 'number',
    };
    return FIELD_NAMES.every((field) => {
      const stamp = value[field];
      return (
        isRecord(stamp) &&
        typeof stamp.value === expected[field] &&
        typeof stamp.at === 'number' &&
        typeof stamp.by === 'string'
      );
    });
  }

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }
}

/** Writes changed fields with fresh stamps. Stamps only move forward, even if the device clock jumps back. */
function writeFields(doc: ListDoc, id: string, patch: Partial<ItemFields>, actor: Actor, now: number): ListDoc {
  const item = doc.items[id];
  if (!item) return doc;
  let next: GroceryItem | null = null;
  for (const field of FIELD_NAMES) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === undefined || item[field].value === value) continue;
    next ??= { ...item };
    (next as Record<FieldName, Stamped<unknown>>)[field] = {
      value,
      at: Math.max(now, item[field].at + 1),
      by: actor.deviceId,
    };
  }
  return next ? { ...doc, items: { ...doc.items, [id]: next } } : doc;
}
