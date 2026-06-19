import { describe, expect, it } from 'vitest';
import type { AppSettings, CloudSyncMetadata, CloudSyncPayload, FlatBookmark } from '../models';
import {
  collectCloudFavoriteSites,
  decideCloudSyncDirection,
  parseCloudSyncPayload,
  resolveCloudFavoriteSites,
} from './cloudSync';

const settings = (): AppSettings => ({
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
});

const metadata = (patch: Partial<CloudSyncMetadata> = {}): CloudSyncMetadata => ({
  deviceId: 'device-a',
  localVersion: 1,
  localUpdatedAt: 100,
  lastSyncedLocalVersion: 1,
  lastRemoteVersion: 1,
  ...patch,
});

const remote = (version = 1): CloudSyncPayload => ({
  app: 'kuntab',
  schemaVersion: 1,
  remoteVersion: version,
  updatedAt: 100,
  updatedByDeviceId: 'device-b',
  data: {
    settings: settings(),
    favoriteSites: [],
  },
});

const bookmark = (patch: Partial<FlatBookmark>): FlatBookmark => ({
  id: 'id-1',
  title: 'Example',
  url: 'https://example.com/',
  folderName: '全部书签',
  folderPath: '全部书签',
  ...patch,
});

describe('decideCloudSyncDirection', () => {
  it('initializes when remote is missing', () => {
    expect(decideCloudSyncDirection(metadata(), null)).toBe('upload-initialize');
  });

  it('uploads when only local changed', () => {
    expect(decideCloudSyncDirection(metadata({ localVersion: 2 }), remote(1))).toBe('upload');
  });

  it('downloads when only remote changed', () => {
    expect(decideCloudSyncDirection(metadata(), remote(2))).toBe('download');
  });

  it('reports noop when both sides are already synced', () => {
    expect(decideCloudSyncDirection(metadata(), remote(1))).toBe('noop');
  });

  it('reports conflict when both sides changed', () => {
    expect(decideCloudSyncDirection(metadata({ localVersion: 2 }), remote(2))).toBe('conflict');
  });
});

describe('parseCloudSyncPayload', () => {
  it('accepts a valid payload', () => {
    expect(parseCloudSyncPayload(remote(3)).remoteVersion).toBe(3);
  });

  it('rejects wrong app name', () => {
    expect(() => parseCloudSyncPayload({ ...remote(), app: 'other' })).toThrow('远端同步文件格式无效');
  });

  it('rejects wrong schema version', () => {
    expect(() => parseCloudSyncPayload({ ...remote(), schemaVersion: 2 })).toThrow('远端同步文件格式无效');
  });

  it('rejects missing data', () => {
    const payload = remote() as Partial<CloudSyncPayload>;
    delete payload.data;
    expect(() => parseCloudSyncPayload(payload)).toThrow('远端同步数据不完整');
  });
});

describe('favorite site conversion', () => {
  it('collects cloud favorite sites by bookmark ids', () => {
    expect(
      collectCloudFavoriteSites(
        ['id-2', 'missing', 'id-1'],
        [
          bookmark({ id: 'id-1', title: 'A', url: 'https://a.example/' }),
          bookmark({ id: 'id-2', title: 'B', url: 'https://b.example/' }),
        ],
      ),
    ).toEqual([
      { title: 'B', url: 'https://b.example/' },
      { title: 'A', url: 'https://a.example/' },
    ]);
  });

  it('resolves remote favorite URLs to local bookmark ids', () => {
    const result = resolveCloudFavoriteSites(
      [
        { title: 'Remote A', url: 'HTTPS://EXAMPLE.COM/path#section' },
        { title: 'Remote B', url: 'https://missing.example/' },
      ],
      [bookmark({ id: 'local-a', url: 'https://example.com/path' })],
    );

    expect(result).toEqual({
      favorites: { favorites: ['local-a'] },
      skipped: 1,
    });
  });
});
