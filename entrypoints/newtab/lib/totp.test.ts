import { describe, expect, it } from 'vitest';
import {
  decodeBase32,
  generateTotp,
  getTotpProgress,
  getTotpRemainingSeconds,
  normalizeTotpSecret,
} from './totp';

const RFC_6238_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP helpers', () => {
  it('normalizes spaces, lowercase letters, and padding', () => {
    expect(normalizeTotpSecret(' gezd gnbv gy3t==== ')).toBe('GEZDGNBVGY3T');
  });

  it('decodes Base32 secrets', () => {
    expect(new TextDecoder().decode(decodeBase32('JBSWY3DPEB3W64TMMQ'))).toBe('Hello world');
  });

  it('rejects invalid Base32 characters', () => {
    expect(() => decodeBase32('abc-123')).toThrow('2FA 密钥只能包含 Base32 字符 A-Z 和 2-7');
  });

  it('matches RFC 6238 SHA-1 6-digit test vectors', async () => {
    await expect(generateTotp(RFC_6238_SECRET, 59_000)).resolves.toBe('287082');
    await expect(generateTotp(RFC_6238_SECRET, 1_111_111_109_000)).resolves.toBe('081804');
    await expect(generateTotp(RFC_6238_SECRET, 1_111_111_111_000)).resolves.toBe('050471');
    await expect(generateTotp(RFC_6238_SECRET, 1_234_567_890_000)).resolves.toBe('005924');
  });

  it('reports countdown seconds and progress within the 30 second period', () => {
    expect(getTotpRemainingSeconds(0)).toBe(30);
    expect(getTotpRemainingSeconds(29_000)).toBe(1);
    expect(getTotpProgress(15_000)).toBe(0.5);
  });
});
