/**
 * Every piece of text the app shows, in each supported language.
 * Keys are shared; `{name}` placeholders are filled by `translate`.
 * To add a language: add it to `LANGUAGES`, then add a catalog with the same keys.
 */

export const LANGUAGES = ['af', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The language names, each written in its own language. */
export const LANGUAGE_NAMES: Record<Language, string> = { af: 'Afrikaans', en: 'English' };

const af = {
  'app.settings': 'Instellings',

  'banner.localOnly': 'Hierdie lys is net op hierdie foon.',
  'banner.share': 'Deel dit',

  'list.toBuy': 'Om te koop',
  'list.empty': 'Niks om te koop nie. Voeg bo iets by.',
  'list.trolley': 'In die trollie',
  'list.doneShopping': 'Klaar geshop · haal gekoopte goed af',

  'toast.alreadyOnList': '{name} is reeds op die lys',
  'toast.removed': '{name} afgehaal',
  'toast.removedBoughtOne': '1 gekoopte item afgehaal',
  'toast.removedBoughtMany': '{count} gekoopte items afgehaal',
  'toast.undo': 'Ontdoen',

  'sync.localOnly': 'Net hierdie foon',
  'sync.syncing': 'Sync tans…',
  'sync.saving': 'Stoor tans…',
  'sync.synced': 'Gesync',
  'sync.offline': 'Offline',
  'sync.needsAction': 'Meld weer aan',
  'sync.error': 'Sync-probleem',

  'add.placeholder': 'Voeg iets by…',
  'add.nameLabel': 'Item',
  'add.quantityPlaceholder': 'Aantal',
  'add.quantityLabel': 'Hoeveelheid',
  'add.button': 'Voeg by',
  'add.buttonLabel': 'Voeg item by',

  'item.check': 'Sit {name} in die trollie',
  'item.uncheck': 'Sit {name} terug op die lys',
  'item.edit': 'Wysig {name}',
  'item.addedBy': 'bygevoeg deur {name}',

  'sheet.close': 'Maak toe',

  'edit.title': 'Wysig item',
  'edit.name': 'Item',
  'edit.quantity': 'Hoeveelheid',
  'edit.quantityPlaceholder': "Bv. 2, 1 kg, 'n groot een",
  'edit.note': 'Nota',
  'edit.notePlaceholder': 'Bv. die lae-vet een',
  'edit.addedBy': 'Bygevoeg deur {name}',
  'edit.remove': 'Haal af',
  'edit.save': 'Stoor',

  'welcome.title': 'Welkom by Spens',
  'welcome.text': 'Wat is jou naam? Die lys wys dit langs die items wat jy byvoeg.',
  'welcome.placeholder': 'Jou naam',
  'welcome.start': 'Begin',

  'settings.title': 'Instellings',
  'settings.name': 'Jou naam',
  'settings.language': 'Taal',
  'settings.theme': 'Tema',
  'settings.themeLight': 'Lig',
  'settings.themeDark': 'Donker',
  'settings.followDevice': 'Volg toestel',
  'settings.sharedList': 'Gedeelde lys',
  'settings.syncNow': 'Sync nou',
  'settings.shareWith': 'Deel met (Google e-posadres)',
  'settings.emailPlaceholder': 'naam@gmail.com',
  'settings.sendInvite': 'Stuur uitnodiging',
  'settings.inviteSent': 'Uitnodiging gestuur aan {email}',
  'settings.disconnect': 'Stop sync op hierdie foon',
  'settings.disconnected': 'Sync is op hierdie foon gestop',
  'settings.localOnlyHint':
    'Die lys is net op hierdie foon. Koppel dit aan gedeelde stoorplek, sodat almal in die huis dieselfde lys sien.',
  'settings.storage': 'Stoorplek',
  'settings.newListName': 'Naam van die nuwe lys',
  'settings.defaultListName': 'Inkopielys',
  'settings.create': "Skep 'n nuwe gedeelde lys",
  'settings.created': 'Gedeelde lys geskep. Maak Instellings oop om iemand uit te nooi.',
  'settings.join': "Sluit aan by 'n gedeelde lys",
  'settings.joined': 'Jy is nou by die gedeelde lys',
  'settings.privacy': 'Jou lys bly op hierdie foon en in die stoorplek wat jy koppel. Die app stuur dit nêrens anders heen nie.',
  'settings.lastSynced': 'Laas gesync {when}',
  'settings.notSynced': 'Nog nie gesync nie',
  'time.justNow': 'net nou',
  'time.minutesAgo': '{count} min gelede',

  'error.nameRequired': "'n Item het 'n naam nodig.",
  'error.invalidList': "Die gestoorde lys is nie 'n geldige inkopielys nie.",
  'error.newerSchema': "'n Nuwer weergawe van die app het hierdie lys gestoor (formaat {schema}). Dateer die app op om dit oop te maak.",
  'error.offline': 'Geen verbinding nie. Jou veranderinge is op hierdie foon gestoor en sync sodra jy weer aanlyn is.',
  'error.cannotShare': 'Hierdie stoorplek kan nie lyste deel nie.',
  'error.unknownStorage': 'Onbekende stoorplek: {id}',
  'error.raw': '{text}',

  'drive.description':
    'Die lys is een lêer in jou Google Drive. Jy deel dit met jou huishouding. Die app kan net lêers sien wat hy self gemaak het of wat jy kies.',
  'drive.notConfigured': 'Google Drive is nie in hierdie weergawe opgestel nie. Voeg die Google-sleutels by .env.local (sien SETUP.md).',
  'drive.connectionMine': '{file} · in jou Google Drive',
  'drive.connectionShared': '{file} · gedeel deur {owner}',
  'drive.connectionSharedUnknown': '{file} · gedeel deur iemand anders',
  'drive.notAList': '"{file}" is nie \'n inkopielys nie.',
  'drive.pickerTitle': 'Kies die gedeelde inkopielys',
  'drive.invalidEmail': "Tik 'n geldige e-posadres in.",
  'drive.inviteEmail':
    'Kom deel ons inkopielys op Spens. Maak {url} op jou foon oop, tik op Instellings, dan op "Sluit aan by \'n gedeelde lys", en kies "{file}".',
  'drive.noList': 'Geen inkopielys is gekoppel nie.',
  'drive.damaged': 'Die gedeelde lys se lêer is beskadig (dit is nie geldige JSON nie).',
  'drive.expired': 'Jou Google-aanmelding op hierdie foon het verval.',
  'drive.signIn': 'Meld by Google aan',
  'drive.popupBlocked': 'Die Google-aanmeldvenster is geblokkeer. Laat pop-ups vir hierdie app toe en probeer weer.',
  'drive.cancelled': 'Google-aanmelding is gekanselleer.',
  'drive.signInFailed': 'Google-aanmelding het misluk ({detail}).',
  'drive.scopeMissing':
    'Die app het toestemming nodig om sy eie lêers in jou Google Drive te gebruik. Meld weer aan en gee toestemming.',
  'drive.gone':
    "Die gedeelde lys bestaan nie meer nie, of is nie meer met jou gedeel nie. Vra dat dit weer gedeel word, of skep 'n nuwe lys.",
  'drive.refused': 'Google Drive het toegang tot die gedeelde lys geweier. Maak seker dit is met jou as redigeerder gedeel.',
  'drive.busy': 'Google Drive is besig. Jou veranderinge is op hierdie foon gestoor en sync binnekort.',
  'drive.httpError': 'Google Drive-fout {status}.',
  'drive.unreachable': 'Kon nie Google bereik nie. Kyk na jou verbinding en probeer weer.',
} as const;

export type MessageKey = keyof typeof af;

export const MESSAGE_KEYS = Object.keys(af) as MessageKey[];

const en: Record<MessageKey, string> = {
  'app.settings': 'Settings',

  'banner.localOnly': 'This list is only on this phone.',
  'banner.share': 'Share it',

  'list.toBuy': 'To buy',
  'list.empty': 'Nothing to buy. Add an item above.',
  'list.trolley': 'In the trolley',
  'list.doneShopping': 'Done shopping · remove bought items',

  'toast.alreadyOnList': '{name} is already on the list',
  'toast.removed': 'Removed {name}',
  'toast.removedBoughtOne': 'Removed 1 bought item',
  'toast.removedBoughtMany': 'Removed {count} bought items',
  'toast.undo': 'Undo',

  'sync.localOnly': 'This phone only',
  'sync.syncing': 'Syncing…',
  'sync.saving': 'Saving…',
  'sync.synced': 'Synced',
  'sync.offline': 'Offline',
  'sync.needsAction': 'Sign-in needed',
  'sync.error': 'Sync problem',

  'add.placeholder': 'Add an item…',
  'add.nameLabel': 'Item name',
  'add.quantityPlaceholder': 'Qty',
  'add.quantityLabel': 'Quantity',
  'add.button': 'Add',
  'add.buttonLabel': 'Add item',

  'item.check': 'Mark {name} as in the trolley',
  'item.uncheck': 'Put {name} back on the list',
  'item.edit': 'Edit {name}',
  'item.addedBy': 'added by {name}',

  'sheet.close': 'Close',

  'edit.title': 'Edit item',
  'edit.name': 'Item',
  'edit.quantity': 'Quantity',
  'edit.quantityPlaceholder': 'For example 2, 1 kg, a big one',
  'edit.note': 'Note',
  'edit.notePlaceholder': 'For example the low-fat one',
  'edit.addedBy': 'Added by {name}',
  'edit.remove': 'Remove',
  'edit.save': 'Save',

  'welcome.title': 'Welcome to Spens',
  'welcome.text': 'What is your name? The list shows it next to the items you add.',
  'welcome.placeholder': 'Your name',
  'welcome.start': 'Start',

  'settings.title': 'Settings',
  'settings.name': 'Your name',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.followDevice': 'Follow device',
  'settings.sharedList': 'Shared list',
  'settings.syncNow': 'Sync now',
  'settings.shareWith': 'Share with (Google account email)',
  'settings.emailPlaceholder': 'name@gmail.com',
  'settings.sendInvite': 'Send invite',
  'settings.inviteSent': 'Invite sent to {email}',
  'settings.disconnect': 'Stop syncing on this phone',
  'settings.disconnected': 'Stopped syncing on this phone',
  'settings.localOnlyHint': 'The list is only on this phone. Connect it to shared storage so your household sees the same list.',
  'settings.storage': 'Storage',
  'settings.newListName': 'New list name',
  'settings.defaultListName': 'Grocery list',
  'settings.create': 'Create a new shared list',
  'settings.created': 'Shared list created. Open Settings to invite someone.',
  'settings.join': 'Join a list shared with me',
  'settings.joined': 'Joined the shared list',
  'settings.privacy': 'Your list is kept on this phone and in the storage you connect. The app sends it nowhere else.',
  'settings.lastSynced': 'Last synced {when}',
  'settings.notSynced': 'Not synced yet',
  'time.justNow': 'just now',
  'time.minutesAgo': '{count} min ago',

  'error.nameRequired': 'An item needs a name.',
  'error.invalidList': 'The stored list is not a valid grocery list.',
  'error.newerSchema': 'A newer version of the app saved this list (format {schema}). Update the app to open it.',
  'error.offline': 'No connection. Changes are saved on this phone and sync when you are back online.',
  'error.cannotShare': 'This storage cannot share lists.',
  'error.unknownStorage': 'Unknown storage: {id}',
  'error.raw': '{text}',

  'drive.description':
    'The list is one file in your Google Drive. You share it with your household. The app can only see files it made or that you pick.',
  'drive.notConfigured': 'Google Drive is not set up in this build. Add the Google keys to .env.local (see SETUP.md).',
  'drive.connectionMine': '{file} · in your Google Drive',
  'drive.connectionShared': '{file} · shared by {owner}',
  'drive.connectionSharedUnknown': '{file} · shared by someone else',
  'drive.notAList': '"{file}" is not a grocery list.',
  'drive.pickerTitle': 'Choose the shared grocery list',
  'drive.invalidEmail': 'Enter a valid email address.',
  'drive.inviteEmail':
    'Join our shared grocery list on Spens. Open {url} on your phone, tap Settings, then "Join a list shared with me" and pick "{file}".',
  'drive.noList': 'No grocery list is connected.',
  'drive.damaged': 'The shared list file is damaged (it is not valid JSON).',
  'drive.expired': 'Your Google sign-in on this phone has expired.',
  'drive.signIn': 'Sign in to Google',
  'drive.popupBlocked': 'The Google sign-in window was blocked. Allow pop-ups for this app and try again.',
  'drive.cancelled': 'Google sign-in was cancelled.',
  'drive.signInFailed': 'Google sign-in failed ({detail}).',
  'drive.scopeMissing': 'The app needs permission to use its own files in your Google Drive. Sign in again and allow it.',
  'drive.gone': 'The shared list is gone or no longer shared with you. Ask for it to be shared again, or create a new list.',
  'drive.refused': 'Google Drive refused access to the shared list. Check that it is shared with you as an editor.',
  'drive.busy': 'Google Drive is busy. Changes are saved on this phone and sync shortly.',
  'drive.httpError': 'Google Drive error {status}.',
  'drive.unreachable': 'Could not reach Google. Check your connection and try again.',
};

const catalogs: Record<Language, Record<MessageKey, string>> = { af, en };

export type MessageParams = Record<string, string | number>;

/** A message that is translated when it is shown, so it follows a language change. */
export interface Message {
  key: MessageKey;
  params?: MessageParams;
}

export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  return catalogs[language][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    params && name in params ? String(params[name]) : match,
  );
}

/** An error whose text comes from the catalog. `message` holds the English text, for logs. */
export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: MessageParams,
  ) {
    super(translate('en', key, params));
    this.name = 'LocalizedError';
  }
}

/** Turns any thrown value into a message that can be shown in the current language. */
export function errorToMessage(error: unknown): Message {
  if (error instanceof LocalizedError) return { key: error.key, params: error.params };
  return { key: 'error.raw', params: { text: error instanceof Error ? error.message : String(error) } };
}
