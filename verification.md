# KunTab V1 验证记录

## 1. 功能完成情况（对照 PRD）

- 首页 Dashboard
  - 搜索栏支持书签搜索与命令搜索（`g/bd/b/gh/ai/yt`）
  - 默认搜索引擎可配置并生效
  - 常用书签支持添加、移除、拖拽排序（自动保存）
  - 最近打开基于用户点击记录（本地缓存）
- 书签页面
  - 左侧文件夹树 + 全部书签视图
  - 书签搜索（标题/URL）
  - 新建文件夹
  - 书签操作：打开、在新标签打开、编辑（标题/URL/所属文件夹）、删除、设为常用
  - 导入/导出入口跳转到备份页面
- 备份页面
  - 导出 JSON（包含书签树、常用书签配置、设置项）
  - 导出 HTML（增强能力，兼容性导出）
  - 导入 JSON（恢复结构并合并到现有书签，重复 URL 自动跳过）
  - 导入文件大小校验（10MB 上限）
  - 云同步：通过 R2/S3 兼容存储手动同步 KunTab 设置与常用书签，不同步 Chrome 书签树
- 设置页面
  - 语言（中英文 UI 文案切换）
  - 默认搜索引擎
  - 启动页（首页/书签）
  - 主题（浅色/深色/跟随系统）
  - 紧凑布局
  - 字体大小
  - 云同步设置（Endpoint、Bucket、Access Key ID、Secret Access Key、Key 前缀）
  - 清除本地缓存（重置插件设置与常用书签，不删除 Chrome 书签）
  - 关于版本信息
- 同步与存储
  - `browser.storage.sync`：设置项 + 常用书签
  - `browser.storage.local`：最近打开记录、云同步凭证、本机同步版本元数据
  - R2/S3 云同步文件：只包含 KunTab 设置、常用书签 URL 列表和远端版本元数据
- 新标签页接管
  - 已配置 `chrome_url_overrides.newtab = newtab.html`
- 安全与权限
  - 移除 V1 不需要的 content script
  - 权限收敛为 `bookmarks` + `storage`
  - 新标签打开优先使用 `tabs.create` 风格能力（`browser.tabs.create`），不可用时回退 `window.open`
  - `browser/chrome` 双兼容运行时桥接，避免仅 `browser.*` 导致的 Chrome 版本兼容问题

## 2. 构建与类型验证

已执行：

```bash
npm install
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts
npm run compile
npm run build
```

结果：

- `npm run compile` 通过（`tsc --noEmit`）
- `npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts` 通过（2 个测试文件，15 条用例）
- `npm run build` 通过（生成 `.output/chrome-mv3`）
- 产物 manifest 包含：
  - `permissions`: `bookmarks`, `storage`
  - `chrome_url_overrides.newtab`

## 3. 实现优化决策（相对竞品）

- 未引入竞品中的 AI、清理中心、悬浮球、侧边栏等 V2 功能，严格按 V1 PRD 收敛，减少复杂度和审核风险。
- 移除了无业务价值的 content script 入口，避免不必要的注入范围。
- 备份导入采用“新增合并 + 重复跳过”策略，避免覆盖/破坏用户现有书签。

## 4. 已知风险与后续建议

- 目前未引入自动化 E2E（已完成单元测试、构建与类型验证），建议后续补充 Playwright 关键路径回归。
- R2/S3 云同步需要用户侧 bucket CORS 允许扩展发起的 `GET`/`PUT` 请求，并允许 `authorization`、`x-amz-content-sha256`、`x-amz-date` 等请求头。
- 书签管理暂无批量操作（批量删除/批量移动）与分页能力，可在 V1.1 增强。

## 5. 原型视觉补齐（本轮）

- 侧边栏、顶部操作区、搜索区、模块标题、书签表格操作按钮、设置项标签已补齐图标。
- 搜索引擎快捷按钮补充 favicon 图标。
- 同步调整按钮/标题/表格操作区的间距与对齐，贴近原型信息层级。
