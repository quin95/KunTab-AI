import { describe, expect, it } from 'vitest';
import type { SiteNavigationData } from '../models';
import {
  applySiteNavigationPlan,
  buildSiteNavigationPlanPreview,
  canonicalSiteUrlKey,
  serializeSiteNavigationContext,
} from './aiSiteNavigation';

const data = (): SiteNavigationData => ({
  updatedAt: 100,
  categories: [
    { id: 'tools', name: '工具', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'ip', name: 'IP 检测', parentId: 'tools', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'ai', name: 'AI', order: 1, createdAt: 1, updatedAt: 1 },
  ],
  items: [
    { id: 'ipinfo', title: 'IPinfo', url: 'https://ipinfo.io/', categoryId: 'ip', order: 0, createdAt: 1, updatedAt: 1 },
  ],
});

describe('AI site navigation capability', () => {
  it('serializes existing site navigation context for the agent', () => {
    const context = serializeSiteNavigationContext(data());

    expect(context).toContain('网址导航是 KunTab 独立的网站收藏功能');
    expect(context).toContain('一级分类: 工具');
    expect(context).toContain('二级分类: IP 检测');
    expect(context).toContain('IPinfo');
  });

  it('builds a preview that marks existing, new child, new top, and duplicate sites', () => {
    const preview = buildSiteNavigationPlanPreview(
      {
        sites: [
          { title: 'IPinfo', url: 'https://ipinfo.io', topCategory: '工具', childCategory: 'IP 检测' },
          { title: 'BrowserLeaks', url: 'browserleaks.com/ip', topCategory: '工具', childCategory: '隐私检测' },
          { title: 'OpenAI', url: 'https://openai.com', topCategory: 'AI' },
          { title: 'Example', url: 'https://example.com', topCategory: '资源' },
        ],
      },
      data(),
    );

    expect(preview.items.map((item) => item.categoryStatus)).toEqual(['existing', 'new-child', 'existing', 'new-top']);
    expect(preview.items[0].duplicate).toBe(true);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.selectedIds).toEqual(preview.items.slice(1).map((item) => item.id));
    expect(preview.newChildCategories).toEqual(['工具 / 隐私检测']);
    expect(preview.newTopCategories).toEqual(['资源']);
  });

  it('applies only selected sites and creates missing categories', () => {
    const preview = buildSiteNavigationPlanPreview(
      {
        sites: [
          { title: 'BrowserLeaks', url: 'browserleaks.com/ip', topCategory: '工具', childCategory: '隐私检测' },
          { title: 'AbuseIPDB', url: 'https://www.abuseipdb.com', topCategory: '安全', childCategory: 'IP 信誉' },
          { title: 'Not selected', url: 'https://not-selected.example', topCategory: '安全' },
        ],
      },
      data(),
    );

    const result = applySiteNavigationPlan(data(), preview, preview.items.slice(0, 2).map((item) => item.id));
    const categoryNames = result.data.categories.map((category) => category.name);
    const itemUrls = result.data.items.map((item) => canonicalSiteUrlKey(item.url));

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(categoryNames).toEqual(expect.arrayContaining(['隐私检测', '安全', 'IP 信誉']));
    expect(itemUrls).toEqual(expect.arrayContaining([
      canonicalSiteUrlKey('https://browserleaks.com/ip'),
      canonicalSiteUrlKey('https://www.abuseipdb.com'),
    ]));
    expect(itemUrls).not.toContain(canonicalSiteUrlKey('https://not-selected.example'));
  });

  it('skips duplicates during execution even when selected', () => {
    const preview = buildSiteNavigationPlanPreview(
      {
        sites: [
          { title: 'IPinfo Again', url: 'https://ipinfo.io', topCategory: '工具', childCategory: 'IP 检测' },
        ],
      },
      data(),
    );

    const result = applySiteNavigationPlan(data(), preview, [preview.items[0].id]);

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.data.items).toHaveLength(1);
  });
});
