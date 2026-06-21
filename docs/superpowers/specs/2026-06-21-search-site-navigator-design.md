# 2026-06-21 Search Site Navigator Design Spec

This specification documents the changes required to allow the homepage center search function to query and display site navigator data in addition to bookmarks, distinguishing between them visually using unified tag styling.

## Proposed Changes

### Component 1: Entrypoints/newtab/App.tsx

We will make the following modifications:
1. **Translations**: Add `sourceBookmark` and `sourceSiteNavigator` properties to both `zh-CN` and `en-US` dictionaries.
2. **Search Matching Logic (`homeSearchMatches`)**: Extend the search query matching to query bookmarks from `allBookmarks` and site navigator items from `siteNavigation.items` concurrently. We map both sources to a unified search result format:
   - `id`: string
   - `title`: string
   - `url`: string
   - `source`: 'bookmark' | 'site-navigator'
   - `groupName`: string (representing folderName or categoryName)
   - Extra fields to avoid breaking the bookmark model type assertions
3. **UI rendering**: Render suggestion items using the unified results, displaying tags with the source type and group name (e.g. `书签 · 学习` vs `网址导航 · 工具`). Use class `.tag-sitenav` for site navigator items.

### Component 2: Entrypoints/newtab/newtab.css

1. **Tag Styles**: Add styling definitions for `.folder-pill`, `.tag-default`, `.tag-dev`, `.tag-tool`, `.tag-design`, `.tag-ent`, and `.tag-sitenav`.
2. **Tag Hover/Transitions**: Ensure tags transition smoothly.

---

## Verification Plan

### Manual Verification
- Start the dev server.
- Enter queries that match bookmarks, verify that the list displays tags like `书签 · 文件夹名`.
- Enter queries that match site navigator items, verify that the list displays tags like `网址导航 · 分类名` with a cyan themed tag.
- Click a site navigator suggestion, verify it opens in a new tab and appears in the "最近打开" list.
