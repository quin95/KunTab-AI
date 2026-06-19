import type { AppSettings, CloudSyncMetadata, CloudSyncSettings, FavoritesState, RecentOpenItem } from '../models';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;

const SETTINGS_KEY = 'kuntab::settings';
const FAVORITES_KEY = 'kuntab::favorites';
const RECENT_OPENS_KEY = 'kuntab::recent-opens';
const CLOUD_SYNC_SETTINGS_KEY = 'kuntab::cloud-sync-settings';
const CLOUD_SYNC_META_KEY = 'kuntab::cloud-sync-meta';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  searchEngine: 'google',
  startPage: 'home',
  compactMode: false,
  fontSize: 'medium',
  language: 'zh-CN',
  customBgUrl: '',
  bgBlur: 0,
  bgOpacity: 0,
  aiProvider: 'none',
  aiModel: 'gpt-4o-mini',
  aiApiKey: '',
  aiBaseUrl: '',
};

const DEFAULT_FAVORITES: FavoritesState = {
  favorites: [],
};

export const DEFAULT_CLOUD_SYNC_SETTINGS: CloudSyncSettings = {
  endpoint: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  keyPrefix: '',
};

const hasStorageApi =
  !!ext?.storage &&
  !!ext.storage.sync &&
  !!ext.storage.local;

async function getSync<T>(key: string, fallback: T): Promise<T> {
  if (!hasStorageApi) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return { ...fallback, ...JSON.parse(raw) } as T;
    } catch {
      return fallback;
    }
  }
  const data = await ext.storage.sync.get(key);
  return ((data[key] ?? fallback) as T) ?? fallback;
}

async function setSync<T>(key: string, value: T): Promise<void> {
  if (!hasStorageApi) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  await ext.storage.sync.set({ [key]: value });
}

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  if (!hasStorageApi) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  const data = await ext.storage.local.get(key);
  return ((data[key] ?? fallback) as T) ?? fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  if (!hasStorageApi) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  await ext.storage.local.set({ [key]: value });
}

async function removeLocal(keys: string[]): Promise<void> {
  if (!hasStorageApi) {
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    return;
  }
  await ext.storage.local.remove(keys);
}

function createDeviceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getCloudSyncSettings(): Promise<CloudSyncSettings> {
  const settings = await getLocal<CloudSyncSettings>(CLOUD_SYNC_SETTINGS_KEY, DEFAULT_CLOUD_SYNC_SETTINGS);
  return { ...DEFAULT_CLOUD_SYNC_SETTINGS, ...settings };
}

export async function updateCloudSyncSettings(patch: Partial<CloudSyncSettings>): Promise<CloudSyncSettings> {
  const merged = { ...(await getCloudSyncSettings()), ...patch };
  await setLocal(CLOUD_SYNC_SETTINGS_KEY, merged);
  return merged;
}

export async function getCloudSyncMetadata(): Promise<CloudSyncMetadata> {
  const saved = await getLocal<Partial<CloudSyncMetadata>>(CLOUD_SYNC_META_KEY, {});
  const metadata: CloudSyncMetadata = {
    deviceId: saved.deviceId || createDeviceId(),
    localVersion: saved.localVersion ?? 0,
    localUpdatedAt: saved.localUpdatedAt ?? 0,
    lastSyncedLocalVersion: saved.lastSyncedLocalVersion ?? 0,
    lastRemoteVersion: saved.lastRemoteVersion ?? 0,
  };
  if (!saved.deviceId) {
    await setLocal(CLOUD_SYNC_META_KEY, metadata);
  }
  return metadata;
}

export async function setCloudSyncMetadata(metadata: CloudSyncMetadata): Promise<void> {
  await setLocal(CLOUD_SYNC_META_KEY, metadata);
}

async function bumpCloudSyncLocalVersion(): Promise<void> {
  const current = await getCloudSyncMetadata();
  await setCloudSyncMetadata({
    ...current,
    localVersion: current.localVersion + 1,
    localUpdatedAt: Date.now(),
  });
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await getSync<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const merged = { ...(await getSettings()), ...patch };
  await setSync(SETTINGS_KEY, merged);
  await bumpCloudSyncLocalVersion();
  return merged;
}

export async function getFavorites(): Promise<FavoritesState> {
  const value = await getSync<FavoritesState>(FAVORITES_KEY, DEFAULT_FAVORITES);
  return { ...DEFAULT_FAVORITES, ...value };
}

export async function setFavorites(next: FavoritesState): Promise<void> {
  await setSync(FAVORITES_KEY, next);
  await bumpCloudSyncLocalVersion();
}

export async function getRecentOpens(): Promise<RecentOpenItem[]> {
  return await getLocal<RecentOpenItem[]>(RECENT_OPENS_KEY, []);
}

export async function pushRecentOpen(item: RecentOpenItem): Promise<void> {
  const current = await getRecentOpens();
  const deduped = current.filter((entry) => entry.id !== item.id && entry.url !== item.url);
  deduped.unshift(item);
  await setLocal(RECENT_OPENS_KEY, deduped.slice(0, 40));
}

export async function setRecentOpensStorage(items: RecentOpenItem[]): Promise<void> {
  await setLocal(RECENT_OPENS_KEY, items);
}


export async function clearLocalCache(): Promise<void> {
  await removeLocal([RECENT_OPENS_KEY]);
}

export async function clearAppCache(): Promise<void> {
  if (!hasStorageApi) {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(FAVORITES_KEY);
    localStorage.removeItem(RECENT_OPENS_KEY);
    localStorage.removeItem(CLOUD_SYNC_SETTINGS_KEY);
    localStorage.removeItem(CLOUD_SYNC_META_KEY);
    return;
  }
  await ext.storage.sync.set({
    [SETTINGS_KEY]: DEFAULT_SETTINGS,
    [FAVORITES_KEY]: DEFAULT_FAVORITES,
  });
  await ext.storage.local.remove([RECENT_OPENS_KEY, CLOUD_SYNC_SETTINGS_KEY, CLOUD_SYNC_META_KEY]);
}

export async function replaceFromBackup(settings: AppSettings, favorites: FavoritesState): Promise<void> {
  await setSync(SETTINGS_KEY, settings);
  await setSync(FAVORITES_KEY, favorites);
  await bumpCloudSyncLocalVersion();
}

export async function replaceFromCloudSync(settings: AppSettings, favorites: FavoritesState): Promise<void> {
  await setSync(SETTINGS_KEY, settings);
  await setSync(FAVORITES_KEY, favorites);
}

export function watchSettings(handler: (settings: AppSettings) => void): () => void {
  if (!hasStorageApi) return () => {};
  const listener = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== 'sync') return;
    if (changes[SETTINGS_KEY]?.newValue) {
      handler({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as AppSettings) });
    }
  };
  ext.storage.onChanged.addListener(listener);
  return () => ext.storage.onChanged.removeListener(listener);
}

export async function getStorageSize(): Promise<string> {
  let totalBytes = 0;
  if (!hasStorageApi) {
    const keys = [SETTINGS_KEY, FAVORITES_KEY, RECENT_OPENS_KEY];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) {
        totalBytes += new TextEncoder().encode(val).length;
      }
    }
  } else {
    try {
      const [localData, syncData] = await Promise.all([
        ext.storage.local.get([RECENT_OPENS_KEY, CLOUD_SYNC_SETTINGS_KEY, CLOUD_SYNC_META_KEY]),
        ext.storage.sync.get([SETTINGS_KEY, FAVORITES_KEY]),
      ]);
      const localStr = JSON.stringify(localData);
      const syncStr = JSON.stringify(syncData);
      totalBytes += new TextEncoder().encode(localStr).length;
      totalBytes += new TextEncoder().encode(syncStr).length;
    } catch {
      // Fallback
    }
  }

  if (totalBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(totalBytes) / Math.log(k));
  return parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
