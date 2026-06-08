import type { FlatBookmark, FolderNode, FolderOption } from '../models';

export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkNode[];
}

export interface EmptyFolderInfo {
  id: string;
  parentId?: string;
  title: string;
  path: string;
}

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;
const PROTECTED_FOLDER_IDS = new Set(['0', '1', '2', '3']);

function hasBookmarksApi() {
  return !!ext?.bookmarks;
}

export async function getBookmarkTree(): Promise<BookmarkNode[]> {
  if (!hasBookmarksApi()) return [];
  return (await ext.bookmarks.getTree()) as BookmarkNode[];
}

export async function createFolder(parentId: string, title: string): Promise<BookmarkNode | null> {
  if (!hasBookmarksApi()) return null;
  return (await ext.bookmarks.create({ parentId, title })) as BookmarkNode;
}

export async function updateBookmark(
  id: string,
  payload: { title?: string; url?: string },
): Promise<BookmarkNode | null> {
  if (!hasBookmarksApi()) return null;
  return (await ext.bookmarks.update(id, payload)) as BookmarkNode;
}

export async function deleteBookmark(id: string): Promise<void> {
  if (!hasBookmarksApi()) return;
  await ext.bookmarks.remove(id);
}

export async function deleteFolderTree(id: string): Promise<void> {
  if (!hasBookmarksApi()) return;
  await ext.bookmarks.removeTree(id);
}

export async function deleteEmptyFolder(id: string): Promise<void> {
  if (!hasBookmarksApi()) return;
  await ext.bookmarks.remove(id);
}

export async function moveBookmark(
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<BookmarkNode | null> {
  if (!hasBookmarksApi()) return null;
  return (await ext.bookmarks.move(id, destination)) as BookmarkNode;
}

export function flattenBookmarks(nodes: BookmarkNode[]): FlatBookmark[] {
  const out: FlatBookmark[] = [];

  const walk = (
    node: BookmarkNode,
    folderPath: string,
    folderId: string | undefined,
    folderName: string,
  ) => {
    if (node.url) {
      out.push({
        id: node.id,
        parentId: node.parentId,
        title: node.title || node.url,
        url: node.url,
        folderId,
        folderName,
        folderPath,
        dateAdded: node.dateAdded,
      });
      return;
    }

    const selfName = node.title || (node.id === '0' ? '根目录' : '未命名文件夹');
    const nextPath = folderPath ? `${folderPath} / ${selfName}` : selfName;
    const nextFolderId = node.id === '0' ? folderId : node.id;

    for (const child of node.children ?? []) {
      walk(child, nextPath, nextFolderId, selfName);
    }
  };

  for (const root of nodes) {
    walk(root, '', undefined, '全部书签');
  }

  return out;
}

function countBookmarks(node: BookmarkNode): number {
  if (node.url) return 1;
  return (node.children ?? []).reduce((total: number, child: BookmarkNode) => total + countBookmarks(child), 0);
}

function mapFolderTree(node: BookmarkNode, parentPath = ''): FolderNode | null {
  if (node.url) return null;

  const currentName = node.title || (node.id === '0' ? '全部书签' : '未命名文件夹');
  const currentPath = node.id === '0' ? '全部书签' : parentPath ? `${parentPath} / ${currentName}` : currentName;

  const childFolders = (node.children ?? [])
    .map((child: BookmarkNode) => mapFolderTree(child, currentPath))
    .filter((folder: FolderNode | null): folder is FolderNode => Boolean(folder));

  return {
    id: node.id,
    title: currentName,
    path: currentPath,
    bookmarkCount: countBookmarks(node),
    children: childFolders,
  };
}

export function buildFolderTree(nodes: BookmarkNode[]): FolderNode[] {
  return nodes
    .map((node) => mapFolderTree(node))
    .filter((folder): folder is FolderNode => Boolean(folder));
}

export function flattenFolderOptions(folderTree: FolderNode[]): FolderOption[] {
  const out: FolderOption[] = [];

  const walk = (node: FolderNode) => {
    if (node.id !== '0') {
      out.push({
        id: node.id,
        label: node.path,
        count: node.bookmarkCount,
      });
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  for (const folder of folderTree) {
    walk(folder);
  }

  return out;
}

export function findEmptyBookmarkFolders(nodes: BookmarkNode[]): EmptyFolderInfo[] {
  const out: EmptyFolderInfo[] = [];

  const walk = (node: BookmarkNode, parentPath = '') => {
    if (node.url) return;

    const title = node.title || (node.id === '0' ? '全部书签' : '未命名文件夹');
    const path = node.id === '0' ? '全部书签' : parentPath ? `${parentPath} / ${title}` : title;
    const children = node.children ?? [];

    if (!PROTECTED_FOLDER_IDS.has(node.id) && children.length === 0) {
      out.push({
        id: node.id,
        parentId: node.parentId,
        title,
        path,
      });
    }

    for (const child of children) {
      walk(child, path);
    }
  };

  for (const root of nodes) {
    walk(root);
  }

  return out;
}

export function collectBookmarksInFolder(
  tree: BookmarkNode[],
  folderId: string,
): FlatBookmark[] {
  if (!folderId || folderId === '0') {
    return flattenBookmarks(tree);
  }

  const queue = [...tree];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.id === folderId) {
      return flattenBookmarks([node]);
    }
    queue.push(...(node.children ?? []));
  }
  return [];
}

export function watchBookmarkChanges(onChange: () => void): () => void {
  if (!hasBookmarksApi()) return () => {};
  const handler = () => onChange();
  ext.bookmarks.onCreated.addListener(handler);
  ext.bookmarks.onChanged.addListener(handler);
  ext.bookmarks.onRemoved.addListener(handler);
  ext.bookmarks.onMoved.addListener(handler);
  ext.bookmarks.onChildrenReordered.addListener(handler);

  return () => {
    ext.bookmarks.onCreated.removeListener(handler);
    ext.bookmarks.onChanged.removeListener(handler);
    ext.bookmarks.onRemoved.removeListener(handler);
    ext.bookmarks.onMoved.removeListener(handler);
    ext.bookmarks.onChildrenReordered.removeListener(handler);
  };
}
