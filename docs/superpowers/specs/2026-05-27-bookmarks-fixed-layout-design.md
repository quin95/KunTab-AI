# 2026-05-27 书签页面固定区域布局设计文档

## 需求背景
目前书签页面的布局在桌面端会跟随页面整体滚动。用户希望将页面改为固定视口高度（Viewport-fixed）布局：
1. **左侧文件夹面板固定**：高度填满页面，且不能随整个页面滚动（只在内容溢出时在内部滚动）。
2. **右侧顶栏与底栏固定**：右侧的全部/网页/文件夹切换栏和搜索栏（顶栏）以及分页底栏（底栏）固定在页面顶端和底端。
3. **中间书签区域滚动**：只有中间的书签网格区域支持上下滚动查看更多书签。
4. **整个页面无法滚动**：主页面容器不能出现全局滚动条。
5. **响应式降级**：该固定布局仅在桌面端大屏（宽度 > 1024px）生效，移动端/平板端（宽度 ≤ 1024px）仍采用原有的自然堆叠与页面滚动方式。

## 方案设计

### 1. 结构调整 (React)
在 `entrypoints/newtab/App.tsx` 中，对 `.content` 容器动态添加 `content-bookmarks-fixed` 状态类，仅在 activeTab 为 `'bookmarks'` 时触发。

```tsx
<main className={`content ${activeTab === 'bookmarks' ? 'content-bookmarks-fixed' : ''}`}>
```

### 2. 样式调整 (CSS)
在 `entrypoints/newtab/newtab.css` 中增加媒体查询，为大屏端设置固定高度与 Flex 布局逻辑：

```css
@media (min-width: 1025px) {
  /* 禁用主内容区滚动 */
  .content.content-bookmarks-fixed {
    overflow: hidden;
  }

  /* 书签页铺满且不滚动 */
  .content-bookmarks-fixed .bookmark-page {
    height: 100%;
    overflow: hidden;
  }

  /* 布局铺满，垂直对齐采用 stretch */
  .content-bookmarks-fixed .bookmark-layout {
    height: 100%;
    align-items: stretch;
    overflow: hidden;
  }

  /* 左侧文件夹面板高度 100%，自身不滚动 */
  .content-bookmarks-fixed .folder-tree {
    height: 100%;
    position: static;
  }

  /* 右侧列为 flex 容器，高度 100%，自身不滚动 */
  .content-bookmarks-fixed .bookmark-main-content {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    gap: 1rem;
  }

  /* 右侧顶栏不缩放 */
  .content-bookmarks-fixed .bookmark-top-bar {
    flex-shrink: 0;
  }

  /* 中间书签网格区域高度自适应，支持滚动 */
  .content-bookmarks-fixed .bookmark-grid {
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
  }

  /* 底部页码不缩放 */
  .content-bookmarks-fixed .pagination-footer {
    flex-shrink: 0;
  }
}
```

## 验证计划
1. 打开书签页面，确认浏览器的主滚动条消失，页面不能整体滚动。
2. 确认左侧文件夹面板在有很多分类时，只有文件夹树内部出现滚动条，外部固定。
3. 确认右侧切换标签（全部、网页、文件夹）和搜索框在滚动书签时保持在最上方。
4. 确认分页脚部（如：共 X 项）在滚动书签时保持在最下方。
5. 拖动并滚动书签网格，确保书签卡片能正常上下滚动显示。
6. 调整浏览器窗口宽度小于 1024px，确认布局退回上下堆叠形式，且页面可正常上下滚动。
