import type {
  AppSettings,
  CloudSyncFavoriteSite,
  CloudSyncMetadata,
  CloudSyncPayload,
  FavoritesState,
  FlatBookmark,
} from '../models';
import { ensureHttpUrl } from './utils';

export type CloudSyncDirection = 'upload-initialize' | 'upload' | 'download' | 'noop' | 'conflict';

export function decideCloudSyncDirection(
  metadata: CloudSyncMetadata,
  remote: CloudSyncPayload | null,
): CloudSyncDirection {
  if (!remote) return 'upload-initialize';
  const localChanged = metadata.localVersion !== metadata.lastSyncedLocalVersion;
  const remoteChanged = remote.remoteVersion !== metadata.lastRemoteVersion;
  if (localChanged && remoteChanged) return 'conflict';
  if (localChanged) return 'upload';
  if (remoteChanged) return 'download';
  return 'noop';
}

export function sanitizeSettingsForCloud(settings: AppSettings): AppSettings {
  return { ...settings };
}

export function buildCloudSyncPayload(params: {
  settings: AppSettings;
  favoriteSites: CloudSyncFavoriteSite[];
  metadata: CloudSyncMetadata;
  previousRemoteVersion: number;
}): CloudSyncPayload {
  return {
    app: 'kuntab',
    schemaVersion: 1,
    remoteVersion: params.previousRemoteVersion + 1,
    updatedAt: Date.now(),
    updatedByDeviceId: params.metadata.deviceId,
    data: {
      settings: sanitizeSettingsForCloud(params.settings),
      favoriteSites: params.favoriteSites,
    },
  };
}

export function parseCloudSyncPayload(value: unknown): CloudSyncPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('远端同步文件格式无效');
  }
  const payload = value as Partial<CloudSyncPayload>;
  if (payload.app !== 'kuntab' || payload.schemaVersion !== 1) {
    throw new Error('远端同步文件格式无效');
  }
  if (!Number.isFinite(payload.remoteVersion) || (payload.remoteVersion ?? 0) < 1) {
    throw new Error('远端同步版本无效');
  }
  if (!payload.data || !payload.data.settings || !Array.isArray(payload.data.favoriteSites)) {
    throw new Error('远端同步数据不完整');
  }

  return payload as CloudSyncPayload;
}

export function collectCloudFavoriteSites(
  favorites: string[],
  allBookmarks: FlatBookmark[],
): CloudSyncFavoriteSite[] {
  const byId = new Map(allBookmarks.map((bookmark) => [bookmark.id, bookmark]));
  return favorites
    .map((id) => byId.get(id))
    .filter((bookmark): bookmark is FlatBookmark => Boolean(bookmark))
    .map((bookmark) => ({
      title: bookmark.title,
      url: bookmark.url,
    }));
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(ensureHttpUrl(raw));
    url.hash = '';
    return url.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function resolveCloudFavoriteSites(
  favoriteSites: CloudSyncFavoriteSite[],
  allBookmarks: FlatBookmark[],
): { favorites: FavoritesState; skipped: number } {
  const bookmarkByUrl = new Map<string, FlatBookmark>();
  for (const bookmark of allBookmarks) {
    const normalized = normalizeUrl(bookmark.url);
    if (!bookmarkByUrl.has(normalized)) {
      bookmarkByUrl.set(normalized, bookmark);
    }
  }

  const favorites: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const site of favoriteSites) {
    const bookmark = bookmarkByUrl.get(normalizeUrl(site.url));
    if (!bookmark) {
      skipped += 1;
      continue;
    }
    if (seen.has(bookmark.id)) {
      continue;
    }
    seen.add(bookmark.id);
    favorites.push(bookmark.id);
  }

  return {
    favorites: { favorites },
    skipped,
  };
}
