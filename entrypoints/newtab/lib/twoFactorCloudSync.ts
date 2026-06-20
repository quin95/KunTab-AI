import type {
  EncryptedTwoFactorVault,
  TwoFactorCloudPayload,
  TwoFactorSyncMetadata,
} from '../models';
import { parseEncryptedTwoFactorVault } from './twoFactorVault';

export type TwoFactorCloudSyncDirection = 'upload-initialize' | 'upload' | 'download' | 'noop' | 'conflict';

export function decideTwoFactorCloudSyncDirection(
  metadata: TwoFactorSyncMetadata,
  remote: TwoFactorCloudPayload | null,
): TwoFactorCloudSyncDirection {
  if (!remote) return 'upload-initialize';
  const localChanged = metadata.localVersion !== metadata.lastSyncedLocalVersion;
  const remoteChanged = remote.remoteVersion !== metadata.lastRemoteVersion;
  if (localChanged && remoteChanged) return 'conflict';
  if (localChanged) return 'upload';
  if (remoteChanged) return 'download';
  return 'noop';
}

export function buildTwoFactorCloudPayload(params: {
  vault: EncryptedTwoFactorVault;
  metadata: TwoFactorSyncMetadata;
  previousRemoteVersion: number;
}): TwoFactorCloudPayload {
  return {
    app: 'kuntab',
    type: 'two-factor-sync',
    schemaVersion: 1,
    remoteVersion: params.previousRemoteVersion + 1,
    updatedAt: Date.now(),
    updatedByDeviceId: params.metadata.deviceId,
    vault: params.vault,
  };
}

export function parseTwoFactorCloudPayload(value: unknown): TwoFactorCloudPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('远端 2FA 同步文件格式无效');
  }
  const payload = value as Partial<TwoFactorCloudPayload>;
  if (payload.app !== 'kuntab' || payload.type !== 'two-factor-sync' || payload.schemaVersion !== 1) {
    throw new Error('远端 2FA 同步文件格式无效');
  }
  if (!Number.isFinite(payload.remoteVersion) || (payload.remoteVersion ?? 0) < 1) {
    throw new Error('远端 2FA 同步版本无效');
  }
  if (!payload.vault) {
    throw new Error('远端 2FA 同步数据不完整');
  }

  return {
    ...(payload as TwoFactorCloudPayload),
    vault: parseEncryptedTwoFactorVault(payload.vault),
  };
}
