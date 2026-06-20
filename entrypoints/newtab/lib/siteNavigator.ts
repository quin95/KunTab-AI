import type { SiteNavCategory, SiteNavItem, SiteNavigationData } from '../models';
import { ensureHttpUrl, faviconOf, hostnameOf } from './utils';

export const DEFAULT_SITE_NAVIGATION: SiteNavigationData = {
  categories: [],
  items: [],
  updatedAt: 0,
};

function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function now(): number {
  return Date.now();
}

export function normalizeSiteUrl(raw: string): string {
  return ensureHttpUrl(raw).trim();
}

export function fallbackSiteTitle(url: string): string {
  const host = hostnameOf(url);
  return host || url;
}

export function resolveSiteIconUrl(item: Pick<SiteNavItem, 'url' | 'iconUrl'>, size = 64): string {
  return item.iconUrl?.trim() || faviconOf(item.url, size);
}

export function sanitizeSiteNavigationData(value: Partial<SiteNavigationData> | null | undefined): SiteNavigationData {
  if (!value) return { ...DEFAULT_SITE_NAVIGATION };
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const categoryIds = new Set<string>();
  const cleanCategories: SiteNavCategory[] = [];

  for (const category of categories) {
    if (!category?.id || !category.name?.trim()) continue;
    if (category.parentId) {
      const parent = categories.find((entry) => entry.id === category.parentId);
      if (!parent || parent.parentId) continue;
    }
    if (categoryIds.has(category.id)) continue;
    categoryIds.add(category.id);
    cleanCategories.push({
      id: category.id,
      name: category.name.trim(),
      parentId: category.parentId,
      order: Number.isFinite(category.order) ? category.order : cleanCategories.length,
      createdAt: Number.isFinite(category.createdAt) ? category.createdAt : 0,
      updatedAt: Number.isFinite(category.updatedAt) ? category.updatedAt : 0,
    });
  }

  const cleanItems: SiteNavItem[] = [];
  for (const item of Array.isArray(value.items) ? value.items : []) {
    if (!item?.id || !item.url?.trim() || !categoryIds.has(item.categoryId)) continue;
    const url = normalizeSiteUrl(item.url);
    cleanItems.push({
      id: item.id,
      title: item.title?.trim() || fallbackSiteTitle(url),
      url,
      categoryId: item.categoryId,
      iconUrl: item.iconUrl?.trim() || '',
      order: Number.isFinite(item.order) ? item.order : cleanItems.length,
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : 0,
    });
  }

  return {
    categories: cleanCategories.sort((a, b) => a.order - b.order),
    items: cleanItems.sort((a, b) => a.order - b.order),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt ?? 0 : 0,
  };
}

export function createSiteNavCategory(
  data: SiteNavigationData,
  name: string,
  parentId?: string,
): SiteNavigationData {
  const timestamp = now();
  const siblings = data.categories.filter((category) => (category.parentId || '') === (parentId || ''));
  const parent = parentId ? data.categories.find((category) => category.id === parentId) : null;
  const nextParentId = parent && !parent.parentId ? parent.id : undefined;
  const category: SiteNavCategory = {
    id: createId('cat'),
    name: name.trim() || '未命名分类',
    parentId: nextParentId,
    order: siblings.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return sanitizeSiteNavigationData({
    ...data,
    categories: [...data.categories, category],
    updatedAt: timestamp,
  });
}

export function updateSiteNavCategory(data: SiteNavigationData, id: string, name: string): SiteNavigationData {
  const timestamp = now();
  return sanitizeSiteNavigationData({
    ...data,
    categories: data.categories.map((category) =>
      category.id === id ? { ...category, name: name.trim() || category.name, updatedAt: timestamp } : category,
    ),
    updatedAt: timestamp,
  });
}

export function moveSiteNavCategory(data: SiteNavigationData, id: string, direction: -1 | 1): SiteNavigationData {
  const target = data.categories.find((category) => category.id === id);
  if (!target) return data;
  const siblings = data.categories
    .filter((category) => (category.parentId || '') === (target.parentId || ''))
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((category) => category.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return data;
  const reordered = [...siblings];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  const orderById = new Map(reordered.map((category, order) => [category.id, order]));
  const timestamp = now();
  return sanitizeSiteNavigationData({
    ...data,
    categories: data.categories.map((category) =>
      orderById.has(category.id) ? { ...category, order: orderById.get(category.id)!, updatedAt: timestamp } : category,
    ),
    updatedAt: timestamp,
  });
}

export function deleteSiteNavCategory(
  data: SiteNavigationData,
  id: string,
  mode: { kind: 'delete-items' } | { kind: 'move-items'; targetCategoryId: string },
): SiteNavigationData {
  const category = data.categories.find((entry) => entry.id === id);
  if (!category) return data;
  const childIds = data.categories.filter((entry) => entry.parentId === id).map((entry) => entry.id);
  const idsToDelete = new Set([id, ...childIds]);
  const timestamp = now();
  const categories = data.categories.filter((entry) => !idsToDelete.has(entry.id));

  let items: SiteNavItem[];
  if (mode.kind === 'move-items' && categories.some((entry) => entry.id === mode.targetCategoryId)) {
    const moved = data.items.filter((item) => idsToDelete.has(item.categoryId));
    const kept = data.items.filter((item) => !idsToDelete.has(item.categoryId));
    const targetExistingCount = kept.filter((item) => item.categoryId === mode.targetCategoryId).length;
    items = [
      ...kept,
      ...moved.map((item, index) => ({
        ...item,
        categoryId: mode.targetCategoryId,
        order: targetExistingCount + index,
        updatedAt: timestamp,
      })),
    ];
  } else {
    items = data.items.filter((item) => !idsToDelete.has(item.categoryId));
  }

  return sanitizeSiteNavigationData({
    categories,
    items,
    updatedAt: timestamp,
  });
}

export function upsertSiteNavItem(
  data: SiteNavigationData,
  input: Partial<SiteNavItem> & { title: string; url: string; categoryId: string },
): SiteNavigationData {
  const timestamp = now();
  const url = normalizeSiteUrl(input.url);
  const existing = input.id ? data.items.find((item) => item.id === input.id) : null;
  const categoryId = data.categories.some((category) => category.id === input.categoryId)
    ? input.categoryId
    : data.categories[0]?.id;
  if (!categoryId) return data;

  const item: SiteNavItem = {
    id: existing?.id || createId('site'),
    title: input.title.trim() || fallbackSiteTitle(url),
    url,
    categoryId,
    iconUrl: input.iconUrl?.trim() || '',
    order:
      existing && existing.categoryId === categoryId
        ? existing.order
        : data.items.filter((entry) => entry.categoryId === categoryId).length,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  return sanitizeSiteNavigationData({
    ...data,
    items: existing ? data.items.map((entry) => (entry.id === existing.id ? item : entry)) : [...data.items, item],
    updatedAt: timestamp,
  });
}

export function deleteSiteNavItem(data: SiteNavigationData, id: string): SiteNavigationData {
  const timestamp = now();
  return sanitizeSiteNavigationData({
    ...data,
    items: data.items.filter((item) => item.id !== id),
    updatedAt: timestamp,
  });
}

export function moveSiteNavItem(data: SiteNavigationData, sourceId: string, targetId: string): SiteNavigationData {
  const source = data.items.find((item) => item.id === sourceId);
  const target = data.items.find((item) => item.id === targetId);
  if (!source || !target || source.categoryId !== target.categoryId || source.id === target.id) return data;
  const siblings = data.items
    .filter((item) => item.categoryId === source.categoryId)
    .sort((a, b) => a.order - b.order);
  const sourceIndex = siblings.findIndex((item) => item.id === sourceId);
  const targetIndex = siblings.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return data;
  const reordered = [...siblings];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  const orderById = new Map(reordered.map((item, order) => [item.id, order]));
  const timestamp = now();
  return sanitizeSiteNavigationData({
    ...data,
    items: data.items.map((item) =>
      orderById.has(item.id) ? { ...item, order: orderById.get(item.id)!, updatedAt: timestamp } : item,
    ),
    updatedAt: timestamp,
  });
}

export function getTopLevelCategories(data: SiteNavigationData): SiteNavCategory[] {
  return data.categories.filter((category) => !category.parentId).sort((a, b) => a.order - b.order);
}

export function getChildCategories(data: SiteNavigationData, parentId: string): SiteNavCategory[] {
  return data.categories.filter((category) => category.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function getCategoryScopeIds(data: SiteNavigationData, categoryId: string): string[] {
  const category = data.categories.find((entry) => entry.id === categoryId);
  if (!category) return [];
  if (category.parentId) return [category.id];
  return [category.id, ...getChildCategories(data, category.id).map((child) => child.id)];
}

export function filterSiteNavItems(data: SiteNavigationData, categoryId: string, query = ''): SiteNavItem[] {
  const scope = new Set(getCategoryScopeIds(data, categoryId));
  const lowerQuery = query.trim().toLowerCase();
  return data.items
    .filter((item) => {
      if (!scope.has(item.categoryId)) return false;
      if (!lowerQuery) return true;
      return (
        item.title.toLowerCase().includes(lowerQuery) ||
        item.url.toLowerCase().includes(lowerQuery) ||
        hostnameOf(item.url).toLowerCase().includes(lowerQuery)
      );
    })
    .sort((a, b) => a.order - b.order);
}

export async function fetchSiteTitle(url: string): Promise<string | null> {
  const normalizedUrl = normalizeSiteUrl(url);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(normalizedUrl, { signal: controller.signal });
    const html = await response.text();
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match?.[1]?.replace(/\s+/g, ' ').trim();
    return title || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
