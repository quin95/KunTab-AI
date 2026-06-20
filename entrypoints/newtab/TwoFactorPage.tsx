import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CloudSyncSettings,
  EncryptedTwoFactorVault,
  TwoFactorCloudConflictChoice,
  TwoFactorCloudPayload,
  TwoFactorEntry,
  TwoFactorSyncMetadata,
  TwoFactorVaultData,
} from './models';
import {
  getEncryptedTwoFactorVault,
  getTwoFactorSyncMetadata,
  replaceEncryptedTwoFactorVaultFromCloud,
  setEncryptedTwoFactorVault,
  setTwoFactorSyncMetadata,
} from './lib/storage';
import { buildS3TwoFactorObjectKey, getS3Json, putS3Json } from './lib/s3Client';
import {
  buildTwoFactorCloudPayload,
  decideTwoFactorCloudSyncDirection,
  parseTwoFactorCloudPayload,
} from './lib/twoFactorCloudSync';
import {
  createEmptyTwoFactorVaultData,
  decryptTwoFactorVault,
  encryptTwoFactorVault,
} from './lib/twoFactorVault';
import {
  assertValidTotpSecret,
  generateTotp,
  getTotpProgress,
  getTotpRemainingSeconds,
  normalizeTotpSecret,
} from './lib/totp';
import { formatDateTime } from './lib/utils';

interface TwoFactorPageProps {
  language: 'zh-CN' | 'en-US';
  cloudSyncSettings: CloudSyncSettings;
  onOpenCloudSettings: () => void;
  onToast: (message: string) => void;
}

const TEXT = {
  'zh-CN': {
    title: '2FA 验证器',
    desc: '保存多个平台账号的 Google Authenticator 密钥，在本地生成动态验证码。',
    introWhatTitle: '什么是 2FA',
    introWhatDesc: '2FA 是双重验证，登录时除了密码，还要输入每 30 秒变化的动态验证码。',
    introUseTitle: '这里能做什么',
    introUseDesc: '把不同平台账号的 2FA 密钥保存好，需要登录时直接复制当前验证码。',
    introSecureTitle: '密钥怎么保存',
    introSecureDesc: '保险箱会用你的口令加密，本机保存；同步到 R2/S3 的也是加密文件。',
    introHelpTitle: '使用帮助与安全说明',
    createTitle: '创建 2FA 保险箱',
    createDesc: '保险箱会用口令加密后保存在本机，也可以手动同步到 R2/S3。',
    unlockTitle: '解锁 2FA 保险箱',
    unlockDesc: '输入保险箱口令后，本次会话内可直接取码。',
    passphrase: '保险箱口令',
    confirmPassphrase: '确认口令',
    createVault: '创建保险箱',
    unlockVault: '解锁',
    lockVault: '锁定',
    passphraseMismatch: '两次输入的保险箱口令不一致',
    passphraseRequired: '请输入保险箱口令',
    searchPlaceholder: '搜索平台、账号或备注',
    addEntry: '添加账号',
    editEntry: '编辑账号',
    emptyTitle: '还没有 2FA 账号',
    emptyDesc: '添加平台、账号和 2FA 密钥后，就能在这里快速复制验证码。',
    platform: '平台',
    account: '账号',
    secret: '2FA 密钥',
    note: '备注',
    cancel: '取消',
    save: '保存',
    copy: '复制',
    copied: '验证码已复制',
    delete: '删除',
    confirmDelete: '确认删除「{name}」的 2FA 配置吗？',
    saved: '2FA 配置已保存',
    deleted: '2FA 配置已删除',
    requiredFields: '平台、账号和 2FA 密钥不能为空',
    invalidSecret: '2FA 密钥格式无效',
    cloudSync: '云端同步',
    cloudSyncDesc: '使用系统设置里的 R2/S3 配置，同步加密后的 2FA 保险箱文件。',
    syncNow: '同步 2FA',
    syncing: '同步中...',
    cloudSettings: '云同步设置',
    missingCloudSettings: '请先在系统设置中填写 R2/S3 云同步配置',
    noVault: '请先创建 2FA 保险箱',
    uploadInitialized: '2FA 云端同步已初始化 v{version}',
    uploaded: '2FA 保险箱已上传 v{version}',
    downloaded: '已从云端同步 2FA 保险箱 v{version}，请重新解锁',
    upToDate: '2FA 保险箱本地和云端已是最新',
    conflictFound: '检测到 2FA 保险箱同步冲突，请选择保留哪一侧',
    conflictTitle: '2FA 同步冲突',
    conflictDesc: '本地和远端保险箱都发生过变化。出于安全考虑，这里只显示版本和设备信息。',
    localSide: '本地',
    remoteSide: '远端',
    version: '版本',
    updatedAt: '更新时间',
    device: '设备',
    useRemote: '使用远端',
    useLocal: '使用本地',
    close: '取消同步',
    localOverwrite: '已使用本地 2FA 保险箱覆盖远端 v{version}',
    passphraseHintLabel: '口令提示 (选填)',
    passphraseHintDesc: '提示: {hint}',
    changePassphrase: '修改口令',
    currentPassphrase: '当前口令',
    newPassphrase: '新口令',
    confirmNewPassphrase: '确认新口令',
    passphraseChanged: '口令已成功修改',
    incorrectCurrentPassphrase: '当前口令不正确',
  },
  'en-US': {
    title: '2FA Authenticator',
    desc: 'Store Google Authenticator secrets for multiple accounts and generate local TOTP codes.',
    introWhatTitle: 'What is 2FA',
    introWhatDesc: '2FA adds a changing 30-second code on top of your password when you sign in.',
    introUseTitle: 'What this does',
    introUseDesc: 'Save 2FA secrets for different platform accounts and copy the current code when needed.',
    introSecureTitle: 'How secrets are stored',
    introSecureDesc: 'The vault is encrypted with your passphrase locally; R2/S3 sync stores the encrypted file only.',
    introHelpTitle: 'Help & Security Guide',
    createTitle: 'Create 2FA Vault',
    createDesc: 'The vault is encrypted with your passphrase before it is saved locally or synced to R2/S3.',
    unlockTitle: 'Unlock 2FA Vault',
    unlockDesc: 'Enter your vault passphrase to generate codes for this session.',
    passphrase: 'Vault passphrase',
    confirmPassphrase: 'Confirm passphrase',
    createVault: 'Create Vault',
    unlockVault: 'Unlock',
    lockVault: 'Lock',
    passphraseMismatch: 'Passphrases do not match',
    passphraseRequired: 'Enter the vault passphrase',
    searchPlaceholder: 'Search platform, account, or note',
    addEntry: 'Add Account',
    editEntry: 'Edit Account',
    emptyTitle: 'No 2FA accounts yet',
    emptyDesc: 'Add a platform, account, and 2FA secret to copy codes quickly.',
    platform: 'Platform',
    account: 'Account',
    secret: '2FA Secret',
    note: 'Note',
    cancel: 'Cancel',
    save: 'Save',
    copy: 'Copy',
    copied: 'Code copied',
    delete: 'Delete',
    confirmDelete: 'Delete the 2FA entry for "{name}"?',
    saved: '2FA entry saved',
    deleted: '2FA entry deleted',
    requiredFields: 'Platform, account, and secret are required',
    invalidSecret: 'Invalid 2FA secret',
    cloudSync: 'Cloud Sync',
    cloudSyncDesc: 'Uses the R2/S3 settings from System Settings to sync the encrypted 2FA vault file.',
    syncNow: 'Sync 2FA',
    syncing: 'Syncing...',
    cloudSettings: 'Cloud Sync Settings',
    missingCloudSettings: 'Fill in R2/S3 cloud sync settings first',
    noVault: 'Create a 2FA vault first',
    uploadInitialized: '2FA cloud sync initialized v{version}',
    uploaded: '2FA vault uploaded v{version}',
    downloaded: '2FA vault downloaded v{version}. Unlock it again.',
    upToDate: '2FA vault is already up to date',
    conflictFound: '2FA vault sync conflict detected',
    conflictTitle: '2FA Sync Conflict',
    conflictDesc: 'Both local and remote vaults changed. Only version and device metadata are shown.',
    localSide: 'Local',
    remoteSide: 'Remote',
    version: 'Version',
    updatedAt: 'Updated',
    device: 'Device',
    useRemote: 'Use Remote',
    useLocal: 'Use Local',
    close: 'Cancel Sync',
    localOverwrite: 'Local 2FA vault overwrote remote v{version}',
    passphraseHintLabel: 'Passphrase Hint (Optional)',
    passphraseHintDesc: 'Hint: {hint}',
    changePassphrase: 'Change Passphrase',
    currentPassphrase: 'Current Passphrase',
    newPassphrase: 'New Passphrase',
    confirmNewPassphrase: 'Confirm New Passphrase',
    passphraseChanged: 'Passphrase changed successfully',
    incorrectCurrentPassphrase: 'Incorrect current passphrase',
  },
};

const emptyForm = {
  platform: '',
  account: '',
  secret: '',
  note: '',
};

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `2fa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

function hasCloudSyncSettings(settings: CloudSyncSettings): boolean {
  return Boolean(
    settings.endpoint.trim() &&
      settings.bucket.trim() &&
      settings.accessKeyId.trim() &&
      settings.secretAccessKey.trim() &&
      settings.keyPrefix.trim(),
  );
}

export function TwoFactorPage({
  language,
  cloudSyncSettings,
  onOpenCloudSettings,
  onToast,
}: TwoFactorPageProps) {
  const text = TEXT[language];
  const [encryptedVault, setEncryptedVault] = useState<EncryptedTwoFactorVault | null>(null);
  const [vaultData, setVaultData] = useState<TwoFactorVaultData | null>(null);
  const [sessionPassphrase, setSessionPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [confirmPassphraseInput, setConfirmPassphraseInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [query, setQuery] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [editingEntry, setEditingEntry] = useState<TwoFactorEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [savingEntry, setSavingEntry] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudConflict, setCloudConflict] = useState<TwoFactorCloudPayload | null>(null);
  const [localSyncMetadata, setLocalSyncMetadata] = useState<TwoFactorSyncMetadata | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [passphraseHintInput, setPassphraseHintInput] = useState('');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [currentPassphraseInput, setCurrentPassphraseInput] = useState('');
  const [newPassphraseInput, setNewPassphraseInput] = useState('');
  const [confirmNewPassphraseInput, setConfirmNewPassphraseInput] = useState('');
  const [newPassphraseHintInput, setNewPassphraseHintInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);

  const remainingSeconds = getTotpRemainingSeconds(now);
  const progress = getTotpProgress(now);

  useEffect(() => {
    getEncryptedTwoFactorVault().then(setEncryptedVault);
  }, []);

  useEffect(() => {
    if (!vaultData) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [vaultData]);

  useEffect(() => {
    if (!vaultData) {
      setCodes({});
      return;
    }
    let cancelled = false;
    Promise.all(
      vaultData.entries.map(async (entry) => [entry.id, await generateTotp(entry.secret, now)] as const),
    ).then((nextCodes) => {
      if (cancelled) return;
      setCodes(Object.fromEntries(nextCodes));
    });
    return () => {
      cancelled = true;
    };
  }, [vaultData, now]);

  const filteredEntries = useMemo(() => {
    const entries = vaultData?.entries ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [entry.platform, entry.account, entry.note].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query, vaultData]);

  const persistVaultData = async (nextData: TwoFactorVaultData) => {
    if (!sessionPassphrase) {
      throw new Error(text.passphraseRequired);
    }
    const encrypted = await encryptTwoFactorVault(nextData, sessionPassphrase, encryptedVault?.passphraseHint);
    await setEncryptedTwoFactorVault(encrypted);
    setEncryptedVault(encrypted);
    setVaultData(nextData);
  };

  const createVault = async () => {
    if (!passphraseInput.trim()) {
      onToast(text.passphraseRequired);
      return;
    }
    if (passphraseInput !== confirmPassphraseInput) {
      onToast(text.passphraseMismatch);
      return;
    }
    setUnlocking(true);
    try {
      const data = createEmptyTwoFactorVaultData();
      const encrypted = await encryptTwoFactorVault(data, passphraseInput, passphraseHintInput);
      await setEncryptedTwoFactorVault(encrypted);
      setEncryptedVault(encrypted);
      setVaultData(data);
      setSessionPassphrase(passphraseInput);
      setPassphraseInput('');
      setConfirmPassphraseInput('');
      setPassphraseHintInput('');
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.invalidSecret);
    } finally {
      setUnlocking(false);
    }
  };

  const unlockVault = async () => {
    if (!encryptedVault) return;
    if (!passphraseInput.trim()) {
      onToast(text.passphraseRequired);
      return;
    }
    setUnlocking(true);
    try {
      const data = await decryptTwoFactorVault(encryptedVault, passphraseInput);
      setVaultData(data);
      setSessionPassphrase(passphraseInput);
      setPassphraseInput('');
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.passphraseRequired);
    } finally {
      setUnlocking(false);
    }
  };

  const lockVault = () => {
    setVaultData(null);
    setSessionPassphrase('');
    setCodes({});
  };

  const openEntryForm = (entry?: TwoFactorEntry) => {
    setEditingEntry(entry ?? null);
    setForm(
      entry
        ? {
            platform: entry.platform,
            account: entry.account,
            secret: entry.secret,
            note: entry.note,
          }
        : emptyForm,
    );
    setShowForm(true);
  };

  const saveEntry = async () => {
    if (!vaultData) return;
    const platform = form.platform.trim();
    const account = form.account.trim();
    const secret = normalizeTotpSecret(form.secret);
    const note = form.note.trim();

    if (!platform || !account || !secret) {
      onToast(text.requiredFields);
      return;
    }

    try {
      assertValidTotpSecret(secret);
      setSavingEntry(true);
      const timestamp = Date.now();
      const entries = editingEntry
        ? vaultData.entries.map((entry) =>
            entry.id === editingEntry.id
              ? {
                  ...entry,
                  platform,
                  account,
                  secret,
                  note,
                  updatedAt: timestamp,
                }
              : entry,
          )
        : [
            {
              id: createId(),
              platform,
              account,
              secret,
              note,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            ...vaultData.entries,
          ];
      await persistVaultData({ entries });
      setShowForm(false);
      setEditingEntry(null);
      setForm(emptyForm);
      onToast(text.saved);
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.invalidSecret);
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (entry: TwoFactorEntry) => {
    if (!vaultData) return;
    if (!window.confirm(fmt(text.confirmDelete, { name: `${entry.platform} / ${entry.account}` }))) return;
    await persistVaultData({
      entries: vaultData.entries.filter((item) => item.id !== entry.id),
    });
    onToast(text.deleted);
  };

  const copyCode = async (entry: TwoFactorEntry) => {
    try {
      const code = codes[entry.id] ?? (await generateTotp(entry.secret));
      await navigator.clipboard.writeText(code);
      onToast(text.copied);
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.copy);
    }
  };

  const uploadCloudState = async (previousRemoteVersion: number) => {
    const vault = await getEncryptedTwoFactorVault();
    if (!vault) {
      throw new Error(text.noVault);
    }
    const metadata = await getTwoFactorSyncMetadata();
    const key = buildS3TwoFactorObjectKey(cloudSyncSettings.keyPrefix);
    const payload = buildTwoFactorCloudPayload({
      vault,
      metadata,
      previousRemoteVersion,
    });
    await putS3Json(cloudSyncSettings, key, payload);
    await setTwoFactorSyncMetadata({
      ...metadata,
      lastSyncedLocalVersion: metadata.localVersion,
      lastRemoteVersion: payload.remoteVersion,
    });
    return payload;
  };

  const applyRemoteCloudState = async (payload: TwoFactorCloudPayload) => {
    await replaceEncryptedTwoFactorVaultFromCloud(payload.vault, payload.remoteVersion);
    setEncryptedVault(payload.vault);
    lockVault();
  };

  const syncCloud = async () => {
    if (!hasCloudSyncSettings(cloudSyncSettings)) {
      onToast(text.missingCloudSettings);
      return;
    }
    const vault = await getEncryptedTwoFactorVault();
    if (!vault) {
      onToast(text.noVault);
      return;
    }

    try {
      setSyncing(true);
      const key = buildS3TwoFactorObjectKey(cloudSyncSettings.keyPrefix);
      const metadata = await getTwoFactorSyncMetadata();
      const rawRemote = await getS3Json<unknown>(cloudSyncSettings, key);
      const remote = rawRemote ? parseTwoFactorCloudPayload(rawRemote) : null;
      const direction = decideTwoFactorCloudSyncDirection(metadata, remote);

      if (direction === 'upload-initialize' || direction === 'upload') {
        const payload = await uploadCloudState(remote?.remoteVersion ?? 0);
        onToast(
          fmt(direction === 'upload-initialize' ? text.uploadInitialized : text.uploaded, {
            version: payload.remoteVersion,
          }),
        );
        return;
      }

      if (direction === 'download' && remote) {
        await applyRemoteCloudState(remote);
        onToast(fmt(text.downloaded, { version: remote.remoteVersion }));
        return;
      }

      if (direction === 'noop') {
        onToast(text.upToDate);
        return;
      }

      if (direction === 'conflict' && remote) {
        setLocalSyncMetadata(metadata);
        setCloudConflict(remote);
        onToast(text.conflictFound);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.conflictFound);
    } finally {
      setSyncing(false);
    }
  };

  const changePassphrase = async () => {
    if (!encryptedVault || !vaultData) return;
    if (!currentPassphraseInput.trim() || !newPassphraseInput.trim()) {
      onToast(text.passphraseRequired);
      return;
    }
    if (newPassphraseInput !== confirmNewPassphraseInput) {
      onToast(text.passphraseMismatch);
      return;
    }

    try {
      await decryptTwoFactorVault(encryptedVault, currentPassphraseInput);
    } catch {
      onToast(text.incorrectCurrentPassphrase);
      return;
    }

    setUnlocking(true);
    try {
      const encrypted = await encryptTwoFactorVault(
        vaultData,
        newPassphraseInput,
        newPassphraseHintInput,
      );
      await setEncryptedTwoFactorVault(encrypted);
      setEncryptedVault(encrypted);
      setSessionPassphrase(newPassphraseInput);
      onToast(text.passphraseChanged);

      setCurrentPassphraseInput('');
      setNewPassphraseInput('');
      setConfirmNewPassphraseInput('');
      setNewPassphraseHintInput('');
      setShowChangeModal(false);

      if (hasCloudSyncSettings(cloudSyncSettings)) {
        await syncCloud();
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.invalidSecret);
    } finally {
      setUnlocking(false);
    }
  };

  const resolveConflict = async (choice: TwoFactorCloudConflictChoice) => {
    if (!cloudConflict || choice === 'cancel') {
      setCloudConflict(null);
      setLocalSyncMetadata(null);
      return;
    }
    try {
      setSyncing(true);
      if (choice === 'remote') {
        await applyRemoteCloudState(cloudConflict);
        onToast(fmt(text.downloaded, { version: cloudConflict.remoteVersion }));
      } else {
        const payload = await uploadCloudState(cloudConflict.remoteVersion);
        onToast(fmt(text.localOverwrite, { version: payload.remoteVersion }));
      }
      setCloudConflict(null);
      setLocalSyncMetadata(null);
    } catch (error) {
      onToast(error instanceof Error ? error.message : text.conflictFound);
    } finally {
      setSyncing(false);
    }
  };

  if (!encryptedVault || !vaultData) {
    const isCreating = !encryptedVault;
    return (
      <section className="two-factor-page two-factor-page-locked">
        <div className="two-factor-auth-container split-layout">
          <article className="two-factor-unlock-card split-card">
            <div className="two-factor-unlock-left">
              <div className="two-factor-unlock-card-header">
                <div className="two-factor-kicker">
                  <ShieldCheck size={18} />
                  {text.title}
                </div>
                <h2>{isCreating ? text.createTitle : text.unlockTitle}</h2>
                <p>{isCreating ? text.createDesc : text.unlockDesc}</p>
              </div>

              <div className="two-factor-unlock-card-body">
                <label>
                  {text.passphrase}
                  <div className="password-input-wrapper">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={passphraseInput}
                      onChange={(event) => setPassphraseInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !isCreating) unlockVault();
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      title={showPassphrase ? '隐藏' : '显示'}
                    >
                      {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                {!isCreating && encryptedVault.passphraseHint && (
                  <div className="passphrase-hint-display">
                    {fmt(text.passphraseHintDesc, { hint: encryptedVault.passphraseHint })}
                  </div>
                )}
                {isCreating && (
                  <>
                    <label>
                      {text.confirmPassphrase}
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPassphrase ? 'text' : 'password'}
                          value={confirmPassphraseInput}
                          onChange={(event) => setConfirmPassphraseInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') createVault();
                          }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                          title={showConfirmPassphrase ? '隐藏' : '显示'}
                        >
                          {showConfirmPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>
                    <label>
                      {text.passphraseHintLabel}
                      <input
                        type="text"
                        value={passphraseHintInput}
                        onChange={(event) => setPassphraseHintInput(event.target.value)}
                        placeholder="例如：我最喜欢的颜色"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') createVault();
                        }}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="two-factor-unlock-actions single-action">
                <button
                  className="primary full-width"
                  onClick={isCreating ? createVault : unlockVault}
                  disabled={unlocking}
                >
                  {unlocking ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {isCreating ? text.createVault : text.unlockVault}
                </button>
              </div>
            </div>

            <div className="two-factor-unlock-right">
              <div className="two-factor-intro-list">
                <div>
                  <strong>{text.introWhatTitle}</strong>
                  <span>{text.introWhatDesc}</span>
                </div>
                <div>
                  <strong>{text.introUseTitle}</strong>
                  <span>{text.introUseDesc}</span>
                </div>
                <div>
                  <strong>{text.introSecureTitle}</strong>
                  <span>{text.introSecureDesc}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="two-factor-page">
      <div className="two-factor-toolbar">
        <div>
          <div className="two-factor-kicker">
            <ShieldCheck size={16} />
            {text.title}
          </div>
          <h2>{text.title}</h2>
          <p>{text.desc}</p>
        </div>
        <div className="two-factor-toolbar-actions">
          <button onClick={() => setShowChangeModal(true)}>
            <KeyRound size={16} />
            {text.changePassphrase}
          </button>
          <button onClick={lockVault}>
            <Lock size={16} />
            {text.lockVault}
          </button>
          <button className="primary" onClick={() => openEntryForm()}>
            <Plus size={16} />
            {text.addEntry}
          </button>
        </div>
      </div>

      <div className="two-factor-control-row">
        <div className="two-factor-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.searchPlaceholder}
          />
        </div>
        <div className="two-factor-countdown" style={{ ['--totp-progress' as any]: progress }}>
          <span>{remainingSeconds}s</span>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <article className="two-factor-empty">
          <KeyRound size={28} />
          <h3>{text.emptyTitle}</h3>
          <p>{text.emptyDesc}</p>
          <button className="primary" onClick={() => openEntryForm()}>
            <Plus size={16} />
            {text.addEntry}
          </button>
        </article>
      ) : (
        <div className="two-factor-entry-grid">
          {filteredEntries.map((entry) => (
            <article className="two-factor-entry-card" key={entry.id}>
              <div className="two-factor-entry-main">
                <div className="two-factor-entry-icon">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3>{entry.platform}</h3>
                  <p>{entry.account}</p>
                  {entry.note && <small>{entry.note}</small>}
                </div>
              </div>
              <button className="two-factor-code" onClick={() => copyCode(entry)} title={text.copy}>
                {codes[entry.id] ?? '------'}
              </button>
              <div className="two-factor-entry-actions">
                <button onClick={() => copyCode(entry)} title={text.copy} aria-label={text.copy}>
                  <Copy size={16} />
                </button>
                <button onClick={() => openEntryForm(entry)} title={text.editEntry} aria-label={text.editEntry}>
                  <Edit3 size={16} />
                </button>
                <button onClick={() => deleteEntry(entry)} title={text.delete} aria-label={text.delete}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <article className="two-factor-cloud-card">
        <div>
          <h3>
            <Cloud size={18} />
            {text.cloudSync}
          </h3>
          <p>{text.cloudSyncDesc}</p>
        </div>
        <div className="two-factor-cloud-actions">
          <button onClick={onOpenCloudSettings}>{text.cloudSettings}</button>
          <button className="primary" onClick={syncCloud} disabled={syncing}>
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? text.syncing : text.syncNow}
          </button>
        </div>
      </article>

      {showForm && (
        <div className="modal-mask" onClick={() => setShowForm(false)}>
          <div className="modal-card two-factor-form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEntry ? text.editEntry : text.addEntry}</h3>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>{text.platform}</label>
                <input
                  value={form.platform}
                  onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
                  placeholder="GitHub"
                />
              </div>
              <div className="modal-field">
                <label>{text.account}</label>
                <input
                  value={form.account}
                  onChange={(event) => setForm((prev) => ({ ...prev, account: event.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className="modal-field">
                <label>{text.secret}</label>
                <input
                  value={form.secret}
                  onChange={(event) => setForm((prev) => ({ ...prev, secret: event.target.value }))}
                  placeholder="JBSW Y3DP EB3W 64TM MQ"
                />
              </div>
              <div className="modal-field">
                <label>{text.note}</label>
                <input
                  value={form.note}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowForm(false)}>{text.cancel}</button>
              <button className="primary" onClick={saveEntry} disabled={savingEntry}>
                {savingEntry ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {text.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {cloudConflict && (
        <div className="modal-mask">
          <div className="modal-card two-factor-conflict-modal">
            <div className="modal-header">
              <h3>{text.conflictTitle}</h3>
            </div>
            <div className="modal-body">
              <p className="cloud-sync-conflict-desc">{text.conflictDesc}</p>
              <div className="two-factor-conflict-grid">
                <div>
                  <h4>{text.localSide}</h4>
                  <span>{text.version}: v{localSyncMetadata?.localVersion ?? 0}</span>
                  <span>{text.updatedAt}: {formatDateTime(localSyncMetadata?.localUpdatedAt ?? Date.now())}</span>
                  <span>{text.device}: {localSyncMetadata?.deviceId ?? '-'}</span>
                </div>
                <div>
                  <h4>{text.remoteSide}</h4>
                  <span>{text.version}: v{cloudConflict.remoteVersion}</span>
                  <span>{text.updatedAt}: {formatDateTime(cloudConflict.updatedAt)}</span>
                  <span>{text.device}: {cloudConflict.updatedByDeviceId}</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => resolveConflict('cancel')} disabled={syncing}>{text.close}</button>
              <button onClick={() => resolveConflict('remote')} disabled={syncing}>{text.useRemote}</button>
              <button className="primary" onClick={() => resolveConflict('local')} disabled={syncing}>
                {text.useLocal}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeModal && (
        <div className="modal-mask" onClick={() => setShowChangeModal(false)}>
          <div className="modal-card two-factor-form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{text.changePassphrase}</h3>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>{text.currentPassphrase}</label>
                <div className="password-input-wrapper">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassphraseInput}
                    onChange={(event) => setCurrentPassphraseInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    title={showCurrentPass ? '隐藏' : '显示'}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="modal-field">
                <label>{text.newPassphrase}</label>
                <div className="password-input-wrapper">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassphraseInput}
                    onChange={(event) => setNewPassphraseInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPass(!showNewPass)}
                    title={showNewPass ? '隐藏' : '显示'}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="modal-field">
                <label>{text.confirmNewPassphrase}</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmNewPass ? 'text' : 'password'}
                    value={confirmNewPassphraseInput}
                    onChange={(event) => setConfirmNewPassphraseInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                    title={showConfirmNewPass ? '隐藏' : '显示'}
                  >
                    {showConfirmNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="modal-field">
                <label>{text.passphraseHintLabel}</label>
                <input
                  type="text"
                  value={newPassphraseHintInput}
                  onChange={(event) => setNewPassphraseHintInput(event.target.value)}
                  placeholder="例如：我最喜欢的颜色"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowChangeModal(false)}>{text.cancel}</button>
              <button className="primary" onClick={changePassphrase} disabled={unlocking}>
                {unlocking ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {text.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
