/**
 * The storage providers this build offers. Add a new provider here.
 * The first available provider is the default in Settings.
 */
import { googleDriveDefinition } from '../providers/googleDrive/GoogleDriveProvider';
import type { ProviderDefinition } from './StorageProvider';

export const providerDefinitions: readonly ProviderDefinition[] = [googleDriveDefinition];
