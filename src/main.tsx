import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { applyTheme, loadPreferences, resolveLanguage } from './app/preferences';
import { loadActor } from './app/profile';
import type { Language } from './i18n/messages';
import { localStorageStore } from './sync/KeyValueStore';
import { providerDefinitions } from './sync/providers';
import { SyncEngine } from './sync/SyncEngine';
import './styles.css';

registerSW({ immediate: true });

const store = localStorageStore();
const preferences = await loadPreferences(store);
// Apply the theme before the first paint, so a Donker choice never flashes light.
applyTheme(preferences.theme);
const languageRef: { current: Language } = {
  current: resolveLanguage(preferences.language, navigator.languages ?? [navigator.language]),
};
const [engine, actor] = await Promise.all([
  SyncEngine.open(store, providerDefinitions, { language: () => languageRef.current }),
  loadActor(store),
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App engine={engine} store={store} initialActor={actor} initialPreferences={preferences} languageRef={languageRef} />
  </StrictMode>,
);
