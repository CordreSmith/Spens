import { describe, expect, it } from 'vitest';
import { LANGUAGES, MESSAGE_KEYS, translate } from '../i18n/messages';
import { memoryStore } from '../sync/KeyValueStore';
import { DEFAULT_PREFERENCES, loadPreferences, resolveLanguage, savePreferences } from './preferences';

describe('language preference', () => {
  it('uses the picked language', () => {
    expect(resolveLanguage('en', ['af-ZA'])).toBe('en');
    expect(resolveLanguage('af', ['en-ZA'])).toBe('af');
  });

  it('follows the first phone language the app has', () => {
    expect(resolveLanguage('device', ['af-ZA', 'en-ZA'])).toBe('af');
    expect(resolveLanguage('device', ['de-DE', 'en-GB'])).toBe('en');
  });

  it('falls back to English when the phone has no language the app has', () => {
    expect(resolveLanguage('device', ['zu-ZA'])).toBe('en');
    expect(resolveLanguage('device', [])).toBe('en');
  });
});

describe('saved preferences', () => {
  it('round-trips and defaults to Afrikaans with the device theme', async () => {
    const store = memoryStore();
    expect(await loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
    await savePreferences(store, { language: 'device', theme: 'dark' });
    expect(await loadPreferences(store)).toEqual({ language: 'device', theme: 'dark' });
  });

  it('ignores damaged or unknown values', async () => {
    const store = memoryStore({ preferences: '{"language":"fr","theme":"pink"}' });
    expect(await loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('message catalog', () => {
  it('fills placeholders and keeps unknown ones visible', () => {
    expect(translate('af', 'toast.alreadyOnList', { name: 'Melk' })).toBe('Melk is reeds op die lys');
    expect(translate('en', 'toast.alreadyOnList')).toBe('{name} is already on the list');
  });

  it('uses the same placeholders in every language', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of MESSAGE_KEYS) {
      const [first, ...rest] = LANGUAGES.map((language) => placeholders(translate(language, key)));
      for (const other of rest) expect(other, key).toEqual(first);
    }
  });
});
