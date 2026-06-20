import { describe, expect, it } from 'vitest';
import type { SiteNavigationData } from '../models';
import {
  fallbackSiteTitle,
  filterSiteNavItems,
  normalizeSiteUrl,
  resolveSiteIconUrl,
  sanitizeSiteNavigationData,
} from './siteNavigator';

const data = (): SiteNavigationData => ({
  updatedAt: 100,
  categories: [
    { id: 'ai', name: 'AI', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'cloud', name: 'Cloud', order: 1, createdAt: 1, updatedAt: 1 },
    { id: 'llm', name: 'LLM', parentId: 'ai', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'image', name: 'Image', parentId: 'ai', order: 1, createdAt: 1, updatedAt: 1 },
  ],
  items: [
    { id: 'chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com/', categoryId: 'llm', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'midjourney', title: 'Midjourney', url: 'https://midjourney.com/', categoryId: 'image', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'r2', title: 'Cloudflare R2', url: 'https://r2.cloudflarestorage.com/', categoryId: 'cloud', order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'openai', title: 'OpenAI', url: 'https://openai.com/', categoryId: 'ai', order: 1, createdAt: 1, updatedAt: 1 },
  ],
});

describe('site navigator filtering', () => {
  it('shows top-level category items plus child category items', () => {
    expect(filterSiteNavItems(data(), 'ai').map((item) => item.id)).toEqual(['chatgpt', 'midjourney', 'openai']);
  });

  it('shows only the selected child category', () => {
    expect(filterSiteNavItems(data(), 'llm').map((item) => item.id)).toEqual(['chatgpt']);
  });

  it('filters by title, URL, and hostname inside the active category scope', () => {
    expect(filterSiteNavItems(data(), 'ai', 'journey').map((item) => item.id)).toEqual(['midjourney']);
    expect(filterSiteNavItems(data(), 'ai', 'openai.com').map((item) => item.id)).toEqual(['openai']);
    expect(filterSiteNavItems(data(), 'cloud', 'chatgpt')).toEqual([]);
  });
});

describe('site navigator fallbacks', () => {
  it('normalizes URLs with a https default', () => {
    expect(normalizeSiteUrl('example.com')).toBe('https://example.com');
  });

  it('uses hostname as title fallback', () => {
    expect(fallbackSiteTitle('https://www.example.com/path')).toBe('example.com');
  });

  it('uses custom icon first and generated favicon otherwise', () => {
    expect(resolveSiteIconUrl({ url: 'https://example.com', iconUrl: 'https://cdn.example/icon.png' })).toBe(
      'https://cdn.example/icon.png',
    );
    expect(resolveSiteIconUrl({ url: 'https://example.com', iconUrl: '' })).toContain('example.com');
  });

  it('drops third-level categories and items pointing to invalid categories', () => {
    const clean = sanitizeSiteNavigationData({
      categories: [
        { id: 'top', name: 'Top', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'child', name: 'Child', parentId: 'top', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'third', name: 'Third', parentId: 'child', order: 0, createdAt: 1, updatedAt: 1 },
      ],
      items: [
        { id: 'ok', title: 'OK', url: 'ok.example', categoryId: 'child', order: 0, createdAt: 1, updatedAt: 1 },
        { id: 'bad', title: 'Bad', url: 'bad.example', categoryId: 'third', order: 0, createdAt: 1, updatedAt: 1 },
      ],
      updatedAt: 1,
    });

    expect(clean.categories.map((category) => category.id)).toEqual(['top', 'child']);
    expect(clean.items.map((item) => item.id)).toEqual(['ok']);
  });
});
