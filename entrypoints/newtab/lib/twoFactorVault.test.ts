import { describe, expect, it } from 'vitest';
import { decryptTwoFactorVault, encryptTwoFactorVault } from './twoFactorVault';

describe('two-factor vault encryption', () => {
  it('encrypts and decrypts vault data', async () => {
    const encrypted = await encryptTwoFactorVault(
      {
        entries: [
          {
            id: 'entry-1',
            platform: 'GitHub',
            account: 'user@example.com',
            secret: 'jbsw y3dp eb3w 64tm mq',
            note: 'main account',
            createdAt: 100,
            updatedAt: 200,
          },
        ],
      },
      'passphrase',
    );

    const decrypted = await decryptTwoFactorVault(encrypted, 'passphrase');
    expect(decrypted.entries[0]).toMatchObject({
      platform: 'GitHub',
      account: 'user@example.com',
      secret: 'JBSWY3DPEB3W64TMMQ',
      note: 'main account',
    });
  });

  it('does not leak plaintext secrets in encrypted JSON', async () => {
    const encrypted = await encryptTwoFactorVault(
      {
        entries: [
          {
            id: 'entry-1',
            platform: 'GitHub',
            account: 'user@example.com',
            secret: 'JBSWY3DPEB3W64TMMQ',
            note: '',
            createdAt: 100,
            updatedAt: 200,
          },
        ],
      },
      'passphrase',
    );

    const serialized = JSON.stringify(encrypted);
    expect(serialized).not.toContain('JBSWY3DPEB3W64TMMQ');
    expect(serialized).not.toContain('user@example.com');
  });

  it('rejects a wrong passphrase', async () => {
    const encrypted = await encryptTwoFactorVault({ entries: [] }, 'right-passphrase');
    await expect(decryptTwoFactorVault(encrypted, 'wrong-passphrase')).rejects.toThrow(
      '保险箱口令不正确或数据已损坏',
    );
  });
});
