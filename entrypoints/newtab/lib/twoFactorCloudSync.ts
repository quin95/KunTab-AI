import type {
  EncryptedTwoFactorVault,
  TwoFactorCloudPayload,
  TwoFactorSyncMetadata,
} from '../models';
import { parseEncryptedTwoFactorVault } from './twoFactorVault';

export type TwoFactorCloudSyncDirection = 'upload-initialize' | 'upload' | 'download' | 'noop' | 'conflict';

function isSameEncryptedTwoFactorVault(
  left: EncryptedTwoFactorVault,
  right: EncryptedTwoFactorVault,
): boolean {
  return (
    left.app === right.app &&
    left.type === right.type &&
    left.schemaVersion === right.schemaVersion &&
    left.updatedAt === right.updatedAt &&
    left.entryCount === right.entryCount &&
    left.kdf.name === right.kdf.name &&
    left.kdf.hash === right.kdf.hash &&
    left.kdf.iterations === right.kdf.iterations &&
    left.kdf.salt === right.kdf.salt &&
    left.cipher.name === right.cipher.name &&
    left.cipher.iv === right.cipher.iv &&
    left.ciphertext === right.ciphertext &&
    left.passphraseHint === right.passphraseHint
  );
}

export function decideTwoFactorCloudSyncDirection(
  metadata: TwoFactorSyncMetadata,
  remote: TwoFactorCloudPayload | null,
  localVault?: EncryptedTwoFactorVault | null,
): TwoFactorCloudSyncDirection {
  if (!remote) return 'upload-initialize';
  const metadataLocalChanged = metadata.localVersion !== metadata.lastSyncedLocalVersion;
  const remoteChanged = remote.remoteVersion !== metadata.lastRemoteVersion;
  const syncedRemoteStillDiffersFromLocal =
    localVault !== null &&
    localVault !== undefined &&
    remote.remoteVersion === metadata.lastRemoteVersion &&
    !isSameEncryptedTwoFactorVault(localVault, remote.vault);
  const localChanged = metadataLocalChanged || syncedRemoteStillDiffersFromLocal;
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
