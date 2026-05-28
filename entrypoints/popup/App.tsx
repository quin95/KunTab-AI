import { useEffect, useState, useRef } from 'react';
import { getBookmarkTree, buildFolderTree, flattenFolderOptions, createFolder } from '../newtab/lib/bookmarks';
import { getSettings } from '../newtab/lib/storage';
import { chat } from '../newtab/lib/ai';
import type { FolderOption, AppSettings } from '../newtab/models';
import { Search, Plus, Trash2, Check, Folder, Bookmark, Globe, ChevronDown, ExternalLink, Moon, Sun, Info, Sparkles } from 'lucide-react';
import logoImg from '../../assets/logo.png';
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
    aiRecommend: '智能推荐',
    recommending: '推荐中...',
    aiNotConfigured: '请先在 KunTab 设置中配置并启用 AI 助手。',
    recommendSuccess: '推荐成功！已为您选中最佳文件夹。',
    recommendFailed: '推荐失败，请重试',
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
    aiRecommend: 'AI Suggest',
    recommending: 'Analyzing...',
    aiNotConfigured: 'Please configure and enable AI assistant in KunTab settings first.',
    recommendSuccess: 'Suggested! Selected the best folder for you.',
    recommendFailed: 'Recommendation failed, please try again',
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
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendReason, setRecommendReason] = useState<string | null>(null);

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

  const handleAiRecommend = async () => {
    if (!settings || settings.aiProvider === 'none' || !settings.aiApiKey) {
      showToast(t.aiNotConfigured);
      return;
    }
    setIsRecommending(true);
    setRecommendReason(null);
    try {
      const folderOptionsList = folderOptions
        .map((o) => `- ID: ${o.id} | 路径: ${o.label}`)
        .join('\n');

      const systemPrompt = `你是一个专业的书签整理分类助手。
你的任务是：根据用户提供的网页标题、链接，从给定的【现有文件夹列表】中，智能分析并选出一个最适合保存该网页的文件夹。

【现有文件夹列表格式】：
- ID: [文件夹ID] | 路径: [完整层级路径]

【输出规范】：
请仅输出一个合法的 JSON 代码块，不要包含任何额外的解释文字或 Markdown 标记（除了 JSON 代码块本身）：
\`\`\`json
{
  "folderId": "匹配到的文件夹 ID",
  "reason": "推荐存入该文件夹的具体原因，不超过30字"
}
\`\`\`

【注意事项】：
1. 必须且只能从【现有文件夹列表】中挑选一个 ID。
2. 即使没有百分之百相关的文件夹，也请选择一个最接近或最合理的文件夹（例如技术类可放入“开发”或“工具”；日常类可放入“书签栏”等）。
3. 必须确保 JSON 格式合法，可以被 JSON.parse 正常解析。`;

      const userPrompt = `【待归类网页信息】：
标题: ${title}
链接: ${url}

【现有文件夹列表】：
${folderOptionsList || '- 无'}`;

      const responseText = await chat(settings, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      let parsed: { folderId: string; reason: string } | null = null;
      const blockRegex = /```json\n([\s\S]*?)\n```/;
      const match = blockRegex.exec(responseText);
      const jsonStringToParse = match ? match[1].trim() : responseText.trim();

      try {
        parsed = JSON.parse(jsonStringToParse);
      } catch (e) {
        const startIdx = jsonStringToParse.indexOf('{');
        const endIdx = jsonStringToParse.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          try {
            parsed = JSON.parse(jsonStringToParse.substring(startIdx, endIdx + 1));
          } catch (err2) {
            console.error('Failed to parse JSON using braces fallback', err2);
          }
        }
      }

      if (parsed && parsed.folderId) {
        const recommendedId = String(parsed.folderId);
        const exists = folderOptions.some((o) => String(o.id) === recommendedId) || recommendedId === '0' || recommendedId === '1';
        if (exists) {
          setParentId(recommendedId);
          setRecommendReason(parsed.reason || '');
          showToast(t.recommendSuccess);
        } else {
          const hasBar = folderOptions.find((o) => o.id === '1');
          const fallbackId = hasBar ? '1' : (folderOptions[0]?.id || '1');
          setParentId(fallbackId);
          setRecommendReason(parsed.reason || '');
          showToast(t.recommendSuccess);
        }
      } else {
        throw new Error('Could not parse folder ID or reason from AI response');
      }
    } catch (err) {
      console.error('AI Recommendation failed:', err);
      showToast(t.recommendFailed);
    } finally {
      setIsRecommending(false);
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
          <img className="brand-logo" src={logoImg} alt="logo" />
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
            <div className="field-label-row">
              <label className="field-label">{t.folder}</label>
              <button
                type="button"
                className="ai-recommend-btn"
                onClick={handleAiRecommend}
                disabled={isRecommending}
                title={t.aiRecommend}
              >
                <Sparkles size={12} className={isRecommending ? 'spinning' : ''} />
                <span>{isRecommending ? t.recommending : t.aiRecommend}</span>
              </button>
            </div>
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
            {recommendReason && (
              <div className="recommend-reason-box">
                <span>✨ {lang === 'zh-CN' ? 'AI 建议存入该文件夹：' : 'AI suggests saving here: '}{recommendReason}</span>
              </div>
            )}
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
