import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { loadActor } from './app/profile';
import { localStorageStore } from './sync/KeyValueStore';
import { providerDefinitions } from './sync/providers';
import { SyncEngine } from './sync/SyncEngine';
import './styles.css';

registerSW({ immediate: true });

const store = localStorageStore();
const [engine, actor] = await Promise.all([SyncEngine.open(store, providerDefinitions), loadActor(store)]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App engine={engine} store={store} initialActor={actor} />
  </StrictMode>,
);
