import { describe, expect, it } from 'vitest';
import { parseBackupJson } from './backup';

const baseBackup = {
  app: 'kuntab',
  exportedAt: 100,
  tree: [],
  favoriteSites: [],
  settings: {
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
  },
};

describe('parseBackupJson', () => {
  it('accepts v2 backups and fills empty site navigation data', () => {
    const parsed = parseBackupJson(JSON.stringify({ ...baseBackup, version: 2 }));

    expect(parsed.version).toBe(2);
    expect(parsed.siteNavigation).toEqual({
      categories: [],
      items: [],
      updatedAt: 0,
    });
  });

  it('accepts v3 backups with site navigation data', () => {
    const parsed = parseBackupJson(
      JSON.stringify({
        ...baseBackup,
        version: 3,
        siteNavigation: {
          updatedAt: 200,
          categories: [{ id: 'dev', name: 'Dev', order: 0, createdAt: 1, updatedAt: 1 }],
          items: [
            {
              id: 'github',
              title: 'GitHub',
              url: 'github.com',
              categoryId: 'dev',
              iconUrl: '',
              order: 0,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      }),
    );

    expect(parsed.version).toBe(3);
    expect(parsed.siteNavigation.categories).toHaveLength(1);
    expect(parsed.siteNavigation.items[0]).toMatchObject({
      id: 'github',
      title: 'GitHub',
      url: 'https://github.com',
      categoryId: 'dev',
    });
  });

  it('rejects unsupported backup versions', () => {
    expect(() => parseBackupJson(JSON.stringify({ ...baseBackup, version: 1 }))).toThrow('无效的备份文件');
  });
});
