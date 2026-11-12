import { LANGUAGES, type Language } from '../i18n/messages';
import type { KeyValueStore } from '../sync/KeyValueStore';

/** 'device' follows the phone's own setting and changes with it. */
export type LanguagePreference = Language | 'device';
export type ThemePreference = 'light' | 'dark' | 'device';

export interface Preferences {
  language: LanguagePreference;
  theme: ThemePreference;
}

export const DEFAULT_PREFERENCES: Preferences = { language: 'af', theme: 'device' };

const PREFERENCES_KEY = 'preferences';

export async function loadPreferences(store: KeyValueStore): Promise<Preferences> {
  const raw = await store.get(PREFERENCES_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const saved = JSON.parse(raw) as Partial<Preferences>;
    return {
      language: isLanguagePreference(saved.language) ? saved.language : DEFAULT_PREFERENCES.language,
      theme: saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'device' ? saved.theme : DEFAULT_PREFERENCES.theme,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }

  function isLanguagePreference(value: unknown): value is LanguagePreference {
    return value === 'device' || LANGUAGES.includes(value as Language);
  }
}

export function savePreferences(store: KeyValueStore, preferences: Preferences): Promise<void> {
  return store.set(PREFERENCES_KEY, JSON.stringify(preferences));
}

/** The language to show. For 'device', the first phone language the app has; English when it has none of them. */
export function resolveLanguage(preference: LanguagePreference, deviceLanguages: readonly string[]): Language {
  if (preference !== 'device') return preference;
  for (const tag of deviceLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    const match = LANGUAGES.find((language) => language === base);
    if (match) return match;
  }
  return 'en';
}

/** Sets the theme on the page. For 'device', the CSS follows prefers-color-scheme. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'device') delete root.dataset.theme;
  else root.dataset.theme = preference;
}
