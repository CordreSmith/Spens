# Groceries

A shared grocery list for a household. Two or more phones see one list. You add items, tick them into the trolley, and
remove the bought items when you finish shopping.

The app has no server of its own. The list is kept on each phone and in one storage location that you select. The first
storage provider is Google Drive.

To set it up, read [SETUP.md](SETUP.md).

## Features

- Add an item with an optional quantity. The app gives suggestions from items that you bought before.
- The app does not add a duplicate. If the item is already on the list, the app shows a message and highlights the item.
- Tap the circle to put an item in the trolley. Tap it again to put the item back on the list.
- Tap the item name to change the name, quantity or note, or to remove the item.
- **Done shopping** removes all bought items. **Undo** brings them back.
- Each item shows who added it, if another person added it.
- The app works offline and syncs when the phone has a connection again.
- The app installs to the home screen as a Progressive Web App.

## How sync works

The list is one JSON document. Each field of each item has a time stamp and a device ID. This makes the document a
CRDT (conflict-free replicated data type).

When the app syncs, it downloads the remote copy and merges it with the local copy. For each field, the most recent
change wins. The merge gives the same result in any order. If two phones save at the same time, one phone can
overwrite the other phone's change in the file. But the other phone still has its change, and its next sync puts the
change back. Because of this, a storage provider only has to read and write one file. It does not need locks or
conflict rules.

Removed items stay in the document with `deleted: true`. They supply the add-item suggestions. If you add the same
name again, the app brings back the old item with its note.

The app syncs when it opens, when it comes back to the front, when the phone goes online, every 15 seconds while it is
visible, and about one second after each change.

## Project layout

```
src/
  domain/list.ts                 List document, all list operations, CRDT merge (no dependencies)
  sync/StorageProvider.ts        The storage plugin contract
  sync/providers.ts              The list of providers in this build
  sync/SyncEngine.ts             Local save, pull / merge / push, sync status (no browser code)
  sync/KeyValueStore.ts          Device storage (localStorage now, native storage later)
  providers/googleDrive/         The Google Drive provider
  app/                           React UI
```

## Add a storage provider

1. Make a class that implements `StorageProvider` from `src/sync/StorageProvider.ts`. The main methods are
   `pull()` and `push()`, which read and write the list document. The provider never merges.
2. Export a `ProviderDefinition` with an ID, a name, a description and a `create()` function.
3. Add the definition to `src/sync/providers.ts`.

When there is more than one provider, Settings shows a choice. Providers that could come next: Dropbox,
WebDAV / Nextcloud, a home server, or iCloud in a native iOS build.

Use the fake provider in `src/sync/SyncEngine.test.ts` as an example and as a test pattern.

## Path to a native app

The code is ready for [Capacitor](https://capacitorjs.com/), which puts this web app in a native Android and iOS shell:

- `SyncEngine` and `domain/` have no browser code. They work in the native shell with no changes.
- `KeyValueStore` is async. Replace `localStorageStore()` with a store that uses the Capacitor Preferences plugin.
- Google Identity Services does not work in a native WebView. For the native build, change the sign-in part of
  `GoogleDriveProvider` to a native Google sign-in plugin. A native sign-in also removes the one-hour sign-in expiry.
- `useAutoSync` in `app/App.tsx` listens for browser events. In the native build, also listen for the Capacitor
  `appStateChange` event.

## Development

The project uses a portable Node.js in `.tools/`. It is not installed on the system. Run
`. .\scripts\use-node.ps1` in each new PowerShell window, then use `npm test`, `npm run dev` and `npm run build`.
