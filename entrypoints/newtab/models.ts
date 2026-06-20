export type NavTab = 'home' | 'bookmarks' | 'two-factor' | 'backup' | 'settings' | 'ai-assistant';

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
  customBgUrl?: string;
  bgBlur?: number;
  bgOpacity?: number;
  aiProvider: 'none' | 'openai' | 'anthropic';
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
}

export interface FavoritesState {
  favorites: string[];
}

export interface CloudSyncSettings {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
}

export interface CloudSyncMetadata {
  deviceId: string;
  localVersion: number;
  localUpdatedAt: number;
  lastSyncedLocalVersion: number;
  lastRemoteVersion: number;
}

export interface CloudSyncFavoriteSite {
  title: string;
  url: string;
}

export interface CloudSyncData {
  settings: AppSettings;
  favoriteSites: CloudSyncFavoriteSite[];
}

export interface CloudSyncPayload {
  app: 'kuntab';
  schemaVersion: 1;
  remoteVersion: number;
  updatedAt: number;
  updatedByDeviceId: string;
  data: CloudSyncData;
}

export type CloudSyncConflictChoice = 'remote' | 'local' | 'cancel';

export interface TwoFactorEntry {
  id: string;
  platform: string;
  account: string;
  secret: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface TwoFactorVaultData {
  entries: TwoFactorEntry[];
}

export interface EncryptedTwoFactorVault {
  app: 'kuntab';
  type: 'two-factor-vault';
  schemaVersion: 1;
  updatedAt: number;
  entryCount: number;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  ciphertext: string;
  passphraseHint?: string;
}

export interface TwoFactorSyncMetadata {
  deviceId: string;
  localVersion: number;
  localUpdatedAt: number;
  lastSyncedLocalVersion: number;
  lastRemoteVersion: number;
}

export interface TwoFactorCloudPayload {
  app: 'kuntab';
  type: 'two-factor-sync';
  schemaVersion: 1;
  remoteVersion: number;
  updatedAt: number;
  updatedByDeviceId: string;
  vault: EncryptedTwoFactorVault;
}

export type TwoFactorCloudConflictChoice = 'remote' | 'local' | 'cancel';

export interface BackupFavoriteSite {
  title: string;
  url: string;
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
  version: 2;
  exportedAt: number;
  tree: BookmarkBackupNode[];
  favoriteSites: BackupFavoriteSite[];
  settings: AppSettings;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cardType?: 'moves' | 'duplicates' | 'recommendations' | 'summary' | 'emptyFolders';
  cardData?: any;
}
