import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  ExternalLink,
  FolderPlus,
  Globe2,
  Layers3,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { SiteNavCategory, SiteNavItem, SiteNavigationData } from './models';
import {
  createSiteNavCategory,
  deleteSiteNavCategory,
  deleteSiteNavItem,
  fallbackSiteTitle,
  fetchSiteTitle,
  filterSiteNavItems,
  getCategoryScopeIds,
  getChildCategories,
  getSiteIconCandidates,
  getTopLevelCategories,
  moveSiteNavCategory,
  moveSiteNavItem,
  normalizeSiteUrl,
  resolveSiteIconUrl,
  updateSiteNavCategory,
  upsertSiteNavItem,
} from './lib/siteNavigator';
import { faviconOf, hostnameOf } from './lib/utils';

type DraftSite = {
  id?: string;
  title: string;
  url: string;
  categoryId: string;
  iconUrl: string;
};

type DeleteCategoryState = {
  category: SiteNavCategory;
  affectedItemCount: number;
  moveTargetId: string;
};

interface SiteNavigatorPageProps {
  data: SiteNavigationData;
  language: 'zh-CN' | 'en-US';
  onChange: (next: SiteNavigationData) => Promise<void>;
  onToast: (message: string) => void;
}

const SITE_NAV_TEXT = {
  'zh-CN': {
    title: '网址导航',
    subtitle: '把值得反复访问的网站整理成自己的导航站。',
    searchPlaceholder: '搜索名称、网址或域名',
    addSite: '添加网站',
    manageCategories: '管理分类',
    all: '全部',
    addCategory: '添加分类',
    addFirstCategory: '添加第一个分类',
    addFirstSite: '添加第一个网站',
    emptyTitle: '还没有网址导航',
    emptyDesc: '先添加一个分类，再把常用网站整理进去。',
    noSites: '这个分类下还没有网站。',
    noSearchSites: '没有匹配的网站。',
    editSite: '编辑网站',
    newSite: '添加网站',
    siteTitle: '网站名称',
    siteUrl: '网站 URL',
    siteIcon: '自定义图标 URL',
    category: '分类',
    preview: '实时预览',
    cancel: '取消',
    save: '保存',
    saved: '已保存网站',
    deleted: '已删除网站',
    copied: '已复制链接',
    categories: '分类管理',
    topCategory: '一级分类',
    childCategory: '二级分类',
    rename: '重命名',
    delete: '删除',
    moveUp: '上移',
    moveDown: '下移',
    addChild: '添加二级',
    promptCategoryName: '请输入分类名称',
    confirmDeleteSite: '确认删除「{title}」吗？',
    deleteCategoryTitle: '删除分类',
    deleteCategoryDesc: '分类「{name}」包含 {count} 个网站。请选择如何处理这些网站。',
    deleteCategoryEmptyDesc: '确定要删除分类「{name}」吗？',
    deleteItems: '同时删除网站',
    moveItems: '移动到其他分类',
    confirmDelete: '确认删除',
    emptyTitleOrUrl: '名称和 URL 不能为空',
    createCategoryFirst: '请先创建分类',
    titleFetching: '正在自动获取网站标题...',
  },
  'en-US': {
    title: 'Site Navigator',
    subtitle: 'Collect your most valuable websites into a personal navigation board.',
    searchPlaceholder: 'Search name, URL, or host',
    addSite: 'Add Site',
    manageCategories: 'Manage Categories',
    all: 'All',
    addCategory: 'Add Category',
    addFirstCategory: 'Add First Category',
    addFirstSite: 'Add First Site',
    emptyTitle: 'No sites yet',
    emptyDesc: 'Create a category first, then collect your useful websites here.',
    noSites: 'No sites in this category yet.',
    noSearchSites: 'No matching sites.',
    editSite: 'Edit Site',
    newSite: 'Add Site',
    siteTitle: 'Site Name',
    siteUrl: 'Site URL',
    siteIcon: 'Custom Icon URL',
    category: 'Category',
    preview: 'Live Preview',
    cancel: 'Cancel',
    save: 'Save',
    saved: 'Site saved',
    deleted: 'Site deleted',
    copied: 'Link copied',
    categories: 'Category Manager',
    topCategory: 'Top Category',
    childCategory: 'Child Category',
    rename: 'Rename',
    delete: 'Delete',
    moveUp: 'Move up',
    moveDown: 'Move down',
    addChild: 'Add Child',
    promptCategoryName: 'Category name',
    confirmDeleteSite: 'Delete "{title}"?',
    deleteCategoryTitle: 'Delete Category',
    deleteCategoryDesc: '"{name}" contains {count} sites. Choose how to handle them.',
    deleteCategoryEmptyDesc: 'Are you sure you want to delete category "{name}"?',
    deleteItems: 'Delete sites too',
    moveItems: 'Move to another category',
    confirmDelete: 'Delete',
    emptyTitleOrUrl: 'Name and URL cannot be empty',
    createCategoryFirst: 'Create a category first',
    titleFetching: 'Fetching site title...',
  },
};

function fmt(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function sortCategories(categories: SiteNavCategory[]) {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function SiteNavigatorPage({ data, language, onChange, onToast }: SiteNavigatorPageProps) {
  const text = SITE_NAV_TEXT[language];
  const topCategories = useMemo(() => getTopLevelCategories(data), [data]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [siteDrawerOpen, setSiteDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftSite>({ title: '', url: '', categoryId: '', iconUrl: '' });
  const [titleTouched, setTitleTouched] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [dragSiteId, setDragSiteId] = useState<string | null>(null);
  const [deleteCategoryState, setDeleteCategoryState] = useState<DeleteCategoryState | null>(null);

  useEffect(() => {
    if (activeCategoryId && data.categories.some((category) => category.id === activeCategoryId)) return;
    setActiveCategoryId(topCategories[0]?.id ?? '');
  }, [activeCategoryId, data.categories, topCategories]);

  const activeCategory = useMemo(
    () => data.categories.find((category) => category.id === activeCategoryId) ?? topCategories[0],
    [activeCategoryId, data.categories, topCategories],
  );

  const parentCategory = useMemo(() => {
    if (!activeCategory) return null;
    if (activeCategory.parentId) {
      return data.categories.find((category) => category.id === activeCategory.parentId) || null;
    }
    return activeCategory;
  }, [activeCategory, data.categories]);

  const subCategories = useMemo(() => {
    if (!parentCategory) return [];
    return getChildCategories(data, parentCategory.id);
  }, [parentCategory, data]);

  const visibleItems = useMemo(() => {
    if (!activeCategory?.id) return [];
    return filterSiteNavItems(data, activeCategory.id, query);
  }, [activeCategory?.id, data, query]);

  const saveData = async (next: SiteNavigationData) => {
    await onChange(next);
  };

  const openNewSiteDrawer = () => {
    const categoryId = activeCategoryId || topCategories[0]?.id || '';
    if (!categoryId) {
      onToast(text.createCategoryFirst);
      setCategoryDrawerOpen(true);
      return;
    }
    setDraft({ title: '', url: '', categoryId, iconUrl: '' });
    setTitleTouched(false);
    setSiteDrawerOpen(true);
  };

  const openEditSiteDrawer = (item: SiteNavItem) => {
    setDraft({
      id: item.id,
      title: item.title,
      url: item.url,
      categoryId: item.categoryId,
      iconUrl: item.iconUrl || '',
    });
    setTitleTouched(true);
    setSiteDrawerOpen(true);
  };

  const onUrlBlur = async () => {
    const normalizedUrl = normalizeSiteUrl(draft.url);
    if (!normalizedUrl) return;
    setDraft((prev) => ({ ...prev, url: normalizedUrl }));
    if (titleTouched && draft.title.trim()) return;

    setFetchingTitle(true);
    const fetchedTitle = await fetchSiteTitle(normalizedUrl);
    setFetchingTitle(false);
    setDraft((prev) => ({
      ...prev,
      title: prev.title.trim() && titleTouched ? prev.title : fetchedTitle || fallbackSiteTitle(normalizedUrl),
    }));
  };

  const saveSite = async () => {
    const title = draft.title.trim();
    const url = normalizeSiteUrl(draft.url);
    if (!title || !url) {
      onToast(text.emptyTitleOrUrl);
      return;
    }
    const next = upsertSiteNavItem(data, {
      id: draft.id,
      title,
      url,
      categoryId: draft.categoryId,
      iconUrl: draft.iconUrl,
    });
    await saveData(next);
    setSiteDrawerOpen(false);
    onToast(text.saved);
  };

  const deleteSite = async (item: SiteNavItem) => {
    if (!window.confirm(fmt(text.confirmDeleteSite, { title: item.title }))) return;
    await saveData(deleteSiteNavItem(data, item.id));
    onToast(text.deleted);
  };

  const copySiteUrl = async (url: string) => {
    try {
      await navigator.clipboard?.writeText(url);
      onToast(text.copied);
    } catch {
      onToast(url);
    }
  };

  const addCategory = async (parentId?: string) => {
    const name = window.prompt(text.promptCategoryName);
    if (!name?.trim()) return;
    const next = createSiteNavCategory(data, name.trim(), parentId);
    await saveData(next);
    const created = next.categories.find((category) => category.name === name.trim() && (category.parentId || '') === (parentId || ''));
    if (created && !parentId) {
      setActiveCategoryId(created.id);
    }
  };

  const renameCategory = async (category: SiteNavCategory) => {
    const name = window.prompt(text.promptCategoryName, category.name);
    if (!name?.trim()) return;
    await saveData(updateSiteNavCategory(data, category.id, name.trim()));
  };

  const askDeleteCategory = (category: SiteNavCategory) => {
    const scope = new Set(getCategoryScopeIds(data, category.id));
    const affectedItemCount = data.items.filter((item) => scope.has(item.categoryId)).length;
    const moveTargets = data.categories.filter((entry) => !scope.has(entry.id));
    setDeleteCategoryState({
      category,
      affectedItemCount,
      moveTargetId: moveTargets[0]?.id || '',
    });
  };

  const confirmDeleteCategory = async (mode: 'delete-items' | 'move-items') => {
    if (!deleteCategoryState) return;
    const next = deleteSiteNavCategory(
      data,
      deleteCategoryState.category.id,
      mode === 'delete-items'
        ? { kind: 'delete-items' }
        : { kind: 'move-items', targetCategoryId: deleteCategoryState.moveTargetId },
    );
    await saveData(next);
    setDeleteCategoryState(null);
  };

  const moveCategory = async (category: SiteNavCategory, direction: -1 | 1) => {
    await saveData(moveSiteNavCategory(data, category.id, direction));
  };

  const onDropSite = async (targetId: string) => {
    if (!dragSiteId || dragSiteId === targetId) return;
    await saveData(moveSiteNavItem(data, dragSiteId, targetId));
    setDragSiteId(null);
  };

  const previewUrl = normalizeSiteUrl(draft.url || 'https://example.com');
  const previewItem: SiteNavItem = {
    id: draft.id || 'preview',
    title: draft.title || fallbackSiteTitle(previewUrl),
    url: previewUrl,
    categoryId: draft.categoryId,
    iconUrl: draft.iconUrl,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <section className="site-navigator-page">
      <div className="site-nav-category-bar">
        <div className="site-nav-tabs">
          {topCategories.map((category) => {
            const isActive = parentCategory?.id === category.id;
            return (
              <button
                key={category.id}
                className={isActive ? 'site-nav-tab active' : 'site-nav-tab'}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            );
          })}
        </div>
        <div className="site-nav-controls">
          <div className="site-nav-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} />
          </div>
          <button className="ghost-action-btn" onClick={() => setCategoryDrawerOpen(true)}>
            <Layers3 size={15} />
            {text.manageCategories}
          </button>
        </div>
      </div>

      {subCategories.length > 0 && (
        <div className="site-nav-subcategories-bar">
          <button
            className={activeCategoryId === parentCategory?.id ? 'site-nav-subtab active' : 'site-nav-subtab'}
            onClick={() => setActiveCategoryId(parentCategory?.id || '')}
          >
            {text.all}
          </button>
          {subCategories.map((child) => (
            <button
              key={child.id}
              className={activeCategoryId === child.id ? 'site-nav-subtab active' : 'site-nav-subtab'}
              onClick={() => setActiveCategoryId(child.id)}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}



      <div className="site-card-grid">
        {visibleItems.map((item) => (
          <div
            className={dragSiteId === item.id ? 'site-card dragging' : 'site-card'}
            key={item.id}
            draggable
            onDragStart={() => setDragSiteId(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDropSite(item.id)}
            onDragEnd={() => setDragSiteId(null)}
          >
            <button className="site-card-open" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>
              <SiteNavIcon item={item} size={64} />
              <strong title={item.title}>{item.title}</strong>
            </button>
            <div className="site-card-tools">
              <button title={text.editSite} onClick={() => openEditSiteDrawer(item)}>
                <Edit3 size={14} />
              </button>
              <button title="Copy" onClick={() => copySiteUrl(item.url)}>
                <Copy size={14} />
              </button>
              <button title="Open" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink size={14} />
              </button>
              <button title={text.delete} onClick={() => deleteSite(item)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {topCategories.length > 0 && (
          <button className="site-card site-card-add" onClick={openNewSiteDrawer}>
            <Plus size={24} />
            <span>{text.addSite}</span>
          </button>
        )}

        {query && visibleItems.length === 0 && (
          <div className="site-nav-empty compact">
            <Search size={28} />
            <p>{text.noSearchSites}</p>
          </div>
        )}
      </div>

      {siteDrawerOpen && (
        <div className="site-drawer-backdrop" onClick={() => setSiteDrawerOpen(false)}>
          <aside className="site-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="site-drawer-head">
              <h3>{draft.id ? text.editSite : text.newSite}</h3>
              <button onClick={() => setSiteDrawerOpen(false)} aria-label="close">
                <X size={18} />
              </button>
            </div>
            <div className="site-drawer-body">
              <label>
                <span>{text.siteUrl}</span>
                <input
                  value={draft.url}
                  onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
                  onBlur={onUrlBlur}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                <span>{text.siteTitle}</span>
                <input
                  value={draft.title}
                  onChange={(event) => {
                    setTitleTouched(true);
                    setDraft((prev) => ({ ...prev, title: event.target.value }));
                  }}
                  placeholder={fetchingTitle ? text.titleFetching : fallbackSiteTitle(previewUrl)}
                />
              </label>
              <label>
                <span>{text.category}</span>
                <select
                  value={draft.categoryId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {sortCategories(data.categories).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? `  - ${category.name}` : category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{text.siteIcon}</span>
                <input
                  value={draft.iconUrl}
                  onChange={(event) => setDraft((prev) => ({ ...prev, iconUrl: event.target.value }))}
                  placeholder={resolveSiteIconUrl(previewItem, 64)}
                />
              </label>

              <div className="site-preview-box">
                <span>{text.preview}</span>
                <div className="site-card preview">
                  <button className="site-card-open" type="button">
                    <SiteNavIcon item={previewItem} size={64} />
                    <strong>{previewItem.title}</strong>
                  </button>
                </div>
              </div>
            </div>
            <div className="site-drawer-actions">
              <button onClick={() => setSiteDrawerOpen(false)}>{text.cancel}</button>
              <button className="primary" onClick={saveSite}>{text.save}</button>
            </div>
          </aside>
        </div>
      )}

      {categoryDrawerOpen && (
        <div className="site-drawer-backdrop" onClick={() => setCategoryDrawerOpen(false)}>
          <aside className="site-drawer category-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="site-drawer-head">
              <h3>{text.categories}</h3>
              <button onClick={() => setCategoryDrawerOpen(false)} aria-label="close">
                <X size={18} />
              </button>
            </div>
            <div className="site-drawer-body category-manager">
              <button className="category-add-row" onClick={() => addCategory()}>
                <FolderPlus size={16} />
                {text.addCategory}
              </button>
              {topCategories.map((category) => (
                <div className="category-group" key={category.id}>
                  <div className="category-row top">
                    <span>{category.name}</span>
                    <div>
                      <button title={text.moveUp} onClick={() => moveCategory(category, -1)}><ArrowUp size={13} /></button>
                      <button title={text.moveDown} onClick={() => moveCategory(category, 1)}><ArrowDown size={13} /></button>
                      <button onClick={() => addCategory(category.id)}>{text.addChild}</button>
                      <button onClick={() => renameCategory(category)}>{text.rename}</button>
                      <button className="danger" onClick={() => askDeleteCategory(category)}>{text.delete}</button>
                    </div>
                  </div>
                  {getChildCategories(data, category.id).map((child) => (
                    <div className="category-row child" key={child.id}>
                      <span>{child.name}</span>
                      <div>
                        <button title={text.moveUp} onClick={() => moveCategory(child, -1)}><ArrowUp size={13} /></button>
                        <button title={text.moveDown} onClick={() => moveCategory(child, 1)}><ArrowDown size={13} /></button>
                        <button onClick={() => renameCategory(child)}>{text.rename}</button>
                        <button className="danger" onClick={() => askDeleteCategory(child)}>{text.delete}</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {deleteCategoryState && (
        <div className="modal-mask" onClick={() => setDeleteCategoryState(null)}>
          <div className="modal-card site-delete-category-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{text.deleteCategoryTitle}</h3>
              <button className="modal-close-btn" onClick={() => setDeleteCategoryState(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {deleteCategoryState.affectedItemCount > 0 ? (
              <>
                <div className="modal-body">
                  <p>
                    {fmt(text.deleteCategoryDesc, {
                      name: deleteCategoryState.category.name,
                      count: deleteCategoryState.affectedItemCount,
                    })}
                  </p>
                  <div className="modal-select-wrapper">
                    <select
                      value={deleteCategoryState.moveTargetId}
                      onChange={(event) =>
                        setDeleteCategoryState((prev) => (prev ? { ...prev, moveTargetId: event.target.value } : prev))
                      }
                    >
                      {data.categories
                        .filter((category) => !getCategoryScopeIds(data, deleteCategoryState.category.id).includes(category.id))
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentId ? `  - ${category.name}` : category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="modal-actions multi-actions">
                  <button className="btn-cancel" onClick={() => setDeleteCategoryState(null)}>{text.cancel}</button>
                  <button
                    className="btn-primary"
                    disabled={!deleteCategoryState.moveTargetId}
                    onClick={() => confirmDeleteCategory('move-items')}
                  >
                    {text.moveItems}
                  </button>
                  <button className="btn-danger" onClick={() => confirmDeleteCategory('delete-items')}>
                    {text.deleteItems}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-body">
                  <p>
                    {fmt(text.deleteCategoryEmptyDesc, {
                      name: deleteCategoryState.category.name,
                    })}
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setDeleteCategoryState(null)}>{text.cancel}</button>
                  <button className="btn-danger" onClick={() => confirmDeleteCategory('delete-items')}>
                    {text.confirmDelete}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SiteNavLetterAvatar({ title, url }: { title: string; url: string }) {
  const char = useMemo(() => {
    const trimmed = title.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
  }, [title]);

  const background = useMemo(() => {
    const str = `${title}||${url}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'linear-gradient(135deg, #FF6B6B, #FF8E53)',
      'linear-gradient(135deg, #4E65FF, #92EFFD)',
      'linear-gradient(135deg, #11998e, #38ef7d)',
      'linear-gradient(135deg, #7F00FF, #E100FF)',
      'linear-gradient(135deg, #F857A6, #FF5858)',
      'linear-gradient(135deg, #00C6FF, #0072FF)',
      'linear-gradient(135deg, #F7971E, #FFD200)',
      'linear-gradient(135deg, #614385, #516395)',
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }, [title, url]);

  return (
    <div className="site-card-letter-avatar" style={{ background }}>
      <span>{char}</span>
    </div>
  );
}

// Global memory cache to store resolved icon status and prevent repeated fetches/flickers
const resolvedIconsCache = new Map<string, { src: string; isFallback: boolean }>();

// Reference size for Google default fallback icon
let googleDefaultSize = -1;
let defaultsPromise: Promise<void> | null = null;

const ensureDefaultSizes = (): Promise<void> => {
  if (defaultsPromise) return defaultsPromise;
  
  defaultsPromise = (async () => {
    try {
      const gRes = await fetch('https://www.google.com/s2/favicons?domain=kuntab-missing-favicon.invalid&sz=64');
      if (gRes.ok) {
        const gBlob = await gRes.blob();
        googleDefaultSize = gBlob.size;
      }
    } catch (e) {
      console.warn('Failed to resolve Google default favicon size', e);
    }
  })();
  
  return defaultsPromise;
};

function SiteNavIcon({
  item,
  size = 64,
}: {
  item: Pick<SiteNavItem, 'url' | 'iconUrl' | 'title'>;
  size?: number;
}) {
  const cacheKey = useMemo(() => `${item.url}||${item.iconUrl || ''}`, [item.url, item.iconUrl]);
  const [state, setState] = useState<{ src: string; isFallback: boolean }>(() => {
    const cached = resolvedIconsCache.get(cacheKey);
    // While resolving, we show fallback avatar as a clean placeholder
    return cached || { src: '', isFallback: true };
  });

  useEffect(() => {
    const cached = resolvedIconsCache.get(cacheKey);
    if (cached) {
      setState(cached);
      return;
    }

    let active = true;
    const resolveIcon = async () => {
      await ensureDefaultSizes();
      const candidates = getSiteIconCandidates(item, size);
      
      for (const candidate of candidates) {
        if (!active) return;

        // If the candidate is custom local base64/blob or chrome data, skip fetching and use directly
        if (candidate.startsWith('data:') || candidate.startsWith('blob:')) {
          const result = { src: candidate, isFallback: false };
          resolvedIconsCache.set(cacheKey, result);
          if (active) setState(result);
          return;
        }

        try {
          const res = await fetch(candidate, { method: 'GET' });
          if (!active) return;
          if (!res.ok) continue;

          // Verify the resource is an actual image (not an HTML redirect or error page)
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.toLowerCase().startsWith('image/')) {
            continue;
          }

          const blob = await res.blob();
          if (!active) return;

          // Skip if matches Google default size
          if (googleDefaultSize !== -1 && blob.size === googleDefaultSize) {
            continue;
          }
          // Skip if the image is extremely tiny/empty (less than 100 bytes)
          if (blob.size < 100) {
            continue;
          }

          // Icon is valid! Use it
          const result = { src: candidate, isFallback: false };
          resolvedIconsCache.set(cacheKey, result);
          if (active) setState(result);
          return;
        } catch (err) {
          // Fetch failed (network or CORS), try next candidate
        }
      }

      // If all candidates failed or returned default icons, use initials avatar fallback
      const fallbackResult = { src: '', isFallback: true };
      resolvedIconsCache.set(cacheKey, fallbackResult);
      if (active) setState(fallbackResult);
    };

    resolveIcon();

    return () => {
      active = false;
    };
  }, [cacheKey, item, size]);

  if (state.isFallback || !state.src) {
    return <SiteNavLetterAvatar title={item.title} url={item.url} />;
  }

  return (
    <img
      src={state.src}
      alt=""
      onError={() => {
        // If loading somehow failed on img, fall back immediately to letter avatar
        setState({ src: '', isFallback: true });
        resolvedIconsCache.set(cacheKey, { src: '', isFallback: true });
      }}
    />
  );
}
