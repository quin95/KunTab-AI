import { useEffect, useState, useRef } from 'react';
import { getBookmarkTree, buildFolderTree, flattenFolderOptions, createFolder } from '../newtab/lib/bookmarks';
import { getSettings } from '../newtab/lib/storage';
import type { FolderOption, AppSettings } from '../newtab/models';
import { Search, Plus, Trash2, Check, Folder, Bookmark, Globe, ChevronDown, ExternalLink, Moon, Sun, Info } from 'lucide-react';
import './App.css';

const ext = ((globalThis as any).browser ?? (globalThis as any).chrome) as any;

const POPUP_LOCALE = {
  'zh-CN': {
    quickBookmark: '快速收藏书签',
    title: '网页标题',
    url: '网页链接',
    folder: '保存到文件夹',
    searchPlaceholder: '输入文件夹关键字搜索...',
    save: '添加书签',
    update: '更新书签',
    remove: '移除书签',
    successAdd: '已成功添加书签',
    successUpdate: '已更新书签',
    successRemove: '已移除书签',
    openNewtab: '进入 KunTab 新标签页',
    createNewFolder: '创建并存入新文件夹',
    emptyTitleOrUrl: '标题和链接不能为空',
    noParentFolder: '无法创建文件夹',
    folderCreated: '已创建文件夹「{title}」',
    isBookmarked: '已在此处收藏',
    shortcutHint: '快捷键: {key}',
  },
  'en-US': {
    quickBookmark: 'Quick Bookmark',
    title: 'Title',
    url: 'URL',
    folder: 'Folder',
    searchPlaceholder: 'Search folder...',
    save: 'Add Bookmark',
    update: 'Update Bookmark',
    remove: 'Remove Bookmark',
    successAdd: 'Bookmark added successfully',
    successUpdate: 'Bookmark updated successfully',
    successRemove: 'Bookmark removed successfully',
    openNewtab: 'Open KunTab Dashboard',
    createNewFolder: 'Create and save to folder',
    emptyTitleOrUrl: 'Title and URL cannot be empty',
    noParentFolder: 'Cannot create folder',
    folderCreated: 'Folder "{title}" created',
    isBookmarked: 'Bookmarked here',
    shortcutHint: 'Shortcut: {key}',
  }
};

function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [parentId, setParentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [isSuccessState, setIsSuccessState] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const lang = settings?.language || 'zh-CN';
  const t = POPUP_LOCALE[lang];
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);

  // Theme support
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      const theme = s.theme;
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    });
  }, []);

  // Fetch active tab and folders list on mount
  useEffect(() => {
    const init = async () => {
      // 1. Get active tab
      if (ext?.tabs) {
        try {
          let tabs = await ext.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            tabs = await ext.tabs.query({ active: true, lastFocusedWindow: true });
          }
          if (tabs && tabs[0]) {
            const tab = tabs[0];
            setTitle(tab.title || '');
            setUrl(tab.url || '');

            // Check if page is already bookmarked
            if (tab.url) {
              const existing = await ext.bookmarks.search({ url: tab.url });
              if (existing && existing.length > 0) {
                // Find matching url precisely since search is fuzzy
                const exactMatch = existing.find((node: any) => node.url === tab.url) || existing[0];
                setIsBookmarked(true);
                setBookmarkId(exactMatch.id);
                setTitle(exactMatch.title || tab.title || '');
                if (exactMatch.parentId) {
                  setParentId(exactMatch.parentId);
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to query tab / bookmarks', err);
        }
      }

      // 2. Fetch bookmarks folder options
      try {
        const tree = await getBookmarkTree();
        const folders = buildFolderTree(tree);
        const options = flattenFolderOptions(folders);
        setFolderOptions(options);
      } catch (err) {
        console.error('Failed to load folders', err);
      }
    };

    init();
  }, []);

  // Sync display input value when parentId or options list updates
  useEffect(() => {
    const selected = folderOptions.find(o => o.id === parentId);
    if (selected) {
      setDisplayValue(selected.label);
    } else if (parentId === '0') {
      setDisplayValue(lang === 'zh-CN' ? '全部书签' : 'All Bookmarks');
    }
  }, [parentId, folderOptions, lang]);

  // Set default parentId if none is selected
  useEffect(() => {
    if (!parentId && folderOptions.length > 0) {
      // Prioritize bookmarks bar ('1')
      const hasBar = folderOptions.find(o => o.id === '1');
      setParentId(hasBar ? '1' : folderOptions[0].id);
    }
  }, [folderOptions, parentId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  const handleFocus = () => {
    setIsDropdownOpen(true);
    setSearchQuery('');
  };

  const handleBlur = () => {
    // Timeout to allow dropdown item clicks to resolve first
    setTimeout(() => {
      setIsDropdownOpen(false);
      const selected = folderOptions.find(o => o.id === parentId);
      if (selected) {
        setDisplayValue(selected.label);
      }
    }, 200);
  };

  const filteredOptions = folderOptions.filter(o =>
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption = searchQuery.trim().length > 0 && 
    !folderOptions.some(o => o.label.toLowerCase() === searchQuery.toLowerCase());

  const handleCreateFolder = async () => {
    const targetParent = parentId || '1';
    try {
      const newFolder = await createFolder(targetParent, searchQuery.trim());
      if (newFolder) {
        const tree = await getBookmarkTree();
        const folders = buildFolderTree(tree);
        const options = flattenFolderOptions(folders);
        setFolderOptions(options);
        
        setParentId(newFolder.id);
        setIsDropdownOpen(false);
        setSearchQuery('');
        showToast(t.folderCreated.replace('{title}', searchQuery.trim()));
      } else {
        showToast(t.noParentFolder);
      }
    } catch (err) {
      showToast(t.noParentFolder);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      showToast(t.emptyTitleOrUrl);
      return;
    }

    try {
      if (isBookmarked && bookmarkId) {
        await ext.bookmarks.update(bookmarkId, { title: title.trim(), url: url.trim() });
        await ext.bookmarks.move(bookmarkId, { parentId });
        showToast(t.successUpdate);
      } else {
        await ext.bookmarks.create({ parentId, title: title.trim(), url: url.trim() });
        showToast(t.successAdd);
        setIsBookmarked(true);
      }
      setIsSuccessState(true);
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (err) {
      console.error(err);
      showToast(lang === 'zh-CN' ? '保存失败，请检查网址格式' : 'Save failed, check URL format');
    }
  };

  const handleDelete = async () => {
    if (!bookmarkId) return;
    try {
      await ext.bookmarks.remove(bookmarkId);
      showToast(t.successRemove);
      setIsBookmarked(false);
      setBookmarkId(null);
      setIsSuccessState(true);
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const openNewtab = () => {
    if (ext?.tabs) {
      ext.tabs.create({ url: 'chrome://newtab' });
    } else {
      window.open('chrome://newtab', '_blank');
    }
  };

  return (
    <main className="popup-root">
      <div className="popup-header">
        <div className="brand">
          <div className="logo-icon-simple"></div>
          <div className="brand-meta">
            <h1>KunTab</h1>
            <span className="brand-badge">{t.quickBookmark}</span>
          </div>
        </div>
        <button className="open-newtab-btn" onClick={openNewtab} title={t.openNewtab}>
          <ExternalLink size={16} />
        </button>
      </div>

      {isSuccessState ? (
        <div className="success-screen">
          <div className="success-circle">
            <Check size={36} className="success-check-icon" />
          </div>
          <p>{toastMsg}</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="popup-form">
          <div className="form-field">
            <label className="field-label">{t.title}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.title}
              className="form-input"
              required
            />
          </div>

          <div className="form-field">
            <label className="field-label">{t.url}</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="form-input"
              required
            />
          </div>

          <div className="form-field select-field" ref={dropdownRef}>
            <label className="field-label">{t.folder}</label>
            <div className="search-select-container">
              <div className="input-with-icon">
                <Folder size={16} className="folder-icon-input" />
                <input
                  type="text"
                  value={displayValue}
                  onChange={(e) => {
                    setDisplayValue(e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={t.searchPlaceholder}
                  className="form-input select-input"
                />
                <ChevronDown size={16} className="dropdown-arrow-icon" />
              </div>

              {isDropdownOpen && (
                <div className="search-dropdown-menu">
                  {filteredOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={option.id === parentId ? 'dropdown-item active' : 'dropdown-item'}
                      onMouseDown={() => {
                        setParentId(option.id);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <Bookmark size={13} style={{ opacity: 0.6 }} />
                      <span className="folder-name-text">{option.label}</span>
                      <small className="folder-count-text">({option.count})</small>
                    </button>
                  ))}

                  {filteredOptions.length === 0 && !showCreateOption && (
                    <div className="dropdown-empty">
                      {lang === 'zh-CN' ? '无匹配文件夹' : 'No matching folders'}
                    </div>
                  )}

                  {showCreateOption && (
                    <button
                      type="button"
                      className="dropdown-item create-folder-item"
                      onMouseDown={handleCreateFolder}
                    >
                      <Plus size={14} className="create-plus-icon" />
                      <span>{t.createNewFolder}: <strong>"{searchQuery}"</strong></span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isBookmarked && (
            <div className="bookmarked-badge">
              <Check size={14} />
              <span>{t.isBookmarked}</span>
            </div>
          )}

          <div className="button-group">
            {isBookmarked && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                title={t.remove}
              >
                <Trash2 size={16} />
                <span>{t.remove}</span>
              </button>
            )}
            <button type="submit" className="btn-primary">
              <Check size={16} />
              <span>{isBookmarked ? t.update : t.save}</span>
            </button>
          </div>
        </form>
      )}

      {toastMsg && !isSuccessState && (
        <div className="toast-notification">
          <Info size={14} />
          <span>{toastMsg}</span>
        </div>
      )}

      {!isSuccessState && (
        <div className="shortcut-hint">
          {t.shortcutHint.replace('{key}', isMac ? '⌥ Option + ⇧ Shift + S' : 'Alt + Shift + S')}
        </div>
      )}
    </main>
  );
}

export default App;
