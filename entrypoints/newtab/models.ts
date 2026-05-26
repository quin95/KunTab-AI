export type NavTab = 'home' | 'bookmarks' | 'backup' | 'settings';

export type ThemeMode = 'light' | 'dark' | 'system';
export type SearchEngineId = 'google' | 'baidu' | 'bing' | 'github' | 'chatgpt' | 'youtube';
export type StartPage = 'home' | 'bookmarks';
export type FontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
  theme: ThemeMode;
  searchEngine: SearchEngineId;
  startPage: StartPage;
  compactMode: boolean;
  fontSize: FontSize;
  language: 'zh-CN' | 'en-US';
}

export interface FavoritesState {
  favorites: string[];
}

export interface RecentOpenItem {
  id: string;
  title: string;
  url: string;
  openedAt: number;
}

export interface FlatBookmark {
  id: string;
  parentId?: string;
  title: string;
  url: string;
  folderId?: string;
  folderName: string;
  folderPath: string;
  dateAdded?: number;
}

export interface FolderNode {
  id: string;
  title: string;
  path: string;
  bookmarkCount: number;
  children: FolderNode[];
}

export interface FolderOption {
  id: string;
  label: string;
  count: number;
}

export interface BookmarkBackupNode {
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkBackupNode[];
}

export interface BackupData {
  app: 'kuntab';
  version: 1;
  exportedAt: number;
  tree: BookmarkBackupNode[];
  favorites: string[];
  settings: AppSettings;
}
