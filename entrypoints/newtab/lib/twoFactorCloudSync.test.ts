import { describe, expect, it } from 'vitest';
import type { EncryptedTwoFactorVault, TwoFactorCloudPayload, TwoFactorSyncMetadata } from '../models';
import {
  buildTwoFactorCloudPayload,
  decideTwoFactorCloudSyncDirection,
  parseTwoFactorCloudPayload,
} from './twoFactorCloudSync';

const encryptedVault = (): EncryptedTwoFactorVault => ({
  app: 'kuntab',
  type: 'two-factor-vault',
  schemaVersion: 1,
  updatedAt: 100,
  entryCount: 0,
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 210000,
    salt: 'c2FsdA==',
  },
  cipher: {
    name: 'AES-GCM',
    iv: 'aXZpdml2aXY=',
  },
  ciphertext: 'Y2lwaGVydGV4dA==',
});

const metadata = (patch: Partial<TwoFactorSyncMetadata> = {}): TwoFactorSyncMetadata => ({
  deviceId: 'device-a',
  localVersion: 1,
  localUpdatedAt: 100,
  lastSyncedLocalVersion: 1,
  lastRemoteVersion: 1,
  ...patch,
});

const remote = (version = 1): TwoFactorCloudPayload => ({
  app: 'kuntab',
  type: 'two-factor-sync',
  schemaVersion: 1,
  remoteVersion: version,
  updatedAt: 100,
  updatedByDeviceId: 'device-b',
  vault: encryptedVault(),
});

describe('two-factor cloud sync', () => {
  it('decides upload, download, noop, and conflict directions', () => {
    expect(decideTwoFactorCloudSyncDirection(metadata(), null)).toBe('upload-initialize');
    expect(decideTwoFactorCloudSyncDirection(metadata({ localVersion: 2 }), remote(1))).toBe('upload');
    expect(decideTwoFactorCloudSyncDirection(metadata(), remote(2))).toBe('download');
    expect(decideTwoFactorCloudSyncDirection(metadata(), remote(1))).toBe('noop');
    expect(decideTwoFactorCloudSyncDirection(metadata({ localVersion: 2 }), remote(2))).toBe('conflict');
  });

  it('uploads when local vault content changed but metadata still points at the same remote version', () => {
    const localVault = {
      ...encryptedVault(),
      updatedAt: 200,
      entryCount: 1,
      ciphertext: 'bmV3LWNpcGhlcnRleHQ=',
    };

    expect(decideTwoFactorCloudSyncDirection(metadata(), remote(1), localVault)).toBe('upload');
  });

  it('builds a versioned encrypted cloud payload', () => {
    expect(
      buildTwoFactorCloudPayload({
        vault: encryptedVault(),
        metadata: metadata({ deviceId: 'device-z' }),
        previousRemoteVersion: 3,
      }),
    ).toMatchObject({
      app: 'kuntab',
      type: 'two-factor-sync',
      schemaVersion: 1,
      remoteVersion: 4,
      updatedByDeviceId: 'device-z',
    });
  });

  it('parses valid remote payloads and rejects invalid ones', () => {
    expect(parseTwoFactorCloudPayload(remote(2)).remoteVersion).toBe(2);
    expect(() => parseTwoFactorCloudPayload({ ...remote(), type: 'other' })).toThrow('远端 2FA 同步文件格式无效');
  });
});
