import { describe, expect, it } from 'vitest';
import {
  addItem,
  docsEqual,
  emptyDoc,
  mergeDocs,
  parseDoc,
  setChecked,
  setDeleted,
  UnsupportedSchemaError,
  updateItem,
  viewList,
  type ListDoc,
} from './list';

const me = { deviceId: 'device-a', name: 'Cordre' };
const wife = { deviceId: 'device-b', name: 'Wife' };

function names(doc: ListDoc) {
  const view = viewList(doc);
  return { toBuy: view.toBuy.map((i) => i.name), inTrolley: view.inTrolley.map((i) => i.name) };
}

describe('adding items', () => {
  it('adds an item and keeps the order it was added in', () => {
    let doc = addItem(emptyDoc(), { name: 'Milk', quantity: '2L' }, me, 1).doc;
    doc = addItem(doc, { name: 'Bread' }, wife, 2).doc;
    expect(names(doc).toBuy).toEqual(['Milk', 'Bread']);
    expect(viewList(doc).toBuy[0]).toMatchObject({ quantity: '2L', addedBy: 'Cordre' });
  });

  it('reports a duplicate instead of adding it twice, ignoring case and spaces', () => {
    const first = addItem(emptyDoc(), { name: 'Milk' }, me, 1);
    const second = addItem(first.doc, { name: '  milk ' }, wife, 2);
    expect(second.outcome).toBe('already-on-list');
    expect(second.doc).toBe(first.doc);
  });

  it('brings back a bought item with its note when it is added again', () => {
    let { doc, id } = addItem(emptyDoc(), { name: 'Yoghurt', note: 'the low-fat one' }, me, 1);
    doc = setChecked(doc, id, true, me, 2);
    doc = setDeleted(doc, [id], true, me, 3);
    const again = addItem(doc, { name: 'yoghurt', quantity: '6' }, wife, 4);
    expect(again.outcome).toBe('readded');
    expect(again.id).toBe(id);
    expect(viewList(again.doc).toBuy[0]).toMatchObject({
      name: 'yoghurt',
      quantity: '6',
      note: 'the low-fat one',
      addedBy: 'Wife',
      checked: false,
    });
  });

  it('rejects an empty name', () => {
    expect(() => addItem(emptyDoc(), { name: '   ' }, me)).toThrow();
  });
});

describe('view', () => {
  it('splits the list into to-buy and trolley, and suggests removed items', () => {
    let doc = emptyDoc();
    const milk = addItem(doc, { name: 'Milk' }, me, 1);
    doc = milk.doc;
    const eggs = addItem(doc, { name: 'Eggs' }, me, 2);
    doc = eggs.doc;
    const tea = addItem(doc, { name: 'Tea' }, me, 3);
    doc = setChecked(tea.doc, eggs.id, true, me, 4);
    doc = setDeleted(doc, [tea.id], true, me, 5);
    expect(names(doc)).toEqual({ toBuy: ['Milk'], inTrolley: ['Eggs'] });
    expect(viewList(doc).suggestions).toEqual(['Tea']);
  });
});

describe('merging two phones', () => {
  it('keeps items both phones added while offline', () => {
    const base = addItem(emptyDoc(), { name: 'Milk' }, me, 1).doc;
    const mine = addItem(base, { name: 'Bread' }, me, 10).doc;
    const hers = addItem(base, { name: 'Eggs' }, wife, 11).doc;
    expect(names(mergeDocs(mine, hers)).toBuy).toEqual(['Milk', 'Bread', 'Eggs']);
  });

  it('turns the same item added on both phones into one item', () => {
    const mine = addItem(emptyDoc(), { name: 'Milk', quantity: '1L' }, me, 10).doc;
    const hers = addItem(emptyDoc(), { name: 'milk', quantity: '2L' }, wife, 12).doc;
    const merged = mergeDocs(mine, hers);
    expect(viewList(merged).toBuy).toHaveLength(1);
    expect(viewList(merged).toBuy[0].quantity).toBe('2L');
  });

  it('keeps edits to different fields of the same item from both phones', () => {
    const { doc: base, id } = addItem(emptyDoc(), { name: 'Coffee' }, me, 1);
    const mine = setChecked(base, id, true, me, 10);
    const hers = updateItem(base, id, { quantity: '2 bags' }, wife, 11);
    const merged = mergeDocs(mine, hers);
    expect(viewList(merged).inTrolley[0]).toMatchObject({ name: 'Coffee', quantity: '2 bags' });
  });

  it('lets the latest edit of the same field win', () => {
    const { doc: base, id } = addItem(emptyDoc(), { name: 'Rice' }, me, 1);
    const mine = updateItem(base, id, { quantity: '1kg' }, me, 10);
    const hers = updateItem(base, id, { quantity: '5kg' }, wife, 20);
    expect(viewList(mergeDocs(mine, hers)).toBuy[0].quantity).toBe('5kg');
    expect(viewList(mergeDocs(hers, mine)).toBuy[0].quantity).toBe('5kg');
  });

  it('gives the same result in any merge order, and merging twice changes nothing', () => {
    const { doc: base, id } = addItem(emptyDoc(), { name: 'Apples' }, me, 1);
    const a = setDeleted(addItem(base, { name: 'Pears' }, me, 5).doc, [id], true, me, 6);
    const b = updateItem(addItem(base, { name: 'Plums' }, wife, 5).doc, id, { note: 'green' }, wife, 6);
    const c = setChecked(base, id, true, { deviceId: 'device-c', name: 'Kid' }, 6);
    const abc = mergeDocs(mergeDocs(a, b), c);
    const cba = mergeDocs(c, mergeDocs(b, a));
    expect(docsEqual(abc, cba)).toBe(true);
    expect(docsEqual(mergeDocs(abc, abc), abc)).toBe(true);
  });

  it('never moves a stamp backwards when the phone clock is behind', () => {
    const { doc, id } = addItem(emptyDoc(), { name: 'Salt' }, me, 1000);
    const edited = updateItem(doc, id, { quantity: '1' }, wife, 5);
    expect(edited.items[id].quantity.at).toBeGreaterThan(doc.items[id].quantity.at);
  });
});

describe('parsing stored lists', () => {
  it('round-trips through JSON', () => {
    const doc = addItem(emptyDoc(), { name: 'Milk' }, me, 1).doc;
    expect(docsEqual(parseDoc(JSON.parse(JSON.stringify(doc))), doc)).toBe(true);
  });

  it('drops malformed items but keeps the rest', () => {
    const doc = addItem(emptyDoc(), { name: 'Milk' }, me, 1).doc;
    const raw = JSON.parse(JSON.stringify(doc));
    raw.items.broken = { id: 'broken', name: 'no stamps' };
    expect(Object.keys(parseDoc(raw).items)).toEqual(['milk']);
  });

  it('refuses a list from a newer app version', () => {
    expect(() => parseDoc({ schema: 99, items: {} })).toThrow(UnsupportedSchemaError);
  });

  it('rejects data that is not a list', () => {
    expect(() => parseDoc([1, 2])).toThrow();
    expect(() => parseDoc({ schema: 1 })).toThrow();
  });
});
