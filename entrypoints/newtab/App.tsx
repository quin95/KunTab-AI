import { useEffect, useMemo, useState } from 'react';
import type {
  AppSettings,
  BackupData,
  FlatBookmark,
  FolderNode,
  FolderOption,
  NavTab,
  ChatMessage,
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
  getStorageSize,
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
  Image,
  Sparkles,
  Sliders,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Square,
  ArrowUp,
  SendHorizontal,
} from 'lucide-react';
import { testAi, chat } from './lib/ai';
import { buildCompareTrees, executeCategorization, serializeBookmarkContext, type DiffTreeNode } from './lib/aiBookmark';
import './newtab.css';
import logoImg from '../../assets/logo.png';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;
const extensionVersion = (() => {
  try {
    return ext?.runtime?.getManifest?.()?.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
})();

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
    navHome: '主页中心',
    navBookmarks: '书签管理',
    navBackup: '备份恢复',
    navSettings: '系统设置',
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
    customBgUrl: '自定义背景图',
    customBgUrlDesc: '输入背景图片的 URL 地址，清除输入框可恢复默认背景',
    bgBlur: '背景模糊度',
    bgBlurDesc: '调整背景图片的模糊程度以提升文本可读性',
    bgOpacity: '背景遮罩浓度',
    bgOpacityDesc: '增加半透明遮罩以降低背景干扰，强化内容对比',
    followSystem: '跟随系统',
    compactMode: '紧凑布局',
    fontSize: '字体大小',
    misc: '其他',
    clearLocalCache: '清除本地数据',
    clearData: '清除数据',
    about: '关于 KunTab',
    currentVersion: `当前版本 ${extensionVersion}`,
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
    navAiAssistant: '智能助理',
    pageAiAssistantDesc: '与 AI 智能助手对话，支持书签分类、去重清理、相关网站推荐以及领域收藏总结',
    aiSettingsTitle: 'AI 助手设置',
    aiProvider: 'AI 服务商',
    aiProviderNone: '未启用',
    aiModel: '模型名称',
    aiBaseUrl: 'Base URL (API 接口地址)',
    aiApiKey: 'API Key (密钥)',
    aiApiKeyPlaceholder: '请输入 API 密钥，如为本地服务 Ollama 等可留空',
    aiBaseUrlPlaceholder: '默认 API 地址，可填 OpenAI 兼容的中转/自建代理地址',
    aiTestConnection: '测试连接',
    aiTesting: '测试中...',
    aiTestSuccess: '连接成功',
    aiTestFailed: '连接失败',
    aiSettingsNotice: '支持任何 OpenAI 兼容的 API 中转（如 DeepSeek/Kimi/Ollama 等）。所有的请求均在本地发送，不会向我们的服务器上传您的任何密钥或书签数据。',
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
    customBgUrl: 'Custom Background Image',
    customBgUrlDesc: 'Enter a background image URL. Clear to restore default',
    bgBlur: 'Background Blur',
    bgBlurDesc: 'Adjust background blur to improve readability of text',
    bgOpacity: 'Background Mask Opacity',
    bgOpacityDesc: 'Add a semi-transparent mask to reduce background clutter',
    followSystem: 'System',
    compactMode: 'Compact Layout',
    fontSize: 'Font Size',
    misc: 'Misc',
    clearLocalCache: 'Clear Local Cache',
    clearData: 'Clear Data',
    about: 'About KunTab',
    currentVersion: `Version ${extensionVersion}`,
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
    navAiAssistant: 'AI Assistant',
    pageAiAssistantDesc: 'Chat with AI Assistant to categorize bookmarks, clean duplicates, recommend sites, or summarize interests',
    aiSettingsTitle: 'AI Assistant Settings',
    aiProvider: 'AI Provider',
    aiProviderNone: 'Disabled',
    aiModel: 'Model Name',
    aiBaseUrl: 'Base URL',
    aiApiKey: 'API Key',
    aiApiKeyPlaceholder: 'Enter API Key or Token',
    aiBaseUrlPlaceholder: 'Leave blank for default, or enter OpenAI-compatible proxy URL',
    aiTestConnection: 'Test Connection',
    aiTesting: 'Testing...',
    aiTestSuccess: 'Connected',
    aiTestFailed: 'Connection Failed',
    aiSettingsNotice: 'Supports any OpenAI-compatible API endpoints (e.g. DeepSeek, Kimi, Ollama). All requests are sent directly from your browser. Your keys and bookmarks are never uploaded to our servers.',
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
  const [cacheSize, setCacheSize] = useState('0 B');
  const [bgUrlInput, setBgUrlInput] = useState(settings.customBgUrl || '');

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
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [subTab, setSubTab] = useState<'all' | 'web' | 'folder'>('all');

  // Bookmarks Table Row Menu State
  const [activeActionRowId, setActiveActionRowId] = useState<string | null>(null);

  // AI Connection State
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // AI Bookmark Assistant Page State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState('');
  const [chatGenerating, setChatGenerating] = useState(false);
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);

  // States for embedded operations
  const [executingCardId, setExecutingCardId] = useState<string | null>(null);
  const [cardErrorMessage, setCardErrorMessage] = useState<Record<string, string>>({});
  const [cardSuccessMessage, setCardSuccessMessage] = useState<Record<string, string>>({});
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, string[]>>({});
  const [compareTreeExpanded, setCompareTreeExpanded] = useState<Record<string, boolean>>({});

  const toggleCompareFolder = (id: string) => {
    setCompareTreeExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const text = LOCALE_TEXT[settings.language] as Record<string, string>;
  const fmt = (tpl: string, vars: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

  const navItems: Array<{ tab: NavTab; label: string; icon: typeof Home }> = [
    { tab: 'home', label: text.navHome, icon: Home },
    { tab: 'bookmarks', label: text.navBookmarks, icon: Bookmark },
    { tab: 'ai-assistant', label: text.navAiAssistant, icon: Sparkles },
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
      case 'ai-assistant':
        return text.navAiAssistant;
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
    const [savedSettings, savedFavorites, recent, size] = await Promise.all([
      getSettings(),
      getFavorites(),
      getRecentOpens(),
      getStorageSize(),
    ]);
    setSettingsState(savedSettings);
    setFavoritesState(savedFavorites.favorites);
    setRecentOpens(recent);
    setCacheSize(size);

    if (savedSettings.startPage === 'bookmarks') {
      setActiveTab('bookmarks');
    }
  };

  // Reset pagination on folder/search/subTab change
  useEffect(() => {
    setCurrentPage(1);
    setActiveActionRowId(null);
  }, [selectedFolderId, bookmarkQuery, subTab]);

  // Clear search query when changing folders
  useEffect(() => {
    setBookmarkQuery('');
  }, [selectedFolderId]);

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

    return () => {
      offBookmark();
      offSettings();
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      getStorageSize().then(setCacheSize);
    }
  }, [activeTab]);

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

  useEffect(() => {
    setBgUrlInput(settings.customBgUrl || '');
  }, [settings.customBgUrl]);

  // Auto scroll chat history to bottom
  useEffect(() => {
    if (activeTab === 'ai-assistant') {
      const scrollEl = document.getElementById('chat-history-scroll');
      if (scrollEl) {
        requestAnimationFrame(() => {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        });
      }
    }
  }, [chatMessages, chatGenerating, activeTab]);

  const currentBookmarkNode = useMemo(() => {
    if (selectedFolderId === '0') return null;
    const findNode = (nodes: BookmarkNode[]): BookmarkNode | null => {
      for (const n of nodes) {
        if (n.id === selectedFolderId) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(bookmarkTree);
  }, [bookmarkTree, selectedFolderId]);

  const currentFolderName = useMemo(() => {
    if (selectedFolderId === '0') return '全部书签';
    return currentBookmarkNode?.title || '未命名文件夹';
  }, [currentBookmarkNode, selectedFolderId]);

  const selectedFolderNode = useMemo(() => {
    const findNode = (nodes: FolderNode[]): FolderNode | null => {
      for (const n of nodes) {
        if (n.id === selectedFolderId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(folderTree);
  }, [folderTree, selectedFolderId]);


  const displayItems = useMemo(() => {
    const countBookmarksInNode = (node: BookmarkNode): number => {
      if (node.url) return 1;
      return (node.children ?? []).reduce((sum, child) => sum + countBookmarksInNode(child), 0);
    };

    const toFlatBookmark = (node: BookmarkNode, folderName: string): FlatBookmark => ({
      id: node.id,
      parentId: node.parentId,
      title: node.title || node.url || '',
      url: node.url || '',
      folderName,
      folderPath: '',
      dateAdded: node.dateAdded,
    });

    const query = bookmarkQuery.trim().toLowerCase();

    // Case 1: Search is active (recursively search folders and/or webpages depending on subTab)
    if (query) {
      let searchRoots: BookmarkNode[] = [];
      if (selectedFolderId === '0') {
        searchRoots = bookmarkTree;
      } else {
        const findNode = (nodes: BookmarkNode[]): BookmarkNode | null => {
          for (const n of nodes) {
            if (n.id === selectedFolderId) return n;
            if (n.children) {
              const found = findNode(n.children);
              if (found) return found;
            }
          }
          return null;
        };
        const found = findNode(bookmarkTree);
        if (found) {
          searchRoots = [found];
        }
      }

      const folders: any[] = [];
      const webpages: FlatBookmark[] = [];

      const walk = (
        node: BookmarkNode,
        folderPath: string,
        folderId: string | undefined,
        folderName: string,
        isRootOfSearch: boolean
      ) => {
        if (node.url) {
          const match = node.title?.toLowerCase().includes(query) || node.url.toLowerCase().includes(query);
          if (match) {
            webpages.push({
              id: node.id,
              parentId: node.parentId,
              title: node.title || node.url,
              url: node.url,
              folderId,
              folderName,
              folderPath,
              dateAdded: node.dateAdded,
            });
          }
          return;
        }

        const selfName = node.title || (node.id === '0' ? '根目录' : '未命名文件夹');
        const nextPath = folderPath ? `${folderPath} / ${selfName}` : selfName;
        const nextFolderId = node.id === '0' ? folderId : node.id;

        if (!isRootOfSearch && node.id !== '0') {
          const match = selfName.toLowerCase().includes(query);
          if (match) {
            folders.push({
              id: node.id,
              title: selfName,
              isFolder: true as const,
              bookmarkCount: countBookmarksInNode(node),
            });
          }
        }

        for (const child of node.children ?? []) {
          walk(child, nextPath, nextFolderId, selfName, false);
        }
      };

      for (const root of searchRoots) {
        const parentName = root.id === '0' ? '全部书签' : root.title || '未命名文件夹';
        walk(root, '', root.id, parentName, true);
      }

      if (subTab === 'all') {
        return [...folders, ...webpages.map((w) => ({ ...w, isFolder: false as const }))];
      } else if (subTab === 'web') {
        return webpages.map((w) => ({ ...w, isFolder: false as const }));
      } else if (subTab === 'folder') {
        return folders;
      }
    }

    // Case 2: Normal display
    if (selectedFolderId === '0') {
      if (subTab === 'folder') {
        const rootFolder = folderTree.find((f) => f.id === '0');
        const list = rootFolder ? rootFolder.children : folderTree;
        return list.map((f) => ({
          id: f.id,
          title: f.title,
          isFolder: true as const,
          bookmarkCount: f.bookmarkCount,
        }));
      } else {
        const webpages = collectBookmarksInFolder(bookmarkTree, '0');
        return webpages.map((w) => ({ ...w, isFolder: false as const }));
      }
    } else {
      if (!currentBookmarkNode) return [];
      const children = currentBookmarkNode.children ?? [];
      const out: any[] = [];

      if (subTab === 'all' || subTab === 'folder') {
        const subfolders = children.filter((c) => !c.url);
        out.push(
          ...subfolders.map((f) => ({
            id: f.id,
            title: f.title,
            isFolder: true as const,
            bookmarkCount: countBookmarksInNode(f),
          }))
        );
      }

      if (subTab === 'all' || subTab === 'web') {
        const webpages = children.filter((c) => c.url);
        out.push(...webpages.map((w) => ({ ...toFlatBookmark(w, currentFolderName), isFolder: false as const })));
      }

      return out;
    }
  }, [bookmarkTree, folderTree, selectedFolderId, subTab, bookmarkQuery, currentBookmarkNode, currentFolderName]);

  const bookmarksInSelectedFolder = displayItems;

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
    if (folder.id === '0' || folder.id === '1' || folder.id === '2' || folder.id === '3') return;
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

  const onTestAiConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    const result = await testAi(settings);
    setConnectionResult(result);
    setTestingConnection(false);
  };

  const onSendChatMessage = async (customText?: string) => {
    const enrichDuplicates = (data: any) => {
      if (data && data.duplicates) {
        return {
          ...data,
          duplicates: data.duplicates.map((group: any) => ({
            ...group,
            items: (group.items || []).map((item: any) => {
              const local = allBookmarks.find((b) => String(b.id) === String(item.id));
              if (local) {
                return {
                  ...item,
                  title: local.title || item.title,
                  folderPath: local.folderPath || item.folderPath,
                  dateAdded: local.dateAdded || item.dateAdded,
                };
              }
              return item;
            }),
          })),
        };
      }
      return data;
    };

    const textToSend = (customText || chatInputValue).trim();
    if (!textToSend) return;

    if (settings.aiProvider === 'none' || !settings.aiApiKey) {
      alert('请先在设置中配置并启用 AI 助手。');
      setActiveTab('settings');
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInputValue('');
    setChatGenerating(true);

    const controller = new AbortController();
    setChatAbortController(controller);

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    
    setChatMessages((prev) => [...prev, assistantMsg]);

    try {
      const scopeBookmarks = allBookmarks;
      const serializedContext = serializeBookmarkContext(scopeBookmarks, folderOptions);

      const systemPrompt = `你是一个集成了强大浏览器书签控制能力的 AI 智能助手，名叫 "KunTab AI 智能助手"。
你能够通过分析用户的全部书签/选定文件夹书签，帮助用户整理目录、清理重复、发现兴趣并推荐网站。

【当前用户的书签上下文】：
${serializedContext}

【核心运行机制】：
当用户向你发送指令时，你不仅需要以亲切、口语化的中文进行解释，还需要在回答的最末尾，根据用户的命令意图，附带一个特定格式的 JSON 代码块，以便系统为其渲染交互式功能卡片。

【卡片代码块输出规范】：
请根据用户请求的类型，在回答末尾输出且仅输出以下其中一种代码块格式（三反引号包裹）：

1. 整理书签时 (用户要你分类、整理、归档书签，如点击了“按主题帮我整理书签”或发送类似命令)：
必须输出 \`json-bookmark-moves\` 代码块，只包含需要发生路径改变的书签：
\`\`\`json-bookmark-moves
{
  "newFolders": ["全部书签 / 新分类名", "全部书签 / 新分类名 / 子分类"],
  "moves": [
    { "bookmarkId": "待移动书签的ID", "targetFolderPath": "目标文件夹的路径" }
  ]
}
\`\`\`

2. 查找重复书签时 (用户要你排查、查找、删除重复)：
必须输出 \`json-bookmark-duplicates\` 代码块，按 URL 分组，格式如下：
\`\`\`json-bookmark-duplicates
{
  "duplicates": [
    {
      "url": "重复网址",
      "items": [
        { "id": "书签ID", "title": "书签标题", "folderPath": "所属文件夹路径", "dateAdded": 1716000000000 }
      ]
    }
  ]
}
\`\`\`

3. 推荐网站时 (用户要你推荐网站)：
必须输出 \`json-bookmark-recommendations\` 代码块，格式如下：
\`\`\`json-bookmark-recommendations
{
  "recommendations": [
    { "title": "推荐网站标题", "url": "网址", "desc": "推荐原因/简介", "tag": "分类标签" }
  ]
}
\`\`\`

4. 总结领域时 (用户要你分析其收藏的偏好与结构)：
必须输出 \`json-bookmark-summary\` 块，格式如下：
\`\`\`json-bookmark-summary
{
  "categories": [
    { "name": "领域名称", "count": 12, "percentage": 40 }
  ],
  "totalCount": 30
}
\`\`\`

【注意事项】：
- 所有的 JSON 代码块都必须使用标准的 Markdown 语法（三反引号加对应的语言标识）。
- 绝不要把现有无需移动的书签也写在 \`moves\` 列表中，只写发生变化的书签。
- JSON 数据必须保证能被 JavaScript 的 JSON.parse 成功解析。请确保输出内容不要有多余字符，避免 JSON 解析失败。`;

      const historyList = updatedMessages.map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      const responseText = await chat(
        settings,
        [
          { role: 'system', content: systemPrompt },
          ...historyList,
        ],
        {
          signal: controller.signal,
          onChunk: (text) => {
            let cardType: ChatMessage['cardType'];
            let cardData: any = null;
            let cleanText = text;

            const blockStartIdx = text.indexOf('```json-bookmark-');
            if (blockStartIdx !== -1) {
              cleanText = text.substring(0, blockStartIdx).trim();
              const notice = '\n\n*(正在分析数据并生成交互卡片，请稍候...)*';
              cleanText = cleanText ? cleanText + notice : '*(正在分析数据并生成交互卡片，请稍候...)*';
              
              // Check if completed inside text chunk
              const blockRegex = /```json-bookmark-(moves|duplicates|recommendations|summary)\n([\s\S]*?)\n```/g;
              const match = blockRegex.exec(text);
              if (match) {
                const type = match[1];
                const jsonStr = match[2].trim();
                try {
                  cardData = JSON.parse(jsonStr);
                  if (type === 'duplicates') {
                    cardData = enrichDuplicates(cardData);
                  }
                  cardType = type as ChatMessage['cardType'];
                  // If complete, strip the notice and the code block
                  const cleanBase = text.replace(match[0], '').trim();
                  cleanText = cleanBase;
                } catch (e) {
                  // Incomplete or invalid JSON, keep notice
                }
              }
            }

            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { 
                      ...msg, 
                      content: cleanText,
                      cardType,
                      cardData
                    }
                  : msg
              )
            );
          },
        }
      );

      let cardType: ChatMessage['cardType'];
      let cardData: any = null;
      let cleanText = responseText;

      const blockRegex = /```json-bookmark-(moves|duplicates|recommendations|summary)\n([\s\S]*?)\n```/g;
      const match = blockRegex.exec(responseText);

      if (match) {
        const type = match[1];
        const jsonStr = match[2].trim();
        
        try {
          cardData = JSON.parse(jsonStr);
          if (type === 'duplicates') {
            cardData = enrichDuplicates(cardData);
          }
          cardType = type as ChatMessage['cardType'];
          cleanText = responseText.replace(match[0], '').trim();
        } catch (e) {
          console.error('Failed to parse chat card JSON:', jsonStr, e);
          cleanText = responseText + '\n\n*(提示：助手生成了数据卡片，但 JSON 数据格式损坏，无法显示交互式卡片。)*';
        }
      }

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: cleanText,
                cardType,
                cardData,
              }
            : msg
        )
      );

      if (cardType === 'duplicates' && cardData?.duplicates) {
        const idsToSelect: string[] = [];
        cardData.duplicates.forEach((group: any) => {
          const sorted = [...(group.items || [])].sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
          if (sorted.length > 1) {
            sorted.slice(1).forEach((item) => idsToSelect.push(item.id));
          }
        });
        setDuplicateSelections((prev) => ({ ...prev, [assistantMsgId]: idsToSelect }));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + '\n\n*(已终止生成)*' }
              : msg
          )
        );
      } else {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + `\n\n*(生成错误: ${err?.message || String(err)} )*` }
              : msg
          )
        );
      }
    } finally {
      setChatGenerating(false);
      setChatAbortController(null);
    }
  };

  const onAbortGeneration = () => {
    if (chatAbortController) {
      chatAbortController.abort();
    }
  };

  const onExecuteCardAction = async (cardType: 'moves' | 'duplicates', cardData: any, messageId: string) => {
    setExecutingCardId(messageId);
    setCardErrorMessage((prev) => ({ ...prev, [messageId]: '' }));
    setCardSuccessMessage((prev) => ({ ...prev, [messageId]: '' }));

    try {
      if (cardType === 'moves') {
        await executeCategorization(cardData);
        await reloadBookmarks();
        setCardSuccessMessage((prev) => ({ ...prev, [messageId]: '书签分类整理方案已成功执行！' }));
        showToast('书签分类整理成功！');
      } else if (cardType === 'duplicates') {
        const selectedIds = duplicateSelections[messageId] || [];
        if (selectedIds.length === 0) {
          throw new Error('请先勾选需要清理的重复书签。');
        }
        for (const id of selectedIds) {
          await deleteBookmark(id);
        }
        await reloadBookmarks();
        setCardSuccessMessage((prev) => ({ ...prev, [messageId]: `成功清理了 ${selectedIds.length} 个重复书签！` }));
        showToast('重复书签清理完毕！');
      }
    } catch (err: any) {
      setCardErrorMessage((prev) => ({ ...prev, [messageId]: err?.message || String(err) }));
    } finally {
      setExecutingCardId(null);
    }
  };

  const onAddRecommendedBookmark = async (title: string, url: string, tag: string) => {
    try {
      const defaultParentId = folderOptions[0]?.id || '1';
      const targetFolder = folderOptions.find(
        (f) => f.label === '智能推荐' || f.label.endsWith(' / 智能推荐')
      );
      
      let targetFolderId = targetFolder?.id;
      
      if (!targetFolderId) {
        const createdFolder = await createFolder(defaultParentId, '智能推荐');
        if (createdFolder) {
          targetFolderId = createdFolder.id;
          await reloadBookmarks();
        } else {
          targetFolderId = defaultParentId;
        }
      }

      await ext.bookmarks.create({
        parentId: targetFolderId,
        title,
        url,
      });
      await reloadBookmarks();
      showToast(`已成功保存至「智能推荐」文件夹`);
    } catch (err) {
      alert('添加书签失败，请确认书签 API 权限。');
    }
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
    <div className="app-shell has-scenic-bg">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoImg} alt="Logo" className="brand-logo" />
          <div className="brand-title-wrap">
            <div className="brand-text">KunTab</div>
            <span className="brand-version">v{extensionVersion}</span>
          </div>
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

      <main className={`content ${activeTab === 'bookmarks' ? 'content-bookmarks-fixed' : ''}`}>




        {message && (
          <div className="toast-inline" role="status">
            {message}
            <button onClick={() => setMessage('')} aria-label="close">
              ×
            </button>
          </div>
        )}

        <div
          className="scenic-bg"
          style={{
            ...(settings.customBgUrl ? { backgroundImage: `url(${settings.customBgUrl})` } : {}),
            filter: settings.bgBlur ? `blur(${settings.bgBlur}px)` : undefined,
            transform: settings.bgBlur ? 'scale(1.05)' : undefined,
            ['--bg-opacity-val' as any]: settings.bgOpacity !== undefined ? settings.bgOpacity / 100 : 0,
          }}
        >
          <div className="scenic-bg-overlay" />
        </div>

        {activeTab === 'home' && (
          <section className="home-page">


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
                  <button key={engine.id} onClick={() => openUrl(engine.buildUrl(parseSearchCommand(homeQuery).query || homeQuery || 'KunTab'))}>
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
            <div className="bookmark-layout">
              <aside className="folder-tree">
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
                <div className="folder-sidebar-footer">
                  <button className="folder-add-footer-btn" onClick={onCreateFolder}>
                    <Plus size={16} />
                    <span>{text.newFolder}</span>
                  </button>
                </div>
              </aside>

              <div className="bookmark-main-content">
                <div className="bookmark-top-bar">
                  <div className="bookmark-tabs">
                    <button
                      className={subTab === 'all' ? 'tab-item active' : 'tab-item'}
                      onClick={() => setSubTab('all')}
                    >
                      全部
                    </button>
                    <button
                      className={subTab === 'web' ? 'tab-item active' : 'tab-item'}
                      onClick={() => setSubTab('web')}
                    >
                      网页
                    </button>
                    <button
                      className={subTab === 'folder' ? 'tab-item active' : 'tab-item'}
                      onClick={() => setSubTab('folder')}
                    >
                      文件夹
                    </button>
                  </div>

                  <div className="bookmark-top-actions">
                    <div className="bookmark-search-wrap">
                      <Search size={16} />
                      <input
                        value={bookmarkQuery}
                        onChange={(event) => setBookmarkQuery(event.target.value)}
                        placeholder={text.bookmarkSearchPlaceholder}
                      />
                    </div>
                  </div>
                </div>

                <div className="bookmark-grid">
                  {paginatedBookmarks.map((item) => (
                    item.isFolder ? (
                      <div
                        className="folder-card"
                        key={item.id}
                        onClick={() => setSelectedFolderId(item.id)}
                      >
                        <div className="folder-card-icon-wrap">
                          <Folder size={24} />
                        </div>
                        <div className="folder-card-info">
                          <strong title={item.title}>{item.title}</strong>
                          <small>{item.bookmarkCount} 个书签</small>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`bookmark-card ${activeActionRowId === item.id ? 'menu-open' : ''}`}
                        key={item.id}
                        onClick={() => onOpenBookmark(item, true)}
                      >
                        <div className="bookmark-card-top">
                          <div className="bookmark-card-favicon-wrap">
                            <BookmarkFavicon url={item.url} size={24} />
                          </div>
                          <div className="bookmark-card-actions-wrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="action-trigger-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveActionRowId(activeActionRowId === item.id ? null : item.id);
                              }}
                              aria-label="bookmark actions"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeActionRowId === item.id && (
                              <div className="action-menu-dropdown" style={{ right: '0', top: '2rem' }}>
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    onOpenBookmark(item, false);
                                    setActiveActionRowId(null);
                                  }}
                                >
                                  <Globe size={14} />
                                  {text.open}
                                </button>
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    onOpenBookmark(item, true);
                                    setActiveActionRowId(null);
                                  }}
                                >
                                  <ExternalLink size={14} />
                                  {text.openInTab}
                                </button>
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    openEditDialog(item);
                                    setActiveActionRowId(null);
                                  }}
                                >
                                  <Type size={14} />
                                  {text.edit}
                                </button>
                                <button
                                  className="action-menu-item"
                                  onClick={() => {
                                    onAddFavorite(item.id);
                                    setActiveActionRowId(null);
                                  }}
                                >
                                  <Star size={14} />
                                  {text.setFavorite}
                                </button>
                                <button
                                  className="action-menu-item danger-item"
                                  onClick={() => {
                                    onDeleteBookmark(item);
                                    setActiveActionRowId(null);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  {text.remove}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bookmark-card-info">
                          <strong title={item.title}>{item.title}</strong>
                          <small title={item.url}>{hostnameOf(item.url)}</small>
                        </div>
                      </div>
                    )
                  ))}

                  {bookmarksInSelectedFolder.length === 0 && (
                    <div className="empty-grid-container">
                      <Search size={32} />
                      <div>{text.noMatchedBookmarks}</div>
                    </div>
                  )}
                </div>

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
                          return (
                            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                              ...
                            </span>
                          );
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
                        <option value="12">12 条/页</option>
                        <option value="16">16 条/页</option>
                        <option value="20">20 条/页</option>
                        <option value="40">40 条/页</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
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

        {activeTab === 'ai-assistant' && (
          <section className="ai-chat-container">
            <div className="chat-history" id="chat-history-scroll">
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`chat-message-row ${msg.role}`}>
                    <div className={`chat-avatar ${msg.role}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {isUser ? (
                        <img src={logoImg} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </div>
                    <div className="chat-bubble">
                      {msg.content ? (
                        <MarkdownText text={msg.content} />
                      ) : (
                        chatGenerating && !msg.cardType && chatMessages[chatMessages.length - 1]?.id === msg.id && (
                          <div className="chat-loading-container-inner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="chat-loading-dots">
                              <div></div>
                              <div></div>
                              <div></div>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 500 }}>
                              AI 正在思考并整理书签，请稍候...
                            </span>
                          </div>
                        )
                      )}
                      
                      {msg.cardType === 'moves' && (
                        <RefactorCompareCard
                          cardData={msg.cardData}
                          messageId={msg.id}
                          executingCardId={executingCardId}
                          cardSuccessMessage={cardSuccessMessage}
                          cardErrorMessage={cardErrorMessage}
                          onExecuteCardAction={onExecuteCardAction}
                          bookmarkTree={bookmarkTree}
                          compareTreeExpanded={compareTreeExpanded}
                          toggleCompareFolder={toggleCompareFolder}
                        />
                      )}

                      {msg.cardType === 'duplicates' && (
                        <DuplicateCleanCard
                          cardData={msg.cardData}
                          messageId={msg.id}
                          executingCardId={executingCardId}
                          cardSuccessMessage={cardSuccessMessage}
                          cardErrorMessage={cardErrorMessage}
                          onExecuteCardAction={onExecuteCardAction}
                          duplicateSelections={duplicateSelections}
                          setDuplicateSelections={setDuplicateSelections}
                        />
                      )}

                      {msg.cardType === 'recommendations' && (
                        <RecommendationsCard
                          cardData={msg.cardData}
                          onAddRecommendedBookmark={onAddRecommendedBookmark}
                        />
                      )}

                      {msg.cardType === 'summary' && (
                        <SummaryReportCard
                          cardData={msg.cardData}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Welcome State Capsule Commands */}
              {chatMessages.length === 0 && (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <Sparkles size={24} />
                  </div>
                  <h2>KunTab AI 智能助手</h2>
                  <p>我是你的浏览器书签管家，我可以帮你自动分类、去重清理、推荐新内容或总结你的收藏偏好。</p>
                  
                  <div className="chat-suggest-title">你可以这样问我</div>
                  <div className="chat-suggest-group">
                    <button
                      className="chat-suggest-btn"
                      onClick={() => onSendChatMessage('按主题帮我整理书签')}
                    >
                      <Folder size={16} style={{ color: 'var(--primary)' }} />
                      <span>按主题帮我整理书签</span>
                    </button>
                    <button
                      className="chat-suggest-btn"
                      onClick={() => onSendChatMessage('找出可能重复的书签')}
                    >
                      <Trash2 size={16} style={{ color: '#ef4444' }} />
                      <span>找出可能重复的书签</span>
                    </button>
                    <button
                      className="chat-suggest-btn"
                      onClick={() => onSendChatMessage('根据我的书签推荐相关网站')}
                    >
                      <Globe size={16} style={{ color: '#10b981' }} />
                      <span>根据我的书签推荐相关网站</span>
                    </button>
                    <button
                      className="chat-suggest-btn"
                      onClick={() => onSendChatMessage('总结我最常收藏的领域')}
                    >
                      <Sliders size={16} style={{ color: '#f59e0b' }} />
                      <span>总结我最常收藏的领域</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="chat-input-container">
              <textarea
                className="chat-input-textarea"
                placeholder={settings.aiProvider === 'none' ? '请先配置 AI 助手...' : '给 AI 助手发送消息... (Shift + Enter 换行)'}
                value={chatInputValue}
                disabled={settings.aiProvider === 'none'}
                onChange={(e) => setChatInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatGenerating) {
                      onSendChatMessage();
                    }
                  }
                }}
                rows={1}
              />
              <button
                className={`chat-send-btn ${chatGenerating ? 'stop' : ''}`}
                onClick={chatGenerating ? onAbortGeneration : () => onSendChatMessage()}
                disabled={settings.aiProvider === 'none' || (!chatGenerating && !chatInputValue.trim())}
                title={chatGenerating ? '停止生成' : '发送消息'}
              >
                {chatGenerating ? <Square size={16} /> : <SendHorizontal size={18} />}
              </button>
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
                  <div className="setting-icon-wrap"><Image size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.customBgUrl}</span>
                    <span className="setting-desc">{text.customBgUrlDesc}</span>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="https://example.com/background.jpg"
                  value={bgUrlInput}
                  onChange={(event) => setBgUrlInput(event.target.value)}
                  onBlur={() => saveSettingsPatch({ customBgUrl: bgUrlInput.trim() })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      saveSettingsPatch({ customBgUrl: bgUrlInput.trim() });
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              <div className="settings-row sub-setting-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap" style={{ opacity: 0.6 }}><Sparkles size={16} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.bgBlur}</span>
                    <span className="setting-desc">{text.bgBlurDesc}</span>
                  </div>
                </div>
                <div className="range-control">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={settings.bgBlur ?? 0}
                    onChange={(event) => saveSettingsPatch({ bgBlur: Number(event.target.value) })}
                  />
                  <span className="range-value">{(settings.bgBlur ?? 0)}px</span>
                </div>
              </div>

              <div className="settings-row sub-setting-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap" style={{ opacity: 0.6 }}><Sliders size={16} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.bgOpacity}</span>
                    <span className="setting-desc">{text.bgOpacityDesc}</span>
                  </div>
                </div>
                <div className="range-control">
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={settings.bgOpacity ?? 0}
                    onChange={(event) => saveSettingsPatch({ bgOpacity: Number(event.target.value) })}
                  />
                  <span className="range-value">{(settings.bgOpacity ?? 0)}%</span>
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
              <h3>{text.aiSettingsTitle}</h3>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Sparkles size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">{text.aiProvider}</span>
                    <span className="setting-desc">选择要连接的 AI 大模型服务商</span>
                  </div>
                </div>
                <div className="segmented-control">
                  <button
                    className={settings.aiProvider === 'none' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ aiProvider: 'none' })}
                  >
                    {text.aiProviderNone}
                  </button>
                  <button
                    className={settings.aiProvider === 'openai' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ aiProvider: 'openai' })}
                  >
                    OpenAI
                  </button>
                  <button
                    className={settings.aiProvider === 'anthropic' ? 'segmented-btn active' : 'segmented-btn'}
                    onClick={() => saveSettingsPatch({ aiProvider: 'anthropic' })}
                  >
                    Anthropic
                  </button>
                </div>
              </div>

              {settings.aiProvider !== 'none' && (
                <>
                  <div className="settings-row">
                    <div className="setting-left">
                      <div className="setting-icon-wrap"><Sliders size={18} /></div>
                      <div className="setting-meta">
                        <span className="setting-title">{text.aiModel}</span>
                        <span className="setting-desc">输入对应服务商的模型名称标识</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder={settings.aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-latest'}
                      value={settings.aiModel}
                      onChange={(event) => saveSettingsPatch({ aiModel: event.target.value })}
                    />
                  </div>

                  <div className="settings-row">
                    <div className="setting-left">
                      <div className="setting-icon-wrap"><Globe size={18} /></div>
                      <div className="setting-meta">
                        <span className="setting-title">{text.aiBaseUrl}</span>
                        <span className="setting-desc">{text.aiBaseUrlPlaceholder}</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder={settings.aiProvider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
                      value={settings.aiBaseUrl}
                      onChange={(event) => saveSettingsPatch({ aiBaseUrl: event.target.value })}
                    />
                  </div>

                  <div className="settings-row">
                    <div className="setting-left">
                      <div className="setting-icon-wrap"><Type size={18} /></div>
                      <div className="setting-meta">
                        <span className="setting-title">{text.aiApiKey}</span>
                        <span className="setting-desc">{text.aiApiKeyPlaceholder}</span>
                      </div>
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={settings.aiApiKey}
                      onChange={(event) => saveSettingsPatch({ aiApiKey: event.target.value })}
                    />
                  </div>

                  <div className="settings-row">
                    <div className="setting-left">
                      <div className="setting-icon-wrap"><CheckCircle2 size={18} /></div>
                      <div className="setting-meta">
                        <span className="setting-title">{text.aiTestConnection}</span>
                        <span className="setting-desc">验证当前 AI 的连通性与响应速度</span>
                      </div>
                    </div>
                    <div className="about-row-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {connectionResult && (
                        <span className={`ai-test-badge ${connectionResult.ok ? 'success' : 'failed'}`}>
                          {connectionResult.ok ? (
                            <>
                              <CheckCircle2 size={14} style={{ marginRight: '4px' }} />
                              {text.aiTestSuccess} ({connectionResult.latencyMs}ms)
                            </>
                          ) : (
                            <>
                              <XCircle size={14} style={{ marginRight: '4px' }} />
                              {text.aiTestFailed}
                            </>
                          )}
                        </span>
                      )}
                      <button
                        className="setting-btn-primary"
                        onClick={onTestAiConnection}
                        disabled={testingConnection || !settings.aiApiKey}
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 size={14} className="animate-spin" style={{ marginRight: '4px' }} />
                            {text.aiTesting}
                          </>
                        ) : (
                          text.aiTestConnection
                        )}
                      </button>
                    </div>
                  </div>
                  {connectionResult && !connectionResult.ok && (
                    <div className="ai-test-error-log">
                      {connectionResult.message}
                    </div>
                  )}
                </>
              )}

              <div className="settings-notice-box">
                <Info size={16} />
                <span>{text.aiSettingsNotice}</span>
              </div>
            </article>

            <article className="settings-card">
              <h3>{text.misc}</h3>
              <div className="settings-row">
                <div className="setting-left">
                  <div className="setting-icon-wrap"><Trash2 size={18} /></div>
                  <div className="setting-meta">
                    <span className="setting-title">
                      {text.clearLocalCache}
                      <span className="cache-size-badge">{cacheSize}</span>
                    </span>
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
                    <BookmarkFavicon url={bookmark.url} size={16} />
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
                      <BookmarkFavicon url={item.url} size={20} className="recent-modal-favicon" />
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

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ '1': true });

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
          {node.id !== '0' && node.id !== '1' && node.id !== '2' && node.id !== '3' && (
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

function CompareTreeNode({
  node,
  expandedState,
  toggleExpand,
}: {
  node: DiffTreeNode;
  expandedState: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedState[node.id] ?? true;
  const hasChildren = node.children && node.children.length > 0;

  const renderIcon = () => {
    if (node.isFolder) {
      return <Folder size={14} className="tree-folder-icon" />;
    }
    return (
      <BookmarkFavicon
        url={node.url || ''}
        className="tree-bookmark-favicon"
        size={14}
      />
    );
  };

  const getStatusClass = () => {
    switch (node.status) {
      case 'moved-out':
        return 'node-moved-out';
      case 'moved-in':
        return 'node-moved-in';
      case 'created':
        return 'node-created';
      default:
        return 'node-normal';
    }
  };

  return (
    <div className={`compare-tree-node ${getStatusClass()}`}>
      <div className="node-row" onClick={() => node.isFolder && toggleExpand(node.id)}>
        <span className="node-expand-arrow">
          {node.isFolder && hasChildren && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
          {node.isFolder && !hasChildren && <span style={{ width: 12, display: 'inline-block' }} />}
        </span>
        <span className="node-icon">{renderIcon()}</span>
        <span className="node-title" title={node.title}>
          {node.title}
        </span>
        {node.status === 'moved-out' && (
          <span className="node-badge badge-moved-out">将移至: {node.targetFolder?.split(' / ').pop()}</span>
        )}
        {node.status === 'moved-in' && <span className="node-badge badge-moved-in">移入</span>}
        {node.status === 'created' && <span className="node-badge badge-created">新建</span>}
      </div>
      {node.isFolder && hasChildren && isExpanded && (
        <div className="node-children">
          {node.children.map((child) => (
            <CompareTreeNode
              key={child.id}
              node={child}
              expandedState={expandedState}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  
  let currentBlockType: 'p' | 'ul' | 'ol' | 'blockquote' | 'code' | null = null;
  let currentLines: string[] = [];
  let blockKey = 0;
  let codeLang = '';

  const parseInline = (str: string): React.ReactNode[] => {
    const unionRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|https?:\/\/\S+)/g;
    const tokens = str.split(unionRegex);
    
    return tokens.map((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={idx}>{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('*') && token.endsWith('*')) {
        return <em key={idx}>{token.slice(1, -1)}</em>;
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return <code key={idx}>{token.slice(1, -1)}</code>;
      }
      if (token.startsWith('http://') || token.startsWith('https://')) {
        return (
          <a key={idx} href={token} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            {token}
          </a>
        );
      }
      return token;
    });
  };

  const flushBlock = () => {
    if (currentLines.length === 0) return;

    const key = `block-${blockKey++}`;
    if (currentBlockType === 'code') {
      blocks.push(
        <pre key={key} className="chat-markdown-code-block" style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          padding: '0.85rem',
          overflowX: 'auto',
          margin: '0.5rem 0',
          fontFamily: 'monospace',
          fontSize: '0.85rem'
        }}>
          {codeLang && <div className="code-lang-label" style={{
            fontSize: '0.72rem',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            marginBottom: '0.4rem',
            fontWeight: 700,
            borderBottom: '1px solid var(--line)',
            paddingBottom: '0.2rem'
          }}>{codeLang}</div>}
          <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{currentLines.join('\n')}</code>
        </pre>
      );
    } else if (currentBlockType === 'ul') {
      blocks.push(
        <ul key={key} style={{ margin: '0.5rem 0 0.5rem 1.25rem', listStyleType: 'disc' }}>
          {currentLines.map((line, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>{parseInline(line)}</li>
          ))}
        </ul>
      );
    } else if (currentBlockType === 'ol') {
      blocks.push(
        <ol key={key} style={{ margin: '0.5rem 0 0.5rem 1.25rem', listStyleType: 'decimal' }}>
          {currentLines.map((line, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>{parseInline(line)}</li>
          ))}
        </ol>
      );
    } else if (currentBlockType === 'blockquote') {
      blocks.push(
        <blockquote key={key} style={{
          borderLeft: '4px solid var(--primary)',
          paddingLeft: '1rem',
          color: 'var(--muted)',
          margin: '0.5rem 0',
          fontStyle: 'italic'
        }}>
          {currentLines.map((line, idx) => (
            <p key={idx} style={{ margin: 0 }}>{parseInline(line)}</p>
          ))}
        </blockquote>
      );
    } else {
      currentLines.forEach((line, idx) => {
        blocks.push(
          <p key={`${key}-${idx}`} style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>
            {parseInline(line)}
          </p>
        );
      });
    }

    currentLines = [];
    currentBlockType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (currentBlockType === 'code') {
        flushBlock();
      } else {
        flushBlock();
        currentBlockType = 'code';
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (currentBlockType === 'code') {
      currentLines.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      flushBlock();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = trimmed.replace(/^#+\s*/, '');
      const HeadingTag = `h${Math.min(level + 1, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(
        <HeadingTag key={`h-${i}`} style={{
          fontWeight: 700,
          marginTop: '0.75rem',
          marginBottom: '0.4rem',
          lineHeight: '1.3'
        }}>
          {parseInline(content)}
        </HeadingTag>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      if (currentBlockType !== 'blockquote') {
        flushBlock();
        currentBlockType = 'blockquote';
      }
      currentLines.push(trimmed.slice(1).trim());
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentBlockType !== 'ul') {
        flushBlock();
        currentBlockType = 'ul';
      }
      currentLines.push(trimmed.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (currentBlockType !== 'ol') {
        flushBlock();
        currentBlockType = 'ol';
      }
      currentLines.push(trimmed.replace(/^\d+\.\s/, ''));
      continue;
    }

    if (trimmed === '') {
      flushBlock();
      continue;
    }

    if (currentBlockType !== 'p' && currentBlockType !== null) {
      flushBlock();
    }
    currentBlockType = 'p';
    currentLines.push(line);
  }

  flushBlock();

  return <div className="chat-bubble-text">{blocks}</div>;
}

function RefactorCompareCard({
  cardData,
  messageId,
  executingCardId,
  cardSuccessMessage,
  cardErrorMessage,
  onExecuteCardAction,
  bookmarkTree,
  compareTreeExpanded,
  toggleCompareFolder,
}: {
  cardData: any;
  messageId: string;
  executingCardId: string | null;
  cardSuccessMessage: Record<string, string>;
  cardErrorMessage: Record<string, string>;
  onExecuteCardAction: (cardType: 'moves' | 'duplicates', cardData: any, messageId: string) => Promise<void>;
  bookmarkTree: BookmarkNode[];
  compareTreeExpanded: Record<string, boolean>;
  toggleCompareFolder: (id: string) => void;
}) {
  const compareTrees = useMemo(() => {
    if (!bookmarkTree || bookmarkTree.length === 0 || !cardData) return null;
    try {
      return buildCompareTrees(bookmarkTree, cardData);
    } catch (e) {
      console.error('Error building compare trees:', e);
      return null;
    }
  }, [bookmarkTree, cardData]);

  const isExecuting = executingCardId === messageId;
  const successMsg = cardSuccessMessage[messageId];
  const errMsg = cardErrorMessage[messageId];

  if (!compareTrees) {
    return (
      <div className="chat-custom-card">
        <div className="card-header">
          <span>书签分类整理方案</span>
        </div>
        <div className="card-body">
          <div className="ai-error-box" style={{ margin: 0 }}>
            <XCircle size={16} />
            <span>分类整理方案数据结构有误，无法生成对比视图。</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-custom-card">
      <div className="card-header">
        <span>书签分类整理方案预览</span>
        {cardData.newFolders && cardData.newFolders.length > 0 && (
          <span className="folder-pill tag-design">将新建 {cardData.newFolders.length} 个分类</span>
        )}
      </div>
      <div className="card-body">
        <div className="compare-panels" style={{ maxHeight: '350px', overflowY: 'auto', gridTemplateColumns: '1fr' }}>
          <div className="compare-panel-card" style={{ width: '100%' }}>
            <div className="panel-title-row" style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--line)' }}>
              <strong className="success-text">整理后 (AI 规划结构)</strong>
            </div>
            <div className="tree-scroll-area" style={{ padding: '0.5rem 0' }}>
              <CompareTreeNode
                node={compareTrees.afterTree}
                expandedState={compareTreeExpanded}
                toggleExpand={toggleCompareFolder}
              />
            </div>
          </div>
        </div>

        {errMsg && (
          <div className="ai-error-box" style={{ marginTop: '10px', marginBottom: 0 }}>
            <XCircle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="ai-info-warning-box" style={{ marginTop: '10px', marginBottom: 0, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', color: '#10b981' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
      {!successMsg && (
        <div className="card-footer">
          <button
            className="primary highlight"
            disabled={isExecuting}
            onClick={() => onExecuteCardAction('moves', cardData, messageId)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            {isExecuting ? '正在执行...' : '确认执行书签整理'}
          </button>
        </div>
      )}
    </div>
  );
}

function DuplicateCleanCard({
  cardData,
  messageId,
  executingCardId,
  cardSuccessMessage,
  cardErrorMessage,
  onExecuteCardAction,
  duplicateSelections,
  setDuplicateSelections,
}: {
  cardData: any;
  messageId: string;
  executingCardId: string | null;
  cardSuccessMessage: Record<string, string>;
  cardErrorMessage: Record<string, string>;
  onExecuteCardAction: (cardType: 'moves' | 'duplicates', cardData: any, messageId: string) => Promise<void>;
  duplicateSelections: Record<string, string[]>;
  setDuplicateSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const isExecuting = executingCardId === messageId;
  const successMsg = cardSuccessMessage[messageId];
  const errMsg = cardErrorMessage[messageId];
  const currentSelections = duplicateSelections[messageId] || [];

  const handleToggle = (id: string) => {
    setDuplicateSelections((prev) => {
      const list = prev[messageId] || [];
      const newList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, [messageId]: newList };
    });
  };

  const duplicates = cardData?.duplicates || [];

  if (duplicates.length === 0) {
    return (
      <div className="chat-custom-card">
        <div className="card-header">
          <span>清理重复书签</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>未发现重复书签。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-custom-card">
      <div className="card-header">
        <span>查找重复书签</span>
        <span className="folder-pill tag-dev">共发现 {duplicates.length} 组重复网址</span>
      </div>
      <div className="card-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
        {duplicates.map((group: any, gIdx: number) => (
          <div key={gIdx} className="duplicate-group">
            <div className="duplicate-url-header">{group.url}</div>
            <div className="duplicate-items-list">
              {(group.items || []).map((item: any) => {
                const isChecked = currentSelections.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="duplicate-item-row"
                    onClick={() => !successMsg && handleToggle(item.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!!successMsg}
                      onChange={() => {}}
                      style={{ cursor: successMsg ? 'default' : 'pointer' }}
                    />
                    <div className="duplicate-item-meta">
                      <div className="duplicate-item-title" title={item.title}>
                        {item.title}
                      </div>
                      <div className="duplicate-item-path">
                        <Folder size={12} />
                        <span>{item.folderPath}</span>
                      </div>
                    </div>
                    {item.dateAdded ? (
                      <div className="duplicate-item-time">
                        {formatDateTime(item.dateAdded)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {errMsg && (
          <div className="ai-error-box" style={{ marginTop: '10px', marginBottom: 0 }}>
            <XCircle size={16} />
            <span>{errMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="ai-info-warning-box" style={{ marginTop: '10px', marginBottom: 0, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', color: '#10b981' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {!successMsg && (
        <div className="card-footer">
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', alignSelf: 'center', marginRight: 'auto' }}>
            已勾选 {currentSelections.length} 个书签进行清理
          </span>
          <button
            className="primary stop"
            disabled={isExecuting || currentSelections.length === 0}
            onClick={() => onExecuteCardAction('duplicates', cardData, messageId)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--danger)', color: 'white' }}
          >
            {isExecuting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            {isExecuting ? '正在清理...' : '一键清理选中的重复项'}
          </button>
        </div>
      )}
    </div>
  );
}

function RecommendationsCard({
  cardData,
  onAddRecommendedBookmark,
}: {
  cardData: any;
  onAddRecommendedBookmark: (title: string, url: string, tag: string) => Promise<void>;
}) {
  const [addedUrls, setAddedUrls] = useState<string[]>([]);
  const recommendations = cardData?.recommendations || [];

  const handleAdd = async (title: string, url: string, tag: string) => {
    await onAddRecommendedBookmark(title, url, tag);
    setAddedUrls((prev) => [...prev, url]);
  };

  if (recommendations.length === 0) {
    return (
      <div className="chat-custom-card">
        <div className="card-header">
          <span>推荐相关网站</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>未生成推荐网站列表。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-custom-card">
      <div className="card-header">
        <span>网站推荐网格</span>
        <span className="folder-pill tag-tool">AI 智能推荐</span>
      </div>
      <div className="card-body">
        <div className="rec-grid">
          {recommendations.map((item: any, idx: number) => {
            const isAdded = addedUrls.includes(item.url);
            return (
              <div key={idx} className="rec-item-card">
                <div className="rec-item-header">
                  <BookmarkFavicon
                    url={item.url}
                    className="rec-item-icon"
                    size={24}
                    preferOnline={true}
                  />
                  <div className="rec-item-title-wrap">
                    <div className="rec-item-title" title={item.title}>
                      {item.title}
                    </div>
                    {item.tag && <span className="rec-item-tag">{item.tag}</span>}
                  </div>
                </div>
                <div className="rec-item-desc" title={item.desc}>
                  {item.desc}
                </div>
                <div className="rec-item-actions">
                  <button
                    className={isAdded ? 'secondary' : 'primary'}
                    disabled={isAdded}
                    onClick={() => !isAdded && handleAdd(item.title, item.url, item.tag)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      cursor: isAdded ? 'default' : 'pointer'
                    }}
                  >
                    {isAdded ? <Check size={12} /> : <Plus size={12} />}
                    {isAdded ? '已收藏' : '添加书签'}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      textAlign: 'center'
                    }}
                  >
                    <ExternalLink size={12} />
                    访问
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryReportCard({ cardData }: { cardData: any }) {
  const categories = cardData?.categories || [];
  const totalCount = cardData?.totalCount || 0;

  if (categories.length === 0) {
    return (
      <div className="chat-custom-card">
        <div className="card-header">
          <span>领域分析总结</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>未生成领域分析报告。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-custom-card">
      <div className="card-header">
        <span>书签领域分布分析</span>
        <span className="folder-pill tag-ent">共 {totalCount} 个书签</span>
      </div>
      <div className="card-body">
        <div className="summary-stats-container">
          {categories.map((cat: any, idx: number) => (
            <div key={idx} className="summary-stat-row">
              <div className="summary-stat-label-row">
                <span>{cat.name}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {cat.count} 个 ({cat.percentage}%)
                </span>
              </div>
              <div className="summary-stat-bar-bg">
                <div
                  className="summary-stat-bar-fill"
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookmarkFavicon({
  url,
  className,
  size = 32,
  preferOnline = false,
}: {
  url: string;
  className?: string;
  size?: number;
  preferOnline?: boolean;
}) {
  const getInitialSrc = () => {
    if (preferOnline) {
      try {
        const hostname = new URL(url).hostname;
        return `https://api.iowen.cn/favicon/${hostname}.png`;
      } catch {
        return faviconOf(url, size);
      }
    }
    return faviconOf(url, size);
  };

  const [src, setSrc] = useState(getInitialSrc);
  const [fallbackPhase, setFallbackPhase] = useState(preferOnline ? 1 : 0); // 0: local, 1: iowen, 2: google, 3: svg

  useEffect(() => {
    setSrc(getInitialSrc());
    setFallbackPhase(preferOnline ? 1 : 0);
  }, [url, size, preferOnline]);

  const handleOnError = () => {
    if (fallbackPhase === 0) {
      setFallbackPhase(1);
      try {
        const hostname = new URL(url).hostname;
        setSrc(`https://api.iowen.cn/favicon/${hostname}.png`);
      } catch {
        setFallbackPhase(2);
      }
    } else if (fallbackPhase === 1) {
      setFallbackPhase(2);
      try {
        const hostname = new URL(url).hostname;
        setSrc(`https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`);
      } catch {
        setFallbackPhase(3);
      }
    } else if (fallbackPhase === 2) {
      setFallbackPhase(3);
    }
  };

  if (fallbackPhase === 3) {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={handleOnError}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
