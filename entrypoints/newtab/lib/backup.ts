import type { AppSettings, BackupData, BookmarkBackupNode, FavoritesState, FlatBookmark, SiteNavigationData } from '../models';
import { type BookmarkNode, flattenBookmarks, getBookmarkTree } from './bookmarks';
import { downloadTextFile, ensureHttpUrl } from './utils';
import { replaceFromBackup } from './storage';
import { DEFAULT_SITE_NAVIGATION, sanitizeSiteNavigationData } from './siteNavigator';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;

function toBackupNode(node: BookmarkNode): BookmarkBackupNode {
  return {
    title: node.title || '',
    url: node.url,
    dateAdded: node.dateAdded,
    dateGroupModified: node.dateGroupModified,
    children: node.children?.map(toBackupNode),
  };
}

export async function buildBackup(
  settings: AppSettings,
  favorites: FavoritesState,
  siteNavigation: SiteNavigationData,
): Promise<BackupData> {
  const tree = await getBookmarkTree();
  const topLevel = tree[0]?.children ?? tree;
  const bookmarkById = new Map(flattenBookmarks(tree).map((bookmark) => [bookmark.id, bookmark]));
  const favoriteSites = favorites.favorites
    .map((id) => bookmarkById.get(id))
    .filter((bookmark): bookmark is FlatBookmark => Boolean(bookmark))
    .map((bookmark) => ({
      title: bookmark.title,
      url: bookmark.url,
    }));

  return {
    app: 'kuntab',
    version: 3,
    exportedAt: Date.now(),
    tree: topLevel.map(toBackupNode),
    favoriteSites,
    settings,
    siteNavigation: sanitizeSiteNavigationData(siteNavigation),
  };
}

function ymdhms() {
  const date = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function downloadJsonBackup(backup: BackupData) {
  downloadTextFile(
    `kuntab-backup-${ymdhms()}.json`,
    JSON.stringify(backup, null, 2),
    'application/json;charset=utf-8',
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function backupToNetscapeHtml(nodes: BookmarkBackupNode[]): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  const walk = (node: BookmarkBackupNode, indent = '    ') => {
    const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
    if (node.url) {
      lines.push(`${indent}<DT><A HREF="${escapeHtml(node.url)}"${addDate}>${escapeHtml(node.title || node.url)}</A>`);
      return;
    }

    const modified = node.dateGroupModified ? ` LAST_MODIFIED="${Math.floor(node.dateGroupModified / 1000)}"` : '';
    lines.push(`${indent}<DT><H3${addDate}${modified}>${escapeHtml(node.title)}</H3>`);
    lines.push(`${indent}<DL><p>`);
    for (const child of node.children ?? []) {
      walk(child, `${indent}    `);
    }
    lines.push(`${indent}</DL><p>`);
  };

  for (const node of nodes) {
    walk(node);
  }

  lines.push('</DL><p>');
  return lines.join('\n');
}

export function downloadHtmlBackup(backup: BackupData) {
  downloadTextFile(
    `kuntab-backup-${ymdhms()}.html`,
    backupToNetscapeHtml(backup.tree),
    'text/html;charset=utf-8',
  );
}

export function parseBackupJson(content: string): BackupData {
  const parsed = JSON.parse(content) as Partial<BackupData> & { app?: string; version?: number };
  if (
    !parsed ||
    parsed.app !== 'kuntab' ||
    (parsed.version !== 2 && parsed.version !== 3) ||
    !Array.isArray(parsed.tree) ||
    !Array.isArray(parsed.favoriteSites) ||
    !parsed.settings
  ) {
    throw new Error('无效的备份文件');
  }
  return {
    app: 'kuntab',
    version: parsed.version,
    exportedAt: parsed.exportedAt ?? Date.now(),
    tree: parsed.tree,
    favoriteSites: parsed.favoriteSites,
    settings: parsed.settings,
    siteNavigation: sanitizeSiteNavigationData(parsed.siteNavigation ?? DEFAULT_SITE_NAVIGATION),
  };
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(ensureHttpUrl(raw));
    url.hash = '';
    return url.toString().toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

async function collectExistingUrlSet(): Promise<Set<string>> {
  const tree = await getBookmarkTree();
  const flat = flattenBookmarks(tree);
  return new Set(flat.map((bookmark) => normalizeUrl(bookmark.url)));
}

async function createFolder(title: string, parentId: string): Promise<string> {
  const folder = await ext.bookmarks.create({ parentId, title: title || '未命名文件夹' });
  return folder.id;
}

async function createBookmark(title: string, url: string, parentId: string): Promise<void> {
  await ext.bookmarks.create({
    parentId,
    title: title || url,
    url: ensureHttpUrl(url),
  });
}

export async function importBackupTree(
  rootFolderId: string,
  tree: BookmarkBackupNode[],
): Promise<{ added: number; skipped: number }> {
  const existing = await collectExistingUrlSet();
  let added = 0;
  let skipped = 0;

  const walk = async (nodes: BookmarkBackupNode[], parentId: string) => {
    for (const node of nodes) {
      if (node.url) {
        const normalized = normalizeUrl(node.url);
        if (existing.has(normalized)) {
          skipped += 1;
          continue;
        }

        try {
          await createBookmark(node.title, node.url, parentId);
          existing.add(normalized);
          added += 1;
        } catch {
          skipped += 1;
        }
        continue;
      }

      const folderId = await createFolder(node.title, parentId);
      await walk(node.children ?? [], folderId);
    }
  };

  await walk(tree, rootFolderId);
  return { added, skipped };
}

export async function resolveBackupFavorites(backup: BackupData): Promise<FavoritesState> {
  const tree = await getBookmarkTree();
  const flat = flattenBookmarks(tree);
  const bookmarkByUrl = new Map<string, FlatBookmark>();

  for (const bookmark of flat) {
    const normalized = normalizeUrl(bookmark.url);
    if (!bookmarkByUrl.has(normalized)) {
      bookmarkByUrl.set(normalized, bookmark);
    }
  }

  const nextFavorites: string[] = [];
  const seen = new Set<string>();

  const addFavoriteId = (id?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    nextFavorites.push(id);
  };

  for (const site of backup.favoriteSites) {
    addFavoriteId(bookmarkByUrl.get(normalizeUrl(site.url))?.id);
  }

  return { favorites: nextFavorites };
}

export async function applyBackupConfig(
  settings: AppSettings,
  favorites: FavoritesState,
  siteNavigation: SiteNavigationData,
): Promise<void> {
  await replaceFromBackup(settings, favorites, siteNavigation);
}
