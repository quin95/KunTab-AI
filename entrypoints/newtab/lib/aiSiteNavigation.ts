import type { SiteNavigationData } from '../models';
import { createSiteNavCategory, fallbackSiteTitle, normalizeSiteUrl, upsertSiteNavItem } from './siteNavigator';
import { hostnameOf } from './utils';

export interface SiteNavigationPlanSite {
  title: string;
  url: string;
  desc?: string;
  topCategory: string;
  childCategory?: string;
  reason?: string;
}

export interface SiteNavigationPlanPayload {
  sites: SiteNavigationPlanSite[];
}

export interface SiteNavigationPlanPreviewItem extends SiteNavigationPlanSite {
  id: string;
  url: string;
  desc: string;
  childCategory: string;
  reason: string;
  duplicate: boolean;
  categoryStatus: 'existing' | 'new-top' | 'new-child';
  categoryLabel: string;
}

export interface SiteNavigationPlanPreview {
  items: SiteNavigationPlanPreviewItem[];
  selectedIds: string[];
  duplicateCount: number;
  newTopCategories: string[];
  newChildCategories: string[];
}

export interface ApplySiteNavigationPlanResult {
  data: SiteNavigationData;
  added: number;
  skipped: number;
}

function normalizeName(value: unknown, fallback: string): string {
  const name = String(value ?? '').trim();
  return name || fallback;
}

function categoryKey(name: string): string {
  return name.trim().toLowerCase();
}

export function canonicalSiteUrlKey(raw: string): string {
  try {
    const url = new URL(normalizeSiteUrl(raw));
    url.hash = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return normalizeSiteUrl(raw).trim().toLowerCase();
  }
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeSiteUrl(raw));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function existingUrlKeys(data: SiteNavigationData): Set<string> {
  return new Set(data.items.map((item) => canonicalSiteUrlKey(item.url)));
}

function findTopCategoryId(data: SiteNavigationData, name: string): string | undefined {
  const key = categoryKey(name);
  return data.categories.find((category) => !category.parentId && categoryKey(category.name) === key)?.id;
}

function findChildCategoryId(data: SiteNavigationData, parentId: string, name: string): string | undefined {
  const key = categoryKey(name);
  return data.categories.find((category) => category.parentId === parentId && categoryKey(category.name) === key)?.id;
}

function getCategoryStatus(
  data: SiteNavigationData,
  topCategory: string,
  childCategory: string,
): SiteNavigationPlanPreviewItem['categoryStatus'] {
  const topId = findTopCategoryId(data, topCategory);
  if (!topId) return 'new-top';
  if (!childCategory) return 'existing';
  return findChildCategoryId(data, topId, childCategory) ? 'existing' : 'new-child';
}

function normalizePlanSites(payload: unknown): SiteNavigationPlanSite[] {
  const rawSites = Array.isArray((payload as any)?.sites) ? (payload as any).sites : [];
  const seen = new Set<string>();
  const sites: SiteNavigationPlanSite[] = [];

  for (const raw of rawSites) {
    const url = normalizeSiteUrl(String(raw?.url ?? ''));
    if (!url || !isHttpUrl(url)) continue;
    const urlKey = canonicalSiteUrlKey(url);
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);

    const title = normalizeName(raw?.title, fallbackSiteTitle(url));
    const topCategory = normalizeName(raw?.topCategory, '未分类');
    const childCategory = String(raw?.childCategory ?? '').trim();
    sites.push({
      title,
      url,
      desc: String(raw?.desc ?? '').trim(),
      topCategory,
      childCategory,
      reason: String(raw?.reason ?? '').trim(),
    });
  }

  return sites;
}

export function serializeSiteNavigationContext(data: SiteNavigationData): string {
  const topCategories = data.categories
    .filter((category) => !category.parentId)
    .sort((a, b) => a.order - b.order);

  const categoryLines = topCategories.flatMap((top) => {
    const topCount = data.items.filter((item) => item.categoryId === top.id).length;
    const children = data.categories
      .filter((category) => category.parentId === top.id)
      .sort((a, b) => a.order - b.order);
    const childLines = children.map((child) => {
      const count = data.items.filter((item) => item.categoryId === child.id).length;
      return `    - 二级分类: ${child.name}（${count} 个网站）`;
    });
    return [`  - 一级分类: ${top.name}（${topCount} 个直属网站）`, ...childLines];
  });

  const categoryNameById = new Map(data.categories.map((category) => [category.id, category.name]));
  const parentNameById = new Map(
    data.categories.map((category) => [
      category.id,
      category.parentId ? categoryNameById.get(category.parentId) || '' : '',
    ]),
  );
  const itemLines = data.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const parentName = parentNameById.get(item.categoryId);
      const categoryName = categoryNameById.get(item.categoryId) || '未分类';
      const categoryPath = parentName ? `${parentName} / ${categoryName}` : categoryName;
      return `  - ${item.title} | ${hostnameOf(item.url)} | ${item.url} | 分类: ${categoryPath}`;
    });

  return [
    '【网址导航能力说明】',
    '网址导航是 KunTab 独立的网站收藏功能，不等同于 Chrome 书签。',
    '分类最多两层：一级分类 + 可选二级分类。不要输出三级或更深层级。',
    '规划网站时应优先复用现有分类；没有合适分类时再建议新分类。',
    '',
    '【现有网址导航分类】',
    categoryLines.join('\n') || '  （暂无分类）',
    '',
    '【现有网址导航网站】',
    itemLines.join('\n') || '  （暂无网站）',
  ].join('\n');
}

export function buildSiteNavigationPlanPreview(
  payload: unknown,
  data: SiteNavigationData,
): SiteNavigationPlanPreview {
  const sites = normalizePlanSites(payload);
  const existingUrls = existingUrlKeys(data);
  const newTopCategories = new Set<string>();
  const newChildCategories = new Set<string>();

  const items = sites.map((site, index) => {
    const duplicate = existingUrls.has(canonicalSiteUrlKey(site.url));
    const childCategory = site.childCategory?.trim() || '';
    const categoryStatus = getCategoryStatus(data, site.topCategory, childCategory);
    if (categoryStatus === 'new-top') {
      newTopCategories.add(site.topCategory);
      if (childCategory) newChildCategories.add(`${site.topCategory} / ${childCategory}`);
    } else if (categoryStatus === 'new-child') {
      newChildCategories.add(`${site.topCategory} / ${childCategory}`);
    }

    return {
      ...site,
      id: `site-plan-${index}-${canonicalSiteUrlKey(site.url)}`,
      childCategory,
      desc: site.desc || '',
      reason: site.reason || '',
      duplicate,
      categoryStatus,
      categoryLabel: childCategory ? `${site.topCategory} / ${childCategory}` : site.topCategory,
    };
  });

  return {
    items,
    selectedIds: items.filter((item) => !item.duplicate).map((item) => item.id),
    duplicateCount: items.filter((item) => item.duplicate).length,
    newTopCategories: [...newTopCategories],
    newChildCategories: [...newChildCategories],
  };
}

export function applySiteNavigationPlan(
  data: SiteNavigationData,
  preview: SiteNavigationPlanPreview,
  selectedIds: string[],
): ApplySiteNavigationPlanResult {
  const selected = new Set(selectedIds);
  let next = data;
  let added = 0;
  let skipped = 0;

  for (const item of preview.items) {
    if (!selected.has(item.id)) continue;
    const urlKey = canonicalSiteUrlKey(item.url);
    if (existingUrlKeys(next).has(urlKey)) {
      skipped += 1;
      continue;
    }

    let topId = findTopCategoryId(next, item.topCategory);
    if (!topId) {
      next = createSiteNavCategory(next, item.topCategory);
      topId = findTopCategoryId(next, item.topCategory);
    }
    if (!topId) {
      skipped += 1;
      continue;
    }

    let categoryId = topId;
    if (item.childCategory) {
      let childId = findChildCategoryId(next, topId, item.childCategory);
      if (!childId) {
        next = createSiteNavCategory(next, item.childCategory, topId);
        childId = findChildCategoryId(next, topId, item.childCategory);
      }
      if (childId) {
        categoryId = childId;
      }
    }

    next = upsertSiteNavItem(next, {
      title: item.title,
      url: item.url,
      categoryId,
    });
    added += 1;
  }

  return { data: next, added, skipped };
}
