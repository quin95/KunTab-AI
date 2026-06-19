# R2/S3 配置同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 KunTab 增加基于 Cloudflare R2/S3 兼容存储的手动配置同步能力，只同步插件设置和常用网站，不同步 Chrome 书签树。

**Architecture:** 将同步能力拆成独立纯逻辑和小型 I/O 模块：`storage.ts` 管本地持久化和版本递增，`cloudSync.ts` 管同步 payload、方向判断和常用网站 URL 映射，`s3Client.ts` 管 AWS Signature V4 和对象读写，`App.tsx` 只负责编排 UI 状态和用户选择。备份页提供一个“立即同步”入口，设置页提供 R2/S3 必填配置，冲突时弹窗让用户选择远端优先或本地优先。

**Tech Stack:** React 19、WXT、TypeScript、Chrome extension storage/bookmarks API、browser `fetch`、Web Crypto AWS Signature Version 4、Vitest、`npm run compile`。

---

## File Structure

- Modify: `entrypoints/newtab/models.ts`
  - 新增 S3/R2 配置、同步元数据、远端 payload、同步结果等类型。
- Modify: `entrypoints/newtab/lib/storage.ts`
  - 新增云同步配置和同步元数据存取。
  - 让设置/常用网站变化时递增本地同步版本。
  - 保证写入远端数据时可以跳过版本递增，避免“拉取远端后又标成本地新变更”。
- Create: `entrypoints/newtab/lib/cloudSync.ts`
  - 纯逻辑：构建远端 payload、校验 payload、判断同步方向、常用网站 URL 到 bookmark id 的映射。
- Create: `entrypoints/newtab/lib/cloudSync.test.ts`
  - 覆盖同步方向判断、payload 校验、URL-based 常用网站恢复。
- Create: `entrypoints/newtab/lib/s3Client.ts`
  - 负责 path-style URL、key 规范化、AWS SigV4 签名、GET/PUT JSON。
- Create: `entrypoints/newtab/lib/s3Client.test.ts`
  - 覆盖 key 前缀规范化、对象 key 生成、path-style URL 生成。
- Modify: `package.json` and `package-lock.json`
  - 增加 Vitest 测试依赖和 `test` 脚本。
- Modify: `entrypoints/newtab/App.tsx`
  - 新增云同步 UI 状态、设置表单、备份页“立即同步”按钮、冲突弹窗、toast 文案。
- Modify: `entrypoints/newtab/newtab.css`
  - 新增云同步按钮、状态 badge、冲突弹窗样式。
- Optional Modify: `wxt.config.ts`
  - 如果编译或运行发现 R2 endpoint 被 host permissions 拦截，扩大 host permissions。当前已有 `https://*/*`，预期无需修改。

当前工作区已有用户未提交改动：`README.zh-CN.md`、`entrypoints/newtab/App.tsx`、`verification.md`。实施时必须先查看这些 diff，在修改 `App.tsx` 前确认已有改动位置，不能回滚或覆盖用户改动。

## Task 0: Add Lightweight Unit Test Setup

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add Vitest**

Run:

```bash
npm install -D vitest
```

Expected: `package.json` gains a `vitest` devDependency and `package-lock.json` updates.

- [ ] **Step 2: Add test script**

In `package.json`, add:

```json
"test": "vitest run"
```

Keep existing scripts unchanged.

- [ ] **Step 3: Run empty test command**

Run:

```bash
npm run test
```

Expected: Vitest runs. If Vitest exits non-zero because no tests exist yet, continue to Task 2 before using the script as a gate.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add vitest setup"
```

## Task 1: Add Types And Local Storage Versioning

**Files:**
- Modify: `entrypoints/newtab/models.ts`
- Modify: `entrypoints/newtab/lib/storage.ts`

- [ ] **Step 1: Inspect current user changes before editing**

Run:

```bash
git diff -- entrypoints/newtab/App.tsx entrypoints/newtab/models.ts entrypoints/newtab/lib/storage.ts
```

Expected: understand whether user already changed touched files. Do not revert unrelated changes.

- [ ] **Step 2: Add sync-related types**

In `entrypoints/newtab/models.ts`, add:

```ts
export interface CloudSyncSettings {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
}

export interface CloudSyncMetadata {
  deviceId: string;
  localVersion: number;
  localUpdatedAt: number;
  lastSyncedLocalVersion: number;
  lastRemoteVersion: number;
}

export interface CloudSyncFavoriteSite {
  title: string;
  url: string;
}

export interface CloudSyncData {
  settings: AppSettings;
  favoriteSites: CloudSyncFavoriteSite[];
}

export interface CloudSyncPayload {
  app: 'kuntab';
  schemaVersion: 1;
  remoteVersion: number;
  updatedAt: number;
  updatedByDeviceId: string;
  data: CloudSyncData;
}

export type CloudSyncConflictChoice = 'remote' | 'local' | 'cancel';
```

- [ ] **Step 3: Extend storage defaults and helpers**

In `entrypoints/newtab/lib/storage.ts`:

- Add keys: `kuntab::cloud-sync-settings`, `kuntab::cloud-sync-meta`.
- Add `DEFAULT_CLOUD_SYNC_SETTINGS`.
- Add `getCloudSyncSettings()` / `updateCloudSyncSettings()`.
- Add `getCloudSyncMetadata()` / `setCloudSyncMetadata()`.
- Generate `deviceId` once with `crypto.randomUUID()` fallback.

Implementation sketch:

```ts
function createDeviceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getCloudSyncMetadata(): Promise<CloudSyncMetadata> {
  const saved = await getLocal<Partial<CloudSyncMetadata>>(CLOUD_SYNC_META_KEY, {});
  const metadata = {
    deviceId: saved.deviceId || createDeviceId(),
    localVersion: saved.localVersion ?? 0,
    localUpdatedAt: saved.localUpdatedAt ?? 0,
    lastSyncedLocalVersion: saved.lastSyncedLocalVersion ?? 0,
    lastRemoteVersion: saved.lastRemoteVersion ?? 0,
  };
  if (!saved.deviceId) await setLocal(CLOUD_SYNC_META_KEY, metadata);
  return metadata;
}
```

- [ ] **Step 4: Add version bumping without affecting credential edits**

Create helper:

```ts
async function bumpCloudSyncLocalVersion(): Promise<void> {
  const current = await getCloudSyncMetadata();
  await setCloudSyncMetadata({
    ...current,
    localVersion: current.localVersion + 1,
    localUpdatedAt: Date.now(),
  });
}
```

Call it from:

- `updateSettings()`
- `setFavorites()`
- `replaceFromBackup()`

Do not call it from `updateCloudSyncSettings()`.

Add a separate restore helper for remote sync:

```ts
export async function replaceFromCloudSync(settings: AppSettings, favorites: FavoritesState): Promise<void> {
  await setSync(SETTINGS_KEY, settings);
  await setSync(FAVORITES_KEY, favorites);
}
```

This helper intentionally does not bump `localVersion`; the sync orchestration updates metadata after successful remote apply.

- [ ] **Step 5: Run compile**

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/newtab/models.ts entrypoints/newtab/lib/storage.ts
git commit -m "feat(sync): add cloud sync storage metadata"
```

## Task 2: Add Sync Decision And Payload Logic

**Files:**
- Create: `entrypoints/newtab/lib/cloudSync.ts`
- Create: `entrypoints/newtab/lib/cloudSync.test.ts`
- Modify: `entrypoints/newtab/lib/backup.ts` only if URL normalization should be shared instead of duplicated.

- [ ] **Step 1: Write failing tests for sync decisions**

Create `entrypoints/newtab/lib/cloudSync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideCloudSyncDirection } from './cloudSync';
import type { CloudSyncMetadata, CloudSyncPayload } from '../models';

const metadata = (patch: Partial<CloudSyncMetadata> = {}): CloudSyncMetadata => ({
  deviceId: 'device-a',
  localVersion: 1,
  localUpdatedAt: 100,
  lastSyncedLocalVersion: 1,
  lastRemoteVersion: 1,
  ...patch,
});

const remote = (version = 1): CloudSyncPayload => ({
  app: 'kuntab',
  schemaVersion: 1,
  remoteVersion: version,
  updatedAt: 100,
  updatedByDeviceId: 'device-b',
  data: {
    settings: {} as any,
    favoriteSites: [],
  },
});

describe('decideCloudSyncDirection', () => {
  it('initializes when remote is missing', () => {
    expect(decideCloudSyncDirection(metadata(), null)).toBe('upload-initialize');
  });

  it('uploads when only local changed', () => {
    expect(decideCloudSyncDirection(metadata({ localVersion: 2 }), remote(1))).toBe('upload');
  });

  it('downloads when only remote changed', () => {
    expect(decideCloudSyncDirection(metadata(), remote(2))).toBe('download');
  });

  it('reports noop when both sides are already synced', () => {
    expect(decideCloudSyncDirection(metadata(), remote(1))).toBe('noop');
  });

  it('reports conflict when both sides changed', () => {
    expect(decideCloudSyncDirection(metadata({ localVersion: 2 }), remote(2))).toBe('conflict');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts
```

Expected: FAIL because `cloudSync.ts` does not exist or exports are missing.

- [ ] **Step 3: Create pure sync decision module**

Create `entrypoints/newtab/lib/cloudSync.ts` with:

```ts
import type {
  AppSettings,
  CloudSyncData,
  CloudSyncFavoriteSite,
  CloudSyncMetadata,
  CloudSyncPayload,
  FavoritesState,
  FlatBookmark,
} from '../models';

export type CloudSyncDirection = 'upload-initialize' | 'upload' | 'download' | 'noop' | 'conflict';

export function decideCloudSyncDirection(
  metadata: CloudSyncMetadata,
  remote: CloudSyncPayload | null,
): CloudSyncDirection {
  if (!remote) return 'upload-initialize';
  const localChanged = metadata.localVersion !== metadata.lastSyncedLocalVersion;
  const remoteChanged = remote.remoteVersion !== metadata.lastRemoteVersion;
  if (localChanged && remoteChanged) return 'conflict';
  if (localChanged) return 'upload';
  if (remoteChanged) return 'download';
  return 'noop';
}
```

- [ ] **Step 4: Build remote payload from current local state**

Add:

```ts
export function buildCloudSyncPayload(params: {
  settings: AppSettings;
  favoriteSites: CloudSyncFavoriteSite[];
  metadata: CloudSyncMetadata;
  previousRemoteVersion: number;
}): CloudSyncPayload {
  return {
    app: 'kuntab',
    schemaVersion: 1,
    remoteVersion: params.previousRemoteVersion + 1,
    updatedAt: Date.now(),
    updatedByDeviceId: params.metadata.deviceId,
    data: {
      settings: sanitizeSettingsForCloud(params.settings),
      favoriteSites: params.favoriteSites,
    },
  };
}
```

`sanitizeSettingsForCloud()` should remove cloud credentials if those ever become part of `AppSettings`; with the current design cloud credentials live separately, so it can return `settings`.

- [ ] **Step 5: Add payload validation**

Add:

```ts
export function parseCloudSyncPayload(value: unknown): CloudSyncPayload {
  if (!value || typeof value !== 'object') throw new Error('远端同步文件格式无效');
  const payload = value as CloudSyncPayload;
  if (payload.app !== 'kuntab' || payload.schemaVersion !== 1) throw new Error('远端同步文件格式无效');
  if (!Number.isFinite(payload.remoteVersion) || payload.remoteVersion < 1) throw new Error('远端同步版本无效');
  if (!payload.data || !payload.data.settings || !Array.isArray(payload.data.favoriteSites)) {
    throw new Error('远端同步数据不完整');
  }
  return payload;
}
```

- [ ] **Step 6: Add favorite conversion helpers**

Add:

```ts
export function collectCloudFavoriteSites(favorites: string[], allBookmarks: FlatBookmark[]): CloudSyncFavoriteSite[] {
  const byId = new Map(allBookmarks.map((bookmark) => [bookmark.id, bookmark]));
  return favorites
    .map((id) => byId.get(id))
    .filter((bookmark): bookmark is FlatBookmark => Boolean(bookmark))
    .map((bookmark) => ({ title: bookmark.title, url: bookmark.url }));
}

export function resolveCloudFavoriteSites(
  favoriteSites: CloudSyncFavoriteSite[],
  allBookmarks: FlatBookmark[],
): { favorites: FavoritesState; skipped: number } {
  // normalize URL, map remote URLs to local bookmark IDs, skip missing URLs
}
```

- [ ] **Step 7: Add tests for payload validation and favorite URL matching**

Extend `cloudSync.test.ts` with tests for:

- `parseCloudSyncPayload()` rejects wrong `app`, wrong `schemaVersion`, and missing `data`.
- `resolveCloudFavoriteSites()` matches URLs ignoring hash and URL case.
- Missing URLs increment `skipped`.

- [ ] **Step 8: Run tests**

Run:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run compile**

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 10: Commit**

```bash
git add entrypoints/newtab/lib/cloudSync.ts entrypoints/newtab/lib/cloudSync.test.ts
git commit -m "feat(sync): add cloud sync decision logic"
```

## Task 3: Add S3-Compatible JSON Client

**Files:**
- Create: `entrypoints/newtab/lib/s3Client.ts`
- Create: `entrypoints/newtab/lib/s3Client.test.ts`

- [ ] **Step 1: Write failing tests for key and URL helpers**

Create `entrypoints/newtab/lib/s3Client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPathStyleObjectUrl, buildS3ObjectKey, normalizeS3KeyPrefix } from './s3Client';

describe('S3 key helpers', () => {
  it('normalizes leading and trailing slashes', () => {
    expect(normalizeS3KeyPrefix('/kuntab/dev/')).toBe('kuntab/dev');
  });

  it('requires a non-empty key prefix', () => {
    expect(() => buildS3ObjectKey('   ')).toThrow('Key 前缀不能为空');
  });

  it('builds the fixed KunTab sync object key', () => {
    expect(buildS3ObjectKey('kuntab')).toBe('kuntab/kuntab-sync.json');
  });

  it('builds a path-style encoded object URL', () => {
    const url = buildPathStyleObjectUrl('https://example.r2.cloudflarestorage.com/', 'backup', 'kuntab/a file.json');
    expect(url.toString()).toBe('https://example.r2.cloudflarestorage.com/backup/kuntab/a%20file.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- entrypoints/newtab/lib/s3Client.test.ts
```

Expected: FAIL because `s3Client.ts` does not exist or exports are missing.

- [ ] **Step 3: Implement key and endpoint normalization**

Create helpers:

```ts
export function normalizeS3KeyPrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, '');
}

export function buildS3ObjectKey(prefix: string): string {
  const normalized = normalizeS3KeyPrefix(prefix);
  if (!normalized) throw new Error('Key 前缀不能为空');
  return `${normalized}/kuntab-sync.json`;
}

export function buildPathStyleObjectUrl(endpoint: string, bucket: string, key: string): URL {
  const base = endpoint.trim().replace(/\/+$/g, '');
  if (!base) throw new Error('端点地址不能为空');
  if (!bucket.trim()) throw new Error('Bucket 不能为空');
  return new URL(`${base}/${encodeURIComponent(bucket.trim())}/${key.split('/').map(encodeURIComponent).join('/')}`);
}
```

- [ ] **Step 4: Implement Web Crypto signing helpers**

Add SHA-256, HMAC, hex encoding, canonical request, string-to-sign, and Authorization header generation for AWS Signature V4.

Important constants:

```ts
const SERVICE = 's3';
const REGION = 'auto';
const ALGORITHM = 'AWS4-HMAC-SHA256';
```

Required signed headers for GET/PUT:

- `host`
- `x-amz-content-sha256`
- `x-amz-date`

For PUT also include:

- `content-type: application/json;charset=utf-8`

- [ ] **Step 5: Implement JSON object methods**

Add:

```ts
export async function getS3Json<T>(settings: CloudSyncSettings, key: string): Promise<T | null> {
  // GET signed URL, return null on 404, throw on other non-2xx
}

export async function putS3Json(settings: CloudSyncSettings, key: string, value: unknown): Promise<void> {
  // PUT signed JSON, throw on non-2xx
}
```

Errors should include HTTP status and response text where available.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- entrypoints/newtab/lib/s3Client.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run compile**

Before compile, run the sync unit tests to catch regressions:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts
```

Expected: PASS.

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/newtab/lib/s3Client.ts entrypoints/newtab/lib/s3Client.test.ts
git commit -m "feat(sync): add s3 compatible json client"
```

## Task 4: Wire Manual Sync Into App Logic

**Files:**
- Modify: `entrypoints/newtab/App.tsx`
- Modify: `entrypoints/newtab/lib/storage.ts` if additional metadata helper is needed.

- [ ] **Step 1: Re-read current App changes**

Run:

```bash
git diff -- entrypoints/newtab/App.tsx
```

Expected: understand and preserve user changes before editing.

- [ ] **Step 2: Import cloud sync helpers**

In `App.tsx`, import storage, sync, and S3 helpers:

```ts
import {
  getCloudSyncSettings,
  updateCloudSyncSettings,
  getCloudSyncMetadata,
  setCloudSyncMetadata,
  replaceFromCloudSync,
} from './lib/storage';
import {
  buildCloudSyncPayload,
  collectCloudFavoriteSites,
  decideCloudSyncDirection,
  parseCloudSyncPayload,
  resolveCloudFavoriteSites,
} from './lib/cloudSync';
import { buildS3ObjectKey, getS3Json, putS3Json } from './lib/s3Client';
```

- [ ] **Step 3: Add React state**

Add state for:

```ts
const [cloudSyncSettings, setCloudSyncSettingsState] = useState(DEFAULT_CLOUD_SYNC_SETTINGS);
const [cloudSyncing, setCloudSyncing] = useState(false);
const [cloudSyncConflict, setCloudSyncConflict] = useState<CloudSyncPayload | null>(null);
const [cloudSyncRemoteVersion, setCloudSyncRemoteVersion] = useState<number>(0);
```

Load cloud settings in `reloadStorage()`.

- [ ] **Step 4: Implement upload/apply helpers**

Add functions inside `App`:

```ts
const uploadCloudSyncState = async (previousRemoteVersion: number) => {
  const metadata = await getCloudSyncMetadata();
  const key = buildS3ObjectKey(cloudSyncSettings.keyPrefix);
  const favoriteSites = collectCloudFavoriteSites(favorites, allBookmarks);
  const payload = buildCloudSyncPayload({ settings, favoriteSites, metadata, previousRemoteVersion });
  await putS3Json(cloudSyncSettings, key, payload);
  await setCloudSyncMetadata({
    ...metadata,
    lastSyncedLocalVersion: metadata.localVersion,
    lastRemoteVersion: payload.remoteVersion,
  });
  return payload;
};

const applyRemoteCloudSyncState = async (payload: CloudSyncPayload) => {
  const resolved = resolveCloudFavoriteSites(payload.data.favoriteSites, allBookmarks);
  await replaceFromCloudSync(payload.data.settings, resolved.favorites);
  const metadata = await getCloudSyncMetadata();
  await setCloudSyncMetadata({
    ...metadata,
    localVersion: metadata.localVersion,
    localUpdatedAt: Date.now(),
    lastSyncedLocalVersion: metadata.localVersion,
    lastRemoteVersion: payload.remoteVersion,
  });
  await reloadStorage();
  if (resolved.skipped > 0) showToast(`同步完成，${resolved.skipped} 个常用网站因本机书签缺失被跳过`);
};
```

During implementation, ensure metadata values remain internally consistent after remote apply. If `localVersion` should become the synchronized version, compute the next metadata object before saving rather than using stale values.

- [ ] **Step 5: Implement "Sync Now" orchestration**

Add:

```ts
const onCloudSyncNow = async () => {
  try {
    setCloudSyncing(true);
    const key = buildS3ObjectKey(cloudSyncSettings.keyPrefix);
    const metadata = await getCloudSyncMetadata();
    const rawRemote = await getS3Json<unknown>(cloudSyncSettings, key);
    const remote = rawRemote ? parseCloudSyncPayload(rawRemote) : null;
    const direction = decideCloudSyncDirection(metadata, remote);
    if (direction === 'upload-initialize' || direction === 'upload') {
      const payload = await uploadCloudSyncState(remote?.remoteVersion ?? 0);
      showToast(direction === 'upload-initialize' ? `云端同步已初始化 v${payload.remoteVersion}` : `已上传到云端 v${payload.remoteVersion}`);
      return;
    }
    if (direction === 'download' && remote) {
      await applyRemoteCloudSyncState(remote);
      showToast(`已从云端同步 v${remote.remoteVersion}`);
      return;
    }
    if (direction === 'noop') {
      showToast('云端和本地已是最新');
      return;
    }
    if (direction === 'conflict' && remote) {
      setCloudSyncConflict(remote);
      setCloudSyncRemoteVersion(remote.remoteVersion);
      showToast('检测到多设备同步冲突，请选择保留哪一侧');
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '云同步失败');
  } finally {
    setCloudSyncing(false);
  }
};
```

- [ ] **Step 6: Implement conflict actions**

Add:

```ts
const resolveCloudSyncConflict = async (choice: CloudSyncConflictChoice) => {
  if (!cloudSyncConflict || choice === 'cancel') {
    setCloudSyncConflict(null);
    return;
  }
  try {
    setCloudSyncing(true);
    if (choice === 'remote') {
      await applyRemoteCloudSyncState(cloudSyncConflict);
      showToast(`已使用远端版本 v${cloudSyncConflict.remoteVersion}`);
    } else {
      const payload = await uploadCloudSyncState(cloudSyncConflict.remoteVersion);
      showToast(`已使用本地配置覆盖远端 v${payload.remoteVersion}`);
    }
    setCloudSyncConflict(null);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '冲突处理失败');
  } finally {
    setCloudSyncing(false);
  }
};
```

- [ ] **Step 7: Run compile**

Before compile, run the sync unit tests to catch regressions:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts
```

Expected: PASS.

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/newtab/App.tsx entrypoints/newtab/lib/storage.ts
git commit -m "feat(sync): wire manual cloud sync"
```

## Task 5: Add Settings And Backup UI

**Files:**
- Modify: `entrypoints/newtab/App.tsx`
- Modify: `entrypoints/newtab/newtab.css`

- [ ] **Step 1: Add locale strings**

Add Chinese and English strings in `LOCALE_TEXT`:

```ts
cloudSyncSettingsTitle: '云同步设置',
cloudSyncEndpoint: '端点地址',
cloudSyncBucket: 'Bucket',
cloudSyncAccessKeyId: 'Access Key ID',
cloudSyncSecretAccessKey: 'Secret Access Key',
cloudSyncKeyPrefix: 'Key 前缀',
cloudSyncNow: '立即同步',
cloudSyncing: '同步中...',
cloudSyncDesc: '使用 R2/S3 兼容存储同步 KunTab 设置和常用网站',
cloudSyncConflictTitle: '检测到同步冲突',
cloudSyncConflictDesc: '本地和远端自上次同步后都发生了变化，请选择保留哪一侧。',
cloudSyncUseRemote: '使用远端',
cloudSyncUseLocal: '使用本地',
```

- [ ] **Step 2: Add settings card**

In the settings page, add a `settings-card` after AI settings or before Misc:

```tsx
<article className="settings-card">
  <h3>{text.cloudSyncSettingsTitle}</h3>
  {/* endpoint, bucket, access key id, secret, key prefix rows */}
</article>
```

Use existing `settings-row`, `setting-left`, `setting-icon-wrap`, and input patterns. Use password input for Secret Access Key.

- [ ] **Step 3: Add backup page sync card/action**

In backup page, add one cloud sync panel or a compact action block below existing import/export cards:

```tsx
<article className="backup-card cloud-sync-card">
  <div className="backup-card-icon-container cloud-blue">
    <Cloud size={32} />
  </div>
  <h3>{text.cloudSyncNow}</h3>
  <p className="backup-card-desc">{text.cloudSyncDesc}</p>
  <button className="primary backup-btn" onClick={onCloudSyncNow} disabled={cloudSyncing}>
    {cloudSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
    {cloudSyncing ? text.cloudSyncing : text.cloudSyncNow}
  </button>
</article>
```

Import `Cloud` and `RefreshCw` from `lucide-react`.

- [ ] **Step 4: Add conflict modal**

Near existing modals, add:

```tsx
{cloudSyncConflict && (
  <div className="modal-mask" onClick={() => resolveCloudSyncConflict('cancel')}>
    <div className="modal-card" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header">
        <h3>{text.cloudSyncConflictTitle}</h3>
        <button onClick={() => resolveCloudSyncConflict('cancel')}>{text.close}</button>
      </div>
      <div className="modal-body">
        <p className="cloud-sync-conflict-desc">{text.cloudSyncConflictDesc}</p>
      </div>
      <div className="modal-actions">
        <button onClick={() => resolveCloudSyncConflict('remote')}>{text.cloudSyncUseRemote}</button>
        <button className="primary" onClick={() => resolveCloudSyncConflict('local')}>{text.cloudSyncUseLocal}</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add CSS**

Add minimal styles:

```css
.backup-card-icon-container.cloud-blue {
  background: var(--primary-soft);
  color: var(--primary);
}

.cloud-sync-conflict-desc {
  color: var(--muted);
  line-height: 1.6;
}
```

Reuse existing modal/button layout. Avoid nested cards.

- [ ] **Step 6: Run compile**

Before compile, run:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts
```

Expected: PASS.

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 7: Commit**

```bash
git add entrypoints/newtab/App.tsx entrypoints/newtab/newtab.css
git commit -m "feat(sync): add cloud sync ui"
```

## Task 6: Manual Verification

**Files:**
- Modify: `verification.md` only if project convention expects verification notes there.

- [ ] **Step 1: Run compile**

Run unit tests first:

```bash
npm run test -- entrypoints/newtab/lib/cloudSync.test.ts entrypoints/newtab/lib/s3Client.test.ts
```

Expected: PASS.

Run:

```bash
npm run compile
```

Expected: TypeScript passes.

- [ ] **Step 2: Start dev server**

Run:

```bash
npm run dev
```

Expected: WXT dev server starts and prints extension build output.

- [ ] **Step 3: Verify settings UI**

Open the extension new tab UI and verify:

- Settings page shows Cloud Sync settings.
- Endpoint, Bucket, Access Key ID, Secret Access Key, and Key prefix persist after reload.
- Editing these credential fields does not unexpectedly change synced app settings.

- [ ] **Step 4: Verify sync outcomes with a test R2 bucket**

Use a disposable prefix such as `kuntab-test/<timestamp>`.

Scenarios:

- Remote missing: click sync, expect remote file created.
- No changes: click sync again, expect "already up to date".
- Remote newer: edit remote JSON version/data manually, click sync, expect local settings/favorites update.
- Local newer: edit local KunTab setting, click sync, expect remote version increments.
- Conflict: make local change, manually change remote version/data, click sync, expect conflict modal. Test both "使用远端" and "使用本地" with separate prefixes.

- [ ] **Step 5: Verify favorite URL matching**

Prepare one remote favorite URL that exists locally and one that does not. Apply remote. Expected: existing URL becomes favorite, missing URL is skipped and toast reports skipped count.

- [ ] **Step 6: Commit verification docs if touched**

```bash
git add verification.md
git commit -m "docs: record cloud sync verification"
```

Skip if `verification.md` is not updated.

## Risks And Notes

- Browser extensions may hit R2 CORS restrictions. The R2 bucket must allow the extension origin or appropriate requests. Error toasts should expose enough status text to diagnose CORS/permission failures.
- AWS SigV4 is sensitive to canonical path and header mismatches. Keep `s3Client.ts` small and deterministic.
- Do not include S3/R2 credentials in the cloud payload.
- Do not sync Chrome bookmark tree data.
- Conflict resolution must not update metadata until the chosen action succeeds.
