import { useEffect, useMemo, useState } from 'react';
import type {
  AppSettings,
  BackupData,
  FlatBookmark,
  FolderNode,
  FolderOption,
  NavTab,
} from './models';
import {
  clearAppCache,
  DEFAULT_SETTINGS,
  getFavorites,
  getRecentOpens,
  getSettings,
  pushRecentOpen,
  setFavorites,
  updateSettings,
  watchSettings,
  setRecentOpensStorage,
} from './lib/storage';
import {
  type BookmarkNode,
  buildFolderTree,
  collectBookmarksInFolder,
  createFolder,
  deleteBookmark,
  deleteFolderTree,
  flattenBookmarks,
  flattenFolderOptions,
  getBookmarkTree,
  moveBookmark,
  updateBookmark,
  watchBookmarkChanges,
} from './lib/bookmarks';
import {
  applyBackupConfig,
  buildBackup,
  downloadHtmlBackup,
  downloadJsonBackup,
  importBackupTree,
  parseBackupJson,
} from './lib/backup';
import { getEngineById, parseSearchCommand, SEARCH_ENGINES } from './lib/search';
import { faviconOf, formatDateTime, formatRelativeTime, greetingByTime, hostnameOf } from './lib/utils';
import {
  Bell,
  Bookmark,
  CircleArrowDown,
  CircleArrowUp,
  Clock,
  Cog,
  Folder,
  FolderPlus,
  Globe,
  Grid3X3,
  Home,
  Info,
  Languages,
  Monitor,
  Moon,
  MoreVertical,
  Palette,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Type,
  Plus,
  ChevronRight,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';
import './newtab.css';
import logoImg from '../../assets/logo.png';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;
const SEARCH_ENGINE_HOSTS: Record<string, string> = {
  google: 'google.com',
  baidu: 'baidu.com',
  bing: 'bing.com',
  github: 'github.com',
  chatgpt: 'chatgpt.com',
  youtube: 'youtube.com',
};

const LOCALE_TEXT = {
  'zh-CN': {
    navHome: '首页',
    navBookmarks: '书签',
    navBackup: '备份',
    navSettings: '设置',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    pageHomeDesc: '高效管理书签，从这里开始',
    pageBookmarksDesc: '现代化管理你的所有书签',
    pageBackupDesc: '导出和恢复书签配置',
    pageSettingsDesc: '自定义你的使用体验和应用偏好',
    searchHint: '支持书签搜索和命令搜索（g/bd/b/gh/ai/yt）',
    searchPlaceholder: '搜索书签或输入命令，快速访问或搜索全网...',
    search: '搜索',
    favorites: '常用网站',
    manageFavorites: '管理常用',
    remove: '移除',
    addSite: '添加网站',
    recentOpen: '最近打开',
    viewMore: '查看更多',
    recentEmpty: '暂无记录，打开书签后会自动记录。',
    bookmarkSearchPlaceholder: '搜索书签（支持标题、网址）',
    newFolder: '新建文件夹',
    importExport: '导入 / 导出',
    folders: '文件夹',
    allBookmarks: '全部书签',
    title: '标题',
    url: '网址',
    parentFolder: '所属文件夹',
    addedAt: '添加时间',
    actions: '操作',
    open: '打开书签',
    openInTab: '新标签打开',
    edit: '编辑书签',
    setFavorite: '设为常用',
    noMatchedBookmarks: '没有匹配的书签',
    backupExportTitle: '导出备份',
    backupExportDesc: '将当前所有书签配置导出为 JSON 文件',
    backupTip1: '包含所有文件夹和书签',
    backupTip2: '包含常用网站配置和设置项',
    backupTip3: '可用于备份或迁移到其他浏览器',
    exportJson: '导出为 JSON 文件',
    exportHtml: '导出为 HTML 文件',
    backupImportTitle: '导入备份',
    backupImportDesc: '从 JSON 文件导入书签配置',
    importToFolder: '导入到文件夹',
    chooseJson: '选择 JSON 文件',
    importing: '导入中...',
    importLimit: '支持 .json 格式文件，最大 10MB',
    backupNotice: '备份文件将保存到你的本地设备，请妥善保管。当前版本不会上传或保存备份记录，所有备份操作均在本地完成。',
    generalSettings: '通用设置',
    language: '语言',
    defaultEngine: '默认搜索引擎',
    startupPage: '启动时打开',
    appearanceSettings: '外观设置',
    themeMode: '主题模式',
    followSystem: '跟随系统',
    compactMode: '紧凑布局',
    fontSize: '字体大小',
    misc: '其他',
    clearLocalCache: '清除本地数据',
    clearData: '清除数据',
    about: '关于 KunTab',
    currentVersion: '当前版本 1.0.0',
    editBookmark: '编辑书签',
    folder: '所属文件夹',
    cancel: '取消',
    save: '保存',
    addFavoriteSite: '添加常用网站',
    favoriteSearchPlaceholder: '搜索书签标题或网址',
    noSitesToAdd: '没有可添加的书签',
    close: '关闭',
    confirmDeleteBookmark: '确认删除书签「{title}」吗？',
    deletedBookmark: '已删除书签：{title}',
    promptFolderName: '请输入新文件夹名称',
    noParentFolder: '当前没有可用的父文件夹',
    folderCreated: '文件夹「{title}」已创建',
    confirmDeleteFolder: '确认删除文件夹「{title}」及其全部内容吗？',
    deletedFolder: '已删除文件夹：{title}',
    emptyTitleOrUrl: '标题和 URL 不能为空',
    updatedBookmark: '已更新书签：{title}',
    selectImportFolder: '请先选择导入位置',
    importTooLarge: '文件过大，请选择 10MB 以内的 JSON 文件',
    importDone: '导入完成：新增 {added} 条，跳过 {skipped} 条',
    importFailed: '导入失败',
    exportedJson: '已导出 JSON 备份文件',
    exportedHtml: '已导出 HTML 备份文件',
    confirmClearCache: '确认清除本地数据并重置插件设置吗？（不会删除 Chrome 书签）',
    clearedCache: '已清除缓存并重置插件设置',
    langZh: '简体中文',
    langEn: 'English',
    sizeSmall: '较小',
    sizeMedium: '中等（默认）',
    sizeLarge: '较大',
    deleteFolder: '删除文件夹',
    more: '更多',
  },
  'en-US': {
    navHome: 'Home',
    navBookmarks: 'Bookmarks',
    navBackup: 'Backup',
    navSettings: 'Settings',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    pageHomeDesc: 'Efficient bookmark management starts here',
    pageBookmarksDesc: 'Manage all bookmarks in one place',
    pageBackupDesc: 'Export and restore your bookmark setup',
    pageSettingsDesc: 'Customize your experience and preferences',
    searchHint: 'Supports bookmark search and command search (g/bd/b/gh/ai/yt)',
    searchPlaceholder: 'Search bookmarks or use a command, e.g. g react hooks',
    search: 'Search',
    favorites: 'Favorites',
    manageFavorites: 'Manage',
    remove: 'Remove',
    addSite: 'Add Site',
    recentOpen: 'Recently Opened',
    viewMore: 'View More',
    recentEmpty: 'No recent records yet. Open bookmarks to start tracking.',
    bookmarkSearchPlaceholder: 'Search bookmarks (title / URL)',
    newFolder: 'New Folder',
    importExport: 'Import / Export',
    folders: 'Folders',
    allBookmarks: 'All Bookmarks',
    title: 'Title',
    url: 'URL',
    parentFolder: 'Folder',
    addedAt: 'Added Time',
    actions: 'Actions',
    open: 'Open',
    openInTab: 'Open in New Tab',
    edit: 'Edit',
    setFavorite: 'Set Favorite',
    noMatchedBookmarks: 'No matching bookmarks',
    backupExportTitle: 'Export Backup',
    backupExportDesc: 'Export all bookmark configuration as JSON',
    backupTip1: 'Includes all folders and bookmarks',
    backupTip2: 'Includes favorites and settings',
    backupTip3: 'Can be used to migrate to another browser',
    exportJson: 'Export JSON',
    exportHtml: 'Export HTML',
    backupImportTitle: 'Import Backup',
    backupImportDesc: 'Import JSON and merge into existing bookmarks',
    importToFolder: 'Import To Folder',
    chooseJson: 'Choose JSON File',
    importing: 'Importing...',
    importLimit: 'Supports .json files, recommended up to 10MB',
    backupNotice: 'Backup files are stored locally. Keep them safe. No server upload in this version.',
    generalSettings: 'General Settings',
    language: 'Language',
    defaultEngine: 'Default Search Engine',
    startupPage: 'Startup Page',
    appearanceSettings: 'Appearance',
    themeMode: 'Theme Mode',
    followSystem: 'System',
    compactMode: 'Compact Layout',
    fontSize: 'Font Size',
    misc: 'Misc',
    clearLocalCache: 'Clear Local Cache',
    clearData: 'Clear Data',
    about: 'About KunTab',
    currentVersion: 'Version 1.0.0',
    editBookmark: 'Edit Bookmark',
    folder: 'Folder',
    cancel: 'Cancel',
    save: 'Save',
    addFavoriteSite: 'Add Favorite Site',
    favoriteSearchPlaceholder: 'Search bookmark title or URL',
    noSitesToAdd: 'No bookmarks available to add',
    close: 'Close',
    confirmDeleteBookmark: 'Delete bookmark "{title}"?',
    deletedBookmark: 'Deleted bookmark: {title}',
    promptFolderName: 'Enter new folder name',
    noParentFolder: 'No available parent folder',
    folderCreated: 'Folder "{title}" created',
    confirmDeleteFolder: 'Delete folder "{title}" and all its contents?',
    deletedFolder: 'Deleted folder: {title}',
    emptyTitleOrUrl: 'Title and URL cannot be empty',
    updatedBookmark: 'Updated bookmark: {title}',
    selectImportFolder: 'Please select an import folder',
    importTooLarge: 'File is too large. Please select a JSON file within 10MB',
    importDone: 'Import completed: added {added}, skipped {skipped}',
    importFailed: 'Import failed',
    exportedJson: 'JSON backup exported',
    exportedHtml: 'HTML backup exported',
    confirmClearCache: 'Clear local cache and reset extension preferences? (Chrome bookmarks will not be deleted)',
    clearedCache: 'Cache cleared and preferences reset',
    langZh: '简体中文',
    langEn: 'English',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    deleteFolder: 'Delete folder',
    more: 'More',
  },
} as const;

async function openUrl(url: string) {
  try {
    if (ext?.tabs?.create) {
      await ext.tabs.create({ url, active: true });
      return;
    }
  } catch {
    // noop, fallback below
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function App() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  const [bookmarkTree, setBookmarkTree] = useState<BookmarkNode[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [allBookmarks, setAllBookmarks] = useState<FlatBookmark[]>([]);

  const [selectedFolderId, setSelectedFolderId] = useState<string>('0');
  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [recentOpens, setRecentOpens] = useState<Array<{ id: string; title: string; url: string; openedAt: number }>>([]);

  const [homeQuery, setHomeQuery] = useState('');
  const [bookmarkQuery, setBookmarkQuery] = useState('');
  const [message, setMessage] = useState('');

  const [editTarget, setEditTarget] = useState<FlatBookmark | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editFolderId, setEditFolderId] = useState('');

  const [showFavoritePicker, setShowFavoritePicker] = useState(false);
  const [favoriteSearch, setFavoriteSearch] = useState('');
  const [showRecentOpensModal, setShowRecentOpensModal] = useState(false);
  const [recentSearch, setRecentSearch] = useState('');
  const [dragFavoriteId, setDragFavoriteId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOverFavoriteId, setDragOverFavoriteId] = useState<string | null>(null);

  const [backupFolderId, setBackupFolderId] = useState('');
  const [importing, setImporting] = useState(false);

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Bookmarks Table Row Menu State
  const [activeActionRowId, setActiveActionRowId] = useState<string | null>(null);

  const text = LOCALE_TEXT[settings.language] as Record<string, string>;
  const fmt = (tpl: string, vars: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

  const navItems: Array<{ tab: NavTab; label: string; icon: typeof Home }> = [
    { tab: 'home', label: text.navHome, icon: Home },
    { tab: 'bookmarks', label: text.navBookmarks, icon: Bookmark },
    { tab: 'backup', label: text.navBackup, icon: CircleArrowDown },
    { tab: 'settings', label: text.navSettings, icon: Settings },
  ];

  const engineIconUrl = (engineId: string) =>
    `https://www.google.com/s2/favicons?domain=${SEARCH_ENGINE_HOSTS[engineId] ?? 'google.com'}&sz=32`;

  const navTitle = (tab: NavTab) => {
    switch (tab) {
      case 'home':
        return text.navHome;
      case 'bookmarks':
        return text.navBookmarks;
      case 'backup':
        return text.navBackup;
      case 'settings':
        return text.navSettings;
      default:
        return '';
    }
  };

  const reloadBookmarks = async () => {
    const tree = await getBookmarkTree();
    const folders = buildFolderTree(tree);
    const options = flattenFolderOptions(folders);
    const flat = flattenBookmarks(tree);

    setBookmarkTree(tree);
    setFolderTree(folders);
    setFolderOptions(options);
    setAllBookmarks(flat);

    if (!backupFolderId && options[0]?.id) {
      setBackupFolderId(options[0].id);
    }
  };

  const reloadStorage = async () => {
    const [savedSettings, savedFavorites, recent] = await Promise.all([
      getSettings(),
      getFavorites(),
      getRecentOpens(),
    ]);
    setSettingsState(savedSettings);
    setFavoritesState(savedFavorites.favorites);
    setRecentOpens(recent);

    if (savedSettings.startPage === 'bookmarks') {
      setActiveTab('bookmarks');
    }
  };

  // Reset pagination on folder/search change
  useEffect(() => {
    setCurrentPage(1);
    setActiveActionRowId(null);
  }, [selectedFolderId, bookmarkQuery]);

  useEffect(() => {
    reloadBookmarks();
    reloadStorage();

    const offBookmark = watchBookmarkChanges(() => {
      reloadBookmarks();
    });

    const offSettings = watchSettings((next) => {
      setSettingsState(next);
    });

    // Close action menu when clicking elsewhere
    const handleGlobalClick = () => {
      setActiveActionRowId(null);
    };
    document.addEventListener('click', handleGlobalClick);

    // Keyboard navigation listener for Bookmarks search input shortcut "/"
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        const searchInput = document.querySelector('.bookmark-search-wrap input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      offBookmark();
      offSettings();
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme;

    root.dataset.theme = resolvedTheme;
    root.dataset.fontSize = settings.fontSize;
  }, [settings.theme, settings.fontSize]);

  const bookmarksInSelectedFolder = useMemo(() => {
    const list = collectBookmarksInFolder(bookmarkTree, selectedFolderId);
    if (!bookmarkQuery.trim()) return list;

    const query = bookmarkQuery.trim().toLowerCase();
    return list.filter((bookmark) => {
      return bookmark.title.toLowerCase().includes(query) || bookmark.url.toLowerCase().includes(query);
    });
  }, [bookmarkTree, selectedFolderId, bookmarkQuery]);

  // Paginated List
  const paginatedBookmarks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return bookmarksInSelectedFolder.slice(startIndex, startIndex + pageSize);
  }, [bookmarksInSelectedFolder, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(bookmarksInSelectedFolder.length / pageSize));
  }, [bookmarksInSelectedFolder, pageSize]);

  const paginationItems = useMemo(() => {
    const items: Array<{ type: 'page' | 'ellipsis'; pageNum?: number }> = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        items.push({ type: 'page', pageNum: i });
      } else {
        if (items[items.length - 1]?.type !== 'ellipsis') {
          items.push({ type: 'ellipsis' });
        }
      }
    }
    return items;
  }, [totalPages, currentPage]);

  const folderCount = useMemo(() => {
    return folderOptions.length;
  }, [folderOptions]);

  const favoriteBookmarks = useMemo(() => {
    const map = new Map(allBookmarks.map((bookmark) => [bookmark.id, bookmark]));
    return favorites.map((id) => map.get(id)).filter((bookmark): bookmark is FlatBookmark => Boolean(bookmark));
  }, [allBookmarks, favorites]);

  const favoriteGridColumns = useMemo(() => {
    const total = favoriteBookmarks.length + 1;
    if (total <= 8) return total;

    let bestCols = 8;
    let bestScore = -1;

    for (let cols = 8; cols >= 5; cols--) {
      const rows = Math.ceil(total / cols);
      const lastRowItems = total % cols || cols;

      // Avoid leaving only 1 item on the last row
      if (lastRowItems === 1 && rows > 1) {
        continue;
      }

      // Prefer columns that fill the last row as much as possible
      if (lastRowItems > bestScore) {
        bestScore = lastRowItems;
        bestCols = cols;
      }
    }
    return bestCols;
  }, [favoriteBookmarks.length]);

  const homeSearchMatches = useMemo(() => {
    const query = homeQuery.trim().toLowerCase();
    if (!query) return [];
    const withoutCommand = parseSearchCommand(query).query.toLowerCase();
    if (!withoutCommand) return [];
    return allBookmarks
      .filter((bookmark) => {
        return bookmark.title.toLowerCase().includes(withoutCommand) || bookmark.url.toLowerCase().includes(withoutCommand);
      })
      .slice(0, 8);
  }, [allBookmarks, homeQuery]);

  const favoritePickerMatches = useMemo(() => {
    const query = favoriteSearch.trim().toLowerCase();
    const source = allBookmarks.filter((bookmark) => !favorites.includes(bookmark.id));
    if (!query) return source.slice(0, 20);
    return source
      .filter((bookmark) => {
        return bookmark.title.toLowerCase().includes(query) || bookmark.url.toLowerCase().includes(query);
      })
      .slice(0, 20);
  }, [allBookmarks, favoriteSearch, favorites]);

  const filteredRecentOpens = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    if (!query) return recentOpens;
    return recentOpens.filter(
      (item) => item.title.toLowerCase().includes(query) || item.url.toLowerCase().includes(query)
    );
  }, [recentOpens, recentSearch]);

  const saveSettingsPatch = async (patch: Partial<AppSettings>) => {
    const next = await updateSettings(patch);
    setSettingsState(next);
  };

  const syncFavorites = async (next: string[]) => {
    setFavoritesState(next);
    await setFavorites({ favorites: next });
  };

  const onOpenBookmark = async (bookmark: FlatBookmark, inNewTab = true) => {
    if (inNewTab) {
      openUrl(bookmark.url);
    } else {
      window.location.href = bookmark.url;
    }

    const record = {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      openedAt: Date.now(),
    };
    await pushRecentOpen(record);
    setRecentOpens((prev) => [record, ...prev.filter((item) => item.id !== bookmark.id)].slice(0, 40));
  };

  const onRemoveRecentOpen = async (bookmarkId: string, openedAt: number) => {
    const next = recentOpens.filter((item) => !(item.id === bookmarkId && item.openedAt === openedAt));
    setRecentOpens(next);
    await setRecentOpensStorage(next);
  };

  const onClearRecentOpens = async () => {
    if (!window.confirm('确定要清空所有的最近打开记录吗？')) return;
    setRecentOpens([]);
    await setRecentOpensStorage([]);
    showToast('已清空最近打开记录');
  };

  const onSearchSubmit = () => {
    const trimmed = homeQuery.trim();
    if (!trimmed) return;

    const parsed = parseSearchCommand(trimmed);
    if (parsed.engine && parsed.query) {
      openUrl(parsed.engine.buildUrl(parsed.query));
      return;
    }

    if (homeSearchMatches.length > 0) {
      onOpenBookmark(homeSearchMatches[0]);
      return;
    }

    const engine = getEngineById(settings.searchEngine);
    openUrl(engine.buildUrl(parsed.query || trimmed));
  };

  const onMoveFavorite = async (bookmarkId: string, direction: -1 | 1) => {
    const currentIndex = favorites.findIndex((id) => id === bookmarkId);
    if (currentIndex < 0) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= favorites.length) return;

    const next = [...favorites];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    await syncFavorites(next);
  };

  const onDropFavorite = async (targetId: string) => {
    if (!dragFavoriteId || dragFavoriteId === targetId) return;
    const sourceIndex = favorites.findIndex((id) => id === dragFavoriteId);
    const targetIndex = favorites.findIndex((id) => id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const next = [...favorites];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    await syncFavorites(next);
    setDragFavoriteId(null);
  };

  const onAddFavorite = async (bookmarkId: string) => {
    if (favorites.includes(bookmarkId)) return;
    await syncFavorites([...favorites, bookmarkId]);
  };

  const onRemoveFavorite = async (bookmarkId: string) => {
    await syncFavorites(favorites.filter((id) => id !== bookmarkId));
  };

  const onDeleteBookmark = async (bookmark: FlatBookmark) => {
    if (!window.confirm(fmt(text.confirmDeleteBookmark, { title: bookmark.title }))) return;
    await deleteBookmark(bookmark.id);
    await syncFavorites(favorites.filter((id) => id !== bookmark.id));
    showToast(fmt(text.deletedBookmark, { title: bookmark.title }));
  };

  const onCreateFolder = async () => {
    const title = window.prompt(text.promptFolderName);
    if (!title?.trim()) return;

    const parentId = selectedFolderId === '0' ? folderOptions[0]?.id : selectedFolderId;
    if (!parentId) {
      showToast(text.noParentFolder);
      return;
    }

    await createFolder(parentId, title.trim());
    showToast(fmt(text.folderCreated, { title: title.trim() }));
  };

  const onDeleteFolder = async (folder: FolderNode) => {
    if (folder.id === '0') return;
    if (!window.confirm(fmt(text.confirmDeleteFolder, { title: folder.title }))) return;
    await deleteFolderTree(folder.id);
    if (selectedFolderId === folder.id) {
      setSelectedFolderId('0');
    }
    showToast(fmt(text.deletedFolder, { title: folder.title }));
  };

  const openEditDialog = (bookmark: FlatBookmark) => {
    setEditTarget(bookmark);
    setEditTitle(bookmark.title);
    setEditUrl(bookmark.url);
    setEditFolderId(bookmark.parentId || selectedFolderId);
  };

  const saveEditDialog = async () => {
    if (!editTarget) return;
    const trimmedTitle = editTitle.trim();
    const trimmedUrl = editUrl.trim();

    if (!trimmedTitle || !trimmedUrl) {
      showToast(text.emptyTitleOrUrl);
      return;
    }

    await updateBookmark(editTarget.id, {
      title: trimmedTitle,
      url: trimmedUrl,
    });

    if (editFolderId && editFolderId !== editTarget.parentId) {
      await moveBookmark(editTarget.id, { parentId: editFolderId });
    }

    showToast(fmt(text.updatedBookmark, { title: trimmedTitle }));
    setEditTarget(null);
  };

  const onImportBackupFile = async (file: File) => {
    if (!backupFolderId) {
      showToast(text.selectImportFolder);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(text.importTooLarge);
      return;
    }

    try {
      setImporting(true);
      const content = await file.text();
      const backup: BackupData = parseBackupJson(content);

      const { added, skipped } = await importBackupTree(backupFolderId, backup.tree);
      await applyBackupConfig(backup.settings, { favorites: backup.favorites || [] });
      await reloadStorage();
      showToast(fmt(text.importDone, { added, skipped }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : text.importFailed;
      showToast(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  const onExportBackup = async (kind: 'json' | 'html') => {
    const backup = await buildBackup(settings, { favorites });
    if (kind === 'json') {
      downloadJsonBackup(backup);
      showToast(text.exportedJson);
      return;
    }

    downloadHtmlBackup(backup);
    showToast(text.exportedHtml);
  };

  const onClearLocalCache = async () => {
    if (!window.confirm(text.confirmClearCache)) return;
    await clearAppCache();
    await reloadStorage();
    showToast(text.clearedCache);
  };

  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => {
      setMessage((current) => (current === msg ? '' : current));
    }, 4000);
  };

  // Determine dynamic Tag design for parent Folder Column
  const getFolderTagClass = (folderName: string) => {
    if (!folderName || folderName === '全部书签') return 'folder-pill tag-default';
    if (folderName.includes('开发') || folderName.includes('Code') || folderName.includes('Dev')) {
      return 'folder-pill tag-dev';
    }
    if (folderName.includes('工具') || folderName.includes('Tool')) {
      return 'folder-pill tag-tool';
    }
    if (folderName.includes('设计') || folderName.includes('Design')) {
      return 'folder-pill tag-design';
    }
    if (folderName.includes('娱乐') || folderName.includes('学习') || folderName.includes('Study')) {
      return 'folder-pill tag-ent';
    }
    return 'folder-pill tag-default';
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoImg} alt="Logo" className="brand-logo" />
          <div className="brand-text">KunTab</div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                className={activeTab === item.tab ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveTab(item.tab)}
              >
                <Icon className="nav-item-icon" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="dark-mode-toggle"
            onClick={() => saveSettingsPatch({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          >
            <div className="dark-mode-toggle-left">
              <Moon size={18} />
              <span>深色模式</span>
            </div>
          </button>
        </div>
      </aside>

      <main className="content">




        {message && (
          <div className="toast-inline" role="status">
            {message}
            <button onClick={() => setMessage('')} aria-label="close">
              ×
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="scenic-bg" />
        )}

        {activeTab === 'home' && (
          <section className="home-page">
            <div className="hero">
              <div className="hero-left">
                <h2>{greetingByTime(settings.language)} 👋</h2>
                <p>{text.pageHomeDesc || text.searchHint}</p>
              </div>

            </div>

            <div className="search-card">
              <div className="search-row">
                <div className="search-input-wrap">
                  <Search size={18} />
                  <input
                    value={homeQuery}
                    onChange={(event) => setHomeQuery(event.target.value)}
                    placeholder={text.searchPlaceholder}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onSearchSubmit();
                      }
                    }}
                  />
                  <select
                    className="search-engine-select"
                    value={settings.searchEngine}
                    onChange={(event) => saveSettingsPatch({ searchEngine: event.target.value as AppSettings['searchEngine'] })}
                  >
                    {SEARCH_ENGINES.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="primary search-btn-circle" onClick={onSearchSubmit} aria-label={text.search}>
                  <Search size={18} />
                </button>
              </div>

              <div className="quick-engines">
                {SEARCH_ENGINES.map((engine) => (
                  <button key={engine.id} onClick={() => openUrl(engine.buildUrl(parseSearchCommand(homeQuery).query || homeQuery || 'bookmark ai'))}>
                    <img src={engineIconUrl(engine.id)} alt="" />
                    {engine.label}
                  </button>
                ))}
                <button onClick={() => setActiveTab('settings')}>
                  <Grid3X3 size={15} />
                  {text.more}
                </button>
              </div>

              {homeSearchMatches.length > 0 && (
                <div className="suggestion-list">
                  {homeSearchMatches.map((bookmark) => (
                    <button key={bookmark.id} onClick={() => onOpenBookmark(bookmark)}>
                      <img src={faviconOf(bookmark.url)} alt="" />
                      <span>{bookmark.title}</span>
                      <span className={getFolderTagClass(bookmark.folderName)}>
                        {bookmark.folderName || '全部书签'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <section className="panel">
              <div className="panel-head">
                <h3>
                  {text.favorites}
                </h3>
                <button className="text-link-btn" onClick={() => setShowFavoritePicker(true)}>
                  {text.manageFavorites} <ChevronRight size={14} />
                </button>
              </div>
              <div
                className={`favorite-grid custom-columns${activeDragId ? ' dragging-active' : ''}`}
                style={{ '--fav-cols': favoriteGridColumns } as React.CSSProperties}
              >
                {favoriteBookmarks.map((bookmark) => (
                  <div
                    className={`favorite-card${activeDragId === bookmark.id ? ' dragging' : ''}${dragOverFavoriteId === bookmark.id ? ' drag-over' : ''}`}
                    key={bookmark.id}
                    draggable
                    onDragStart={() => {
                      setDragFavoriteId(bookmark.id);
                      setTimeout(() => {
                        setActiveDragId(bookmark.id);
                      }, 0);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (dragFavoriteId && dragFavoriteId !== bookmark.id) {
                        setDragOverFavoriteId(bookmark.id);
                      }
                    }}
                    onDragLeave={() => setDragOverFavoriteId(null)}
                    onDrop={() => {
                      onDropFavorite(bookmark.id);
                      setDragOverFavoriteId(null);
                    }}
                    onDragEnd={() => {
                      setDragFavoriteId(null);
                      setActiveDragId(null);
                      setDragOverFavoriteId(null);
                    }}
                  >
                    <button
                      className="favorite-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(bookmark.id);
                      }}
                      title={text.remove}
                    >
                      ×
                    </button>
                    <a className="favorite-main" href={bookmark.url} onClick={(e) => {
                      e.preventDefault();
                      onOpenBookmark(bookmark);
                    }}>
                      <img src={faviconOf(bookmark.url)} alt="" />
                      <strong>{bookmark.title}</strong>
                      <small>{hostnameOf(bookmark.url)}</small>
                    </a>
                  </div>
                ))}
                <button className="favorite-add" onClick={() => setShowFavoritePicker(true)}>
                  <Plus size={24} />
                  <span>{text.addSite}</span>
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>
                  {text.recentOpen}
                </h3>
                <button className="text-link-btn" onClick={() => setShowRecentOpensModal(true)}>
                  {text.viewMore} <ChevronRight size={14} />
                </button>
              </div>
              <div className="recent-grid">
                {recentOpens.slice(0, 5).map((item) => (
                  <button className="recent-card" key={`${item.id}-${item.openedAt}`} onClick={() => openUrl(item.url)}>
                    <img src={faviconOf(item.url)} alt="" />
                    <div className="recent-card-info">
                      <strong>{item.title}</strong>
                      <small>{hostnameOf(item.url)}</small>
                      <time>{formatRelativeTime(item.openedAt)}</time>
                    </div>
                  </button>
                ))}
                {recentOpens.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}>{text.recentEmpty}</div>}
              </div>
            </section>

            <footer className="footer">
              <span>© 2026 KunTab. 让书签管理更高效</span>
            </footer>
          </section>
        )}

        {activeTab === 'bookmarks' && (
          <section className="bookmark-page">
            <div className="bookmark-toolbar">
              <div className="bookmark-search-wrap">
                <Search size={16} />
                <input
                  value={bookmarkQuery}
                  onChange={(event) => setBookmarkQuery(event.target.value)}
                  placeholder={text.bookmarkSearchPlaceholder}
                />
                <kbd className="kbd-shortcut">/</kbd>
              </div>
              <button className="outlined-primary" onClick={onCreateFolder}>
                <FolderPlus size={16} />
                {text.newFolder}
              </button>
              <button onClick={() => setActiveTab('backup')}>
                <CircleArrowDown size={16} />
                {text.importExport}
              </button>
              <button className="icon-circle-btn" style={{ width: '2.3rem', height: '2.3rem', borderRadius: '12px' }}>
                <MoreVertical size={16} />
              </button>
            </div>

            <div className="bookmark-layout">
              <aside className="folder-tree">
                <div className="folder-head">
                  <div className="folder-head-left">
                    <Folder size={16} />
                    <span>{text.folders}</span>
                  </div>
                  <button className="folder-add-btn" onClick={onCreateFolder} title={text.newFolder}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="folder-list-scroll">
                  <div className={selectedFolderId === '0' ? 'folder-row active' : 'folder-row'}>
                    <button className="folder-select" onClick={() => setSelectedFolderId('0')}>
                      <div className="folder-label-wrap">
                        <Bookmark size={15} />
                        <span>{text.allBookmarks}</span>
                      </div>
                      <span className="count-badge">{allBookmarks.length}</span>
                    </button>
                  </div>
                  <FolderTree
                    nodes={folderTree}
                    selectedId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                    onDelete={onDeleteFolder}
                    deleteTitle={text.deleteFolder}
                  />
                </div>
                <div className="folder-summary-card">
                  共 {folderCount} 个文件夹
                </div>
              </aside>

              <section className="bookmark-table-wrap">
                <table className={settings.compactMode ? 'bookmark-table compact' : 'bookmark-table'}>
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input type="checkbox" className="bookmark-table-checkbox" disabled />
                      </th>
                      <th className="col-title">{text.title}</th>
                      <th className="col-url">{text.url}</th>
                      <th className="col-folder">{text.parentFolder}</th>
                      <th className="col-date">{text.addedAt}</th>
                      <th className="col-actions">{text.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookmarks.map((bookmark) => (
                      <tr key={bookmark.id}>
                        <td className="col-checkbox">
                          <input type="checkbox" className="bookmark-table-checkbox" disabled />
                        </td>
                        <td className="col-title">
                          <div className="bookmark-title-cell">
                            <img src={faviconOf(bookmark.url)} alt="" />
                            <span title={bookmark.title}>{bookmark.title}</span>
                          </div>
                        </td>
                        <td className="col-url">
                          <a className="bookmark-url-link" href={bookmark.url} target="_blank" rel="noreferrer">
                            {hostnameOf(bookmark.url)}
                          </a>
                        </td>
                        <td className="col-folder">
                          <span className={getFolderTagClass(bookmark.folderName)}>
                            {bookmark.folderName || '-'}
                          </span>
                        </td>
                        <td className="col-date">{formatDateTime(bookmark.dateAdded)}</td>
                        <td className="col-actions" style={{ position: 'relative' }}>
                          <button
                            className="action-trigger-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveActionRowId(activeActionRowId === bookmark.id ? null : bookmark.id);
                            }}
                            aria-label="bookmark actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeActionRowId === bookmark.id && (
                            <div className="action-menu-dropdown" style={{ right: '40px', top: '10px' }} onClick={(e) => e.stopPropagation()}>
                              <button className="action-menu-item" onClick={() => { onOpenBookmark(bookmark, false); setActiveActionRowId(null); }}>
                                <Globe size={14} />
                                {text.open}
                              </button>
                              <button className="action-menu-item" onClick={() => { onOpenBookmark(bookmark, true); setActiveActionRowId(null); }}>
                                <ExternalLink size={14} />
                                {text.openInTab}
                              </button>
                              <button className="action-menu-item" onClick={() => { openEditDialog(bookmark); setActiveActionRowId(null); }}>
                                <Type size={14} />
                                {text.edit}
                              </button>
                              <button className="action-menu-item" onClick={() => { onAddFavorite(bookmark.id); setActiveActionRowId(null); }}>
                                <Star size={14} />
                                {text.setFavorite}
                              </button>
                              <button className="action-menu-item danger-item" onClick={() => { onDeleteBookmark(bookmark); setActiveActionRowId(null); }}>
                                <Trash2 size={14} />
                                {text.remove}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {bookmarksInSelectedFolder.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty-row-container">
                          <Search size={32} />
                          <div>{text.noMatchedBookmarks}</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {bookmarksInSelectedFolder.length > 0 && (
                  <div className="pagination-footer">
                    <div>共 {bookmarksInSelectedFolder.length} 项</div>
                    <div className="pagination-controls">
                      <button
                        className={currentPage === 1 ? 'pagination-btn disabled' : 'pagination-btn'}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        &lt;
                      </button>

                      {/* Simple responsive page indices rendering */}
                      {paginationItems.map((item, idx) => {
                        if (item.type === 'ellipsis') {
                          return <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>;
                        }
                        const pageNum = item.pageNum!;
                        return (
                          <button
                            key={pageNum}
                            className={currentPage === pageNum ? 'pagination-btn active' : 'pagination-btn'}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        className={currentPage === totalPages ? 'pagination-btn disabled' : 'pagination-btn'}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        &gt;
                      </button>

                      <select
                        className="pagination-size-select"
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setCurrentPage(1);
                        }}
                      >
                        <option value="10">10 条/页</option>
                        <option value="20">20 条/页</option>
                        <option value="50">50 条/页</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {activeTab === 'backup' && (
          <section className="backup-page">
            <div className="backup-panels">
              <article className="backup-card">
                <div className="backup-card-icon-container export-blue">
                  <CircleArrowDown size={32} />
                </div>
                <h3>{text.backupExportTitle}</h3>
                <p className="backup-card-desc">{text.backupExportDesc}</p>
                <div className="backup-features-list">
                  <div className="backup-feature-item export-item">
                    <Check size={16} />
                    <span>{text.backupTip1}</span>
                  </div>
                  <div className="backup-feature-item export-item">
                    <Check size={16} />
                    <span>{text.backupTip2}</span>
                  </div>
                  <div className="backup-feature-item export-item">
                    <Check size={16} />
                    <span>{text.backupTip3}</span>
                  </div>
                </div>
                <div className="button-row" style={{ width: '100%' }}>
                  <button className="primary backup-btn export-btn" onClick={() => onExportBackup('json')}>
                    <CircleArrowUp size={16} />
                    {text.exportJson}
                  </button>
                </div>
              </article>

              <article className="backup-card">
                <div className="backup-card-icon-container import-green">
                  <CircleArrowUp size={32} />
                </div>
                <h3>{text.backupImportTitle}</h3>
                <p className="backup-card-desc">{text.backupImportDesc}</p>
                <div className="backup-folder-field">
                  <label>{text.importToFolder}</label>
                  <select value={backupFolderId} onChange={(event) => setBackupFolderId(event.target.value)}>
                    {folderOptions.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.label} ({folder.count})
                      </option>
                    ))}
                  </select>
                </div>
                <label className={importing ? 'upload disabled backup-btn import-btn' : 'upload backup-btn import-btn'}>
                  <CircleArrowDown size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {importing ? text.importing : text.chooseJson}
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={importing}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        onImportBackupFile(file);
                      }
                      event.target.value = '';
                    }}
                  />
                </label>
                <div className="import-subtext">{text.importLimit}</div>
              </article>
            </div>

            <div className="note-box">
              <Info className="note-box-icon" size={20} />
              <div className="note-box-content">
                <div className="note-box-title">温馨提示</div>
                <div className="note-box-desc">{text.backupNotice}</div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="settings-page">
            <article className="settings-card">
              <h3>{text.generalSettings}</h3>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Languages size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.language}</span>
                    <span className="setting-desc">选择应用显示语言</span>
                  </div>
                </div>
                <select
                  value={settings.language}
                  onChange={(event) => saveSettingsPatch({ language: event.target.value as AppSettings['language'] })}
                >
                  <option value="zh-CN">{text.langZh}</option>
                  <option value="en-US">{text.langEn}</option>
                </select>
              </div>

              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Search size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.defaultEngine}</span>
                    <span className="setting-desc">选择在搜索框中使用的默认搜索引擎</span>
                  </div>
                </div>
                <select
                  value={settings.searchEngine}
                  onChange={(event) => saveSettingsPatch({ searchEngine: event.target.value as AppSettings['searchEngine'] })}
                >
                  {SEARCH_ENGINES.map((engine) => (
                    <option key={engine.id} value={engine.id}>
                      {engine.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Home size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.startupPage}</span>
                    <span className="setting-desc">选择应用启动时显示的页面</span>
                  </div>
                </div>
                <div className="startup-radio-group">
                  <label className="startup-radio-label">
                    <input
                      type="radio"
                      name="startupPage"
                      checked={settings.startPage === 'home'}
                      onChange={() => saveSettingsPatch({ startPage: 'home' })}
                    />
                    <span>{text.navHome}</span>
                  </label>
                  <label className="startup-radio-label">
                    <input
                      type="radio"
                      name="startupPage"
                      checked={settings.startPage === 'bookmarks'}
                      onChange={() => saveSettingsPatch({ startPage: 'bookmarks' })}
                    />
                    <span>{text.navBookmarks}</span>
                  </label>
                </div>
              </div>
            </article>

            <article className="settings-card">
              <h3>{text.appearanceSettings}</h3>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Palette size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.themeMode}</span>
                    <span className="setting-desc">选择应用的主题外观</span>
                  </div>
                </div>
                <div className="segmented-control">
                  <button
                    className={settings.theme === 'light' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ theme: 'light' })}
                  >
                    <Sun size={14} />
                    {text.light}
                  </button>
                  <button
                    className={settings.theme === 'dark' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ theme: 'dark' })}
                  >
                    <Moon size={14} />
                    {text.dark}
                  </button>
                  <button
                    className={settings.theme === 'system' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ theme: 'system' })}
                  >
                    <Monitor size={14} />
                    {text.followSystem}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Grid3X3 size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.compactMode}</span>
                    <span className="setting-desc">在列表和卡片中使用更紧凑的布局</span>
                  </div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.compactMode}
                    onChange={(event) => saveSettingsPatch({ compactMode: event.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Type size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.fontSize}</span>
                    <span className="setting-desc">调整应用中文字的大小</span>
                  </div>
                </div>
                <select
                  value={settings.fontSize}
                  onChange={(event) => saveSettingsPatch({ fontSize: event.target.value as AppSettings['fontSize'] })}
                >
                  <option value="small">{text.sizeSmall}</option>
                  <option value="medium">{text.sizeMedium}</option>
                  <option value="large">{text.sizeLarge}</option>
                </select>
              </div>
            </article>

            <article className="settings-card">
              <h3>{text.misc}</h3>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Trash2 size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.clearLocalCache}</span>
                    <span className="setting-desc">清除应用的本地缓存和设置（不会删除书签数据）</span>
                  </div>
                </div>
                <button className="setting-btn-danger" onClick={onClearLocalCache}>
                  <Trash2 size={14} />
                  {text.clearData}
                </button>
              </div>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Info size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.about}</span>
                    <span className="setting-desc">版本号与相关说明</span>
                  </div>
                </div>
                <div className="about-row-right">
                  <span>{text.currentVersion}</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            </article>

            <div className="settings-feedback-footer">
              <span>有任何问题或建议？欢迎通过反馈与我们联系</span>
              <a href="#feedback">
                反馈建议 <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '2px' }} />
              </a>
            </div>
          </section>
        )}
      </main>

      {/* Edit Bookmark Modal */}
      {editTarget && (
        <div className="modal-mask" onClick={() => setEditTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{text.editBookmark}</h3>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>{text.title}</label>
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
              </div>
              <div className="modal-field">
                <label>URL</label>
                <input value={editUrl} onChange={(event) => setEditUrl(event.target.value)} />
              </div>
              <div className="modal-field">
                <label>{text.folder}</label>
                <select value={editFolderId} onChange={(event) => setEditFolderId(event.target.value)}>
                  {folderOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setEditTarget(null)}>{text.cancel}</button>
              <button className="primary" onClick={saveEditDialog}>
                {text.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites picker modal */}
      {showFavoritePicker && (
        <div className="modal-mask" onClick={() => setShowFavoritePicker(false)}>
          <div className="modal-card large favorite-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{text.addFavoriteSite}</h3>
            </div>
            <div className="modal-body">
              <div className="bookmark-search-wrap favorite-search-wrap">
                <Search size={18} />
                <input
                  value={favoriteSearch}
                  onChange={(event) => setFavoriteSearch(event.target.value)}
                  placeholder={text.favoriteSearchPlaceholder}
                />
              </div>
              <div className="picker-list">
                {favoritePickerMatches.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    onClick={() => {
                      onAddFavorite(bookmark.id);
                      setShowFavoritePicker(false);
                      setFavoriteSearch('');
                    }}
                  >
                    <img src={faviconOf(bookmark.url)} alt="" />
                    <span className="picker-title">{bookmark.title}</span>
                    <small>{bookmark.folderName}</small>
                  </button>
                ))}
                {favoritePickerMatches.length === 0 && <div className="empty">{text.noSitesToAdd}</div>}
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowFavoritePicker(false);
                  setFavoriteSearch('');
                }}
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recently Opened modal */}
      {showRecentOpensModal && (
        <div className="modal-mask" onClick={() => setShowRecentOpensModal(false)}>
          <div className="modal-card large recent-opens-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-row">
                <h3>最近打开的历史记录</h3>
                {recentOpens.length > 0 && (
                  <button className="text-danger-link-btn" onClick={onClearRecentOpens}>
                    <Trash2 size={14} />
                    <span>清除全部</span>
                  </button>
                )}
              </div>
            </div>
            <div className="modal-body">
              <div className="bookmark-search-wrap recent-search-wrap">
                <Search size={18} />
                <input
                  value={recentSearch}
                  onChange={(event) => setRecentSearch(event.target.value)}
                  placeholder="搜索最近打开的网页..."
                />
              </div>
              <div className="recent-modal-list">
                {filteredRecentOpens.map((item) => (
                  <div className="recent-modal-row" key={`${item.id}-${item.openedAt}`}>
                    <a
                      className="recent-modal-link"
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        openUrl(item.url);
                      }}
                    >
                      <img src={faviconOf(item.url)} alt="" className="recent-modal-favicon" />
                      <div className="recent-modal-info">
                        <strong title={item.title}>{item.title}</strong>
                        <small title={item.url}>{hostnameOf(item.url)}</small>
                      </div>
                    </a>
                    <div className="recent-modal-actions">
                      <span className="recent-modal-time">{formatRelativeTime(item.openedAt)}</span>
                      <button
                        className="recent-modal-delete-btn"
                        onClick={() => onRemoveRecentOpen(item.id, item.openedAt)}
                        title="从历史中删除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {filteredRecentOpens.length === 0 && (
                  <div className="empty" style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)' }}>
                    无匹配的历史记录
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowRecentOpensModal(false);
                  setRecentSearch('');
                }}
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderTree({
  nodes,
  selectedId,
  onSelect,
  onDelete,
  deleteTitle,
}: {
  nodes: FolderNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (folder: FolderNode) => void;
  deleteTitle: string;
}) {
  const list = useMemo(() => {
    const root = nodes.find((node) => node.id === '0');
    return root ? root.children : nodes;
  }, [nodes]);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderNode = (node: FolderNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedFolders[node.id] ?? false;

    return (
      <div key={node.id}>
        <div
          className={selectedId === node.id ? 'folder-row active' : 'folder-row'}
          style={{ paddingLeft: `${depth * 10}px` }}
        >
          <div className="folder-select" onClick={() => onSelect(node.id)}>
            <div className="folder-label-wrap">
              {hasChildren ? (
                <button
                  style={{ border: 0, padding: 0, background: 'transparent', display: 'flex', color: 'inherit' }}
                  onClick={(e) => toggleExpand(node.id, e)}
                  aria-label="toggle expand"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span style={{ width: '14px' }}></span>
              )}
              <Folder size={14} />
              <span>{node.title}</span>
            </div>
            <span className="count-badge">{node.bookmarkCount}</span>
          </div>
          {node.id !== '0' && (
            <button className="folder-delete" onClick={() => onDelete(node)} title={deleteTitle}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return <div>{list.map((node) => renderNode(node))}</div>;
}
