# 首页背景图全屏与毛玻璃化设计规范

## 1. 概述
在 KunTab 首页（新标签页）中，将原有的顶部半屏横幅背景图（`.scenic-bg`）修改为全屏铺满背景。同时，为保证在有背景图的情况下整体界面的高级感与文字可读性，将左侧侧边栏、搜索卡片、收藏夹面板、最近打开面板等组件在首页状态下改造为半透明毛玻璃（Glassmorphism）视觉样式。

## 2. 方案设计

### 2.1 结构控制与状态激活 (React / TypeScript)
在 [App.tsx](file:///Users/quentin/Documents/me/code-open/bookmark-ai/entrypoints/newtab/App.tsx) 中：
- 当 `activeTab === 'home'` 时，给外层 shell 容器 `<div className="app-shell">` 添加 `.has-scenic-bg` 类名。
- 使得 CSS 能够根据该类名对侧边栏和主体内容区域进行范围限定样式调整，避免影响其他非首页标签页（如书签管理、备份恢复等页面）。

### 2.2 样式重构 (CSS)
在 [newtab.css](file:///Users/quentin/Documents/me/code-open/bookmark-ai/entrypoints/newtab/newtab.css) 中：

1. **背景图全屏定位 (`.scenic-bg`)**
   - 宽度：`100vw`，高度：`100vh`。
   - 定位：`fixed; top: 0; left: 0;`。
   - 层级：`z-index: 0;`。
   - 移除原有的底部渐变遮罩 (`.scenic-bg::after`)，避免阻挡下半屏幕。
   - 保持原有的暗色模式饱和度与亮度过滤逻辑（`opacity: 0.25; filter: saturate(0.85) brightness(0.6);`）。

2. **侧边栏透明玻璃化 (`.app-shell.has-scenic-bg .sidebar`)**
   - 背景色：
     - 浅色模式下为带透明度的白色：`background: rgba(255, 255, 255, 0.4);`
     - 深色模式下为带透明度的深蓝灰：`background: rgba(15, 23, 42, 0.4);`
   - 毛玻璃滤镜：`backdrop-filter: blur(20px);`
   - 边框：将右侧边框改为更柔和的半透明边框，例如 `border-right: 1px solid rgba(255, 255, 255, 0.1);`。

3. **主内容区域与卡片玻璃化 (`.app-shell.has-scenic-bg .panel`, `.search-card`)**
   - 主内容区容器背景置为透明：`background: transparent;`。
   - 搜索卡片与各种面板卡片改用毛玻璃样式：
     - 浅色模式：`background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.3);`
     - 深色模式：`background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(255, 255, 255, 0.08);`
     - 开启滤镜：`backdrop-filter: blur(20px);`
     - 阴影调整：使用更轻量、柔和的阴影，避免在背景图上显得过于厚重。

4. **内部输入框与交互按钮微调**
   - 搜索输入框包裹容器 (`.search-input-wrap`) 降低白底的不透明度，使其更好地同毛玻璃卡片融合。
   - 快捷搜索引擎按钮、添加站点按钮背景进行相应的透明度与悬停反馈优化。

## 3. 验证方案
- **手动测试**：
  1. 启动本地开发服务，打开新标签页。
  2. 观察背景图是否铺满整个浏览器视口（包括左侧侧边栏区域）。
  3. 切换深浅色主题，确保两种主题下的背景图过滤、侧边栏文字和卡片文字均有足够对比度且保持高清晰度。
  4. 切换侧边栏菜单（如点击“全部书签”、“备份与恢复”），确认侧边栏背景恢复为原有的实色，避免其他页面也受背景干扰。
