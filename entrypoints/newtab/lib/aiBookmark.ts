import type { FlatBookmark, FolderNode } from '../models';
import { getBookmarkTree, type BookmarkNode } from './bookmarks';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;

export interface DiffTreeNode {
  id: string;
  title: string;
  isFolder: boolean;
  url?: string;
  path: string;
  status: 'normal' | 'moved-out' | 'moved-in' | 'created';
  targetFolder?: string;
  children: DiffTreeNode[];
}

export interface CategorizeResult {
  newFolders: string[];
  moves: {
    bookmarkId: string;
    targetFolderPath: string;
  }[];
}

/**
 * 序列化当前书签的快照，用于发送给 AI。
 */
export function serializeBookmarkContext(
  bookmarks: FlatBookmark[],
  folderOptions: { id: string; label: string }[]
): string {
  const foldersList = folderOptions
    .map((f) => `  - ${f.label}`)
    .join('\n');

  const bookmarksList = bookmarks
    .map((b) => {
      let cleanUrl = b.url;
      try {
        const parsed = new URL(b.url);
        // Remove common tracking parameters to help group duplicates that only differ by tracking parameters
        const trackingParams = [
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'spm', 'from', 'ref', 'click_id', 'gclid', 'fbclid', '_hsenc', '_hsmi',
          'mc_cid', 'mc_eid', 'rb_clickid', 's_kwcid', 'msclkid'
        ];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        cleanUrl = parsed.toString();
      } catch {
        // use original if URL parsing fails
      }
      const cleanTitle = b.title && b.title.length > 80 ? b.title.slice(0, 80) + '...' : b.title;
      return `  - ID: ${b.id} | 标题: ${cleanTitle} | URL: ${cleanUrl} | 当前文件夹: ${b.folderPath}`;
    })
    .join('\n');

  return [
    `【系统路径分隔符说明】`,
    `书签夹层级路径以 " / "（斜杠两边带空格）进行分隔。`,
    `例如："全部书签 / 书签栏 / 开发工具 / AI 助手"`,
    `根节点固定为 "全部书签"，"书签栏" 的路径为 "全部书签 / 书签栏"。"其他书签" 路径为 "全部书签 / 其他书签"。`,
    ``,
    `【现有文件夹目录】`,
    foldersList || '  （无）',
    ``,
    `【待分类书签列表】`,
    bookmarksList || '  （当前范围无书签）',
  ].join('\n');
}

/**
 * 递归构建 Diff 树
 */
function buildDiffTree(
  node: BookmarkNode,
  parentPath = '',
  movesMap: Map<string, string>,
  isAfterState: boolean,
  newFoldersSet?: Set<string>
): DiffTreeNode | null {
  const currentName = node.title || (node.id === '0' ? '全部书签' : '未命名文件夹');
  const currentPath = node.id === '0' ? '全部书签' : parentPath ? `${parentPath} / ${currentName}` : currentName;

  const isFolder = !node.url;

  if (isFolder) {
    const childrenNodes: DiffTreeNode[] = [];
    for (const child of node.children ?? []) {
      const childDiff = buildDiffTree(child, currentPath, movesMap, isAfterState, newFoldersSet);
      if (childDiff) {
        childrenNodes.push(childDiff);
      }
    }

    return {
      id: node.id,
      title: currentName,
      isFolder: true,
      path: currentPath,
      status: 'normal',
      children: childrenNodes,
    };
  } else {
    // Bookmark node
    const willMoveTo = movesMap.get(node.id);

    if (isAfterState) {
      // If we are in the "After" tree, bookmarks that are moving out are already removed from here,
      // and bookmarks that are moving in are added dynamically later.
      if (willMoveTo) {
        return null; // Skip here, will be added to its target folder
      }
      return {
        id: node.id,
        title: node.title || node.url || '',
        isFolder: false,
        url: node.url,
        path: currentPath,
        status: 'normal',
        children: [],
      };
    } else {
      // In "Before" tree, if it's going to move, mark it as 'moved-out'
      return {
        id: node.id,
        title: node.title || node.url || '',
        isFolder: false,
        url: node.url,
        path: currentPath,
        status: willMoveTo ? 'moved-out' : 'normal',
        targetFolder: willMoveTo,
        children: [],
      };
    }
  }
}

/**
 * 构建 Before（整理前）和 After（整理后）的对比树
 */
export function buildCompareTrees(
  rawTree: BookmarkNode[],
  result: CategorizeResult
): { beforeTree: DiffTreeNode; afterTree: DiffTreeNode } {
  const movesMap = new Map<string, string>();
  const bookmarkMap = new Map<string, BookmarkNode>();

  // Helper to collect all leaf bookmarks
  const collectBookmarks = (node: BookmarkNode) => {
    if (node.url) {
      bookmarkMap.set(node.id, node);
    }
    for (const child of node.children ?? []) {
      collectBookmarks(child);
    }
  };
  for (const root of rawTree) {
    collectBookmarks(root);
  }

  for (const m of result.moves) {
    movesMap.set(m.bookmarkId, m.targetFolderPath);
  }

  // 1. Build Before Tree
  const beforeTree = buildDiffTree(rawTree[0], '', movesMap, false)!;

  // 2. Build After Tree
  // Deep clone raw tree first to avoid mutating original
  const afterRawRoot = JSON.parse(JSON.stringify(rawTree[0])) as BookmarkNode;
  const afterTree = buildDiffTree(afterRawRoot, '', movesMap, true)!;

  // Add virtual folders
  const newFoldersSet = new Set(result.newFolders);
  const findOrCreateFolderInDiffTree = (root: DiffTreeNode, path: string): DiffTreeNode => {
    if (root.path === path) return root;

    const parts = path.split(' / ');
    const rootParts = root.path.split(' / ');
    
    // Check if path starts with root.path
    const isPrefix = rootParts.every((part, idx) => parts[idx] === part);
    if (!isPrefix) return root;

    // Find next level folder title
    const nextLevelTitle = parts[rootParts.length];
    const nextLevelPath = `${root.path} / ${nextLevelTitle}`;

    let childFolder = root.children.find((c) => c.isFolder && c.path === nextLevelPath);
    if (!childFolder) {
      childFolder = {
        id: `virtual-${Math.random()}`,
        title: nextLevelTitle,
        isFolder: true,
        path: nextLevelPath,
        status: newFoldersSet.has(nextLevelPath) ? 'created' : 'normal',
        children: [],
      };
      root.children.push(childFolder);
    }

    return findOrCreateFolderInDiffTree(childFolder, path);
  };

  // Ensure all new folders exist in After tree
  for (const folderPath of result.newFolders) {
    findOrCreateFolderInDiffTree(afterTree, folderPath);
  }

  // Insert moved bookmarks into their target folders in After tree
  for (const m of result.moves) {
    const bookmarkNode = bookmarkMap.get(m.bookmarkId);
    if (!bookmarkNode) continue;

    const targetFolder = findOrCreateFolderInDiffTree(afterTree, m.targetFolderPath);
    targetFolder.children.push({
      id: bookmarkNode.id,
      title: bookmarkNode.title || bookmarkNode.url || '',
      isFolder: false,
      url: bookmarkNode.url,
      path: `${targetFolder.path} / ${bookmarkNode.title || bookmarkNode.url}`,
      status: 'moved-in',
      children: [],
    });
  }

  // Recursively sort children to keep folders at top, bookmarks at bottom
  const sortDiffTree = (node: DiffTreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.title.localeCompare(b.title);
    });
    for (const child of node.children) {
      sortDiffTree(child);
    }
  };
  sortDiffTree(beforeTree);
  sortDiffTree(afterTree);

  return { beforeTree, afterTree };
}

/**
 * 执行书签重新整理
 */
export async function executeCategorization(
  result: CategorizeResult,
  onProgress?: (step: string) => void
): Promise<void> {
  if (!ext?.bookmarks) {
    throw new Error('未检测到浏览器书签 API 权限。');
  }

  onProgress?.('正在分析目录结构...');
  const tree = await getBookmarkTree();
  
  // 1. Build a map of existing folder path -> Chrome ID
  const folderPathMap = new Map<string, string>();
  
  const walk = (node: BookmarkNode, parentPath = '') => {
    if (node.url) return;
    const currentName = node.title || (node.id === '0' ? '全部书签' : '未命名文件夹');
    const currentPath = node.id === '0' ? '全部书签' : parentPath ? `${parentPath} / ${currentName}` : currentName;
    folderPathMap.set(currentPath, node.id);
    for (const child of node.children ?? []) {
      walk(child, currentPath);
    }
  };
  walk(tree[0]);

  // Record original folders to clean empty folders later
  const originalFolders = new Set<string>();
  folderPathMap.forEach((id, path) => {
    if (id !== '0' && id !== '1' && id !== '2' && id !== '3') {
      originalFolders.add(id);
    }
  });

  // 2. Create missing folders (from shallowest to deepest)
  onProgress?.('正在创建新文件夹目录...');
  const sortedNewFolders = [...result.newFolders].sort((a, b) => {
    return a.split(' / ').length - b.split(' / ').length;
  });

  for (const folderPath of sortedNewFolders) {
    if (folderPathMap.has(folderPath)) continue;

    const parts = folderPath.split(' / ');
    const title = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join(' / ');
    const parentId = folderPathMap.get(parentPath);

    if (!parentId) {
      throw new Error(`无法创建文件夹 "${folderPath}"：未找到父级 "${parentPath}" 的 ID。`);
    }

    const created = await ext.bookmarks.create({
      parentId,
      title,
    });
    if (!created) {
      throw new Error(`创建文件夹失败: ${folderPath}`);
    }
    folderPathMap.set(folderPath, created.id);
  }

  // 3. Move bookmarks
  onProgress?.('正在移动书签到目标目录...');
  let movedCount = 0;
  for (const move of result.moves) {
    const targetFolderId = folderPathMap.get(move.targetFolderPath);
    if (!targetFolderId) {
      console.warn(`未找到目标文件夹 ID，跳过移动: ${move.targetFolderPath}`);
      continue;
    }
    try {
      await ext.bookmarks.move(move.bookmarkId, {
        parentId: targetFolderId,
      });
      movedCount++;
    } catch (err) {
      console.error(`移动书签失败: ID=${move.bookmarkId}`, err);
    }
  }

  // 4. Safely clean up folders that became empty
  onProgress?.('正在清理变为空的旧目录...');
  const freshTree = await getBookmarkTree();
  
  // Find all empty folders from freshTree
  const emptyFolderIds: string[] = [];
  const findEmpty = (node: BookmarkNode) => {
    if (node.url) return false;
    
    // Check if children are empty or lead to empty folders
    let isEmpty = true;
    for (const child of node.children ?? []) {
      const childIsEmpty = findEmpty(child);
      if (!childIsEmpty) {
        isEmpty = false;
      }
    }

    if (node.children?.length === 0) {
      isEmpty = true;
    }

    // Only delete if it was an original folder and it is now empty
    if (isEmpty && originalFolders.has(node.id)) {
      emptyFolderIds.push(node.id);
    }
    return isEmpty;
  };
  findEmpty(freshTree[0]);

  // Remove empty folders
  for (const id of emptyFolderIds) {
    try {
      await ext.bookmarks.remove(id);
    } catch (err) {
      console.warn(`删除空文件夹失败: ID=${id}`, err);
    }
  }

  onProgress?.('整理完成！');
}
