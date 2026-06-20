import type { TwoFactorEntry } from '../models';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

export function normalizeTotpSecret(secret: string): string {
  return secret.toUpperCase().replace(/\s+/g, '').replace(/=+$/g, '');
}

export function decodeBase32(secret: string): Uint8Array {
  const normalized = normalizeTotpSecret(secret);
  if (!normalized) {
    throw new Error('2FA 密钥不能为空');
  }
  if (!/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error('2FA 密钥只能包含 Base32 字符 A-Z 和 2-7');
  }

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error('2FA 密钥格式无效');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function hmacSha1(secret: Uint8Array, counter: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(counter)));
}

export async function generateTotp(secret: string, now = Date.now()): Promise<string> {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  const digest = await hmacSha1(key, counterToBytes(counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;
  return String(otp).padStart(TOTP_DIGITS, '0');
}

export async function getCurrentTotp(entry: Pick<TwoFactorEntry, 'secret'>, now = Date.now()): Promise<string> {
  return generateTotp(entry.secret, now);
}

export function getTotpRemainingSeconds(now = Date.now()): number {
  const elapsed = Math.floor(now / 1000) % TOTP_PERIOD_SECONDS;
  return TOTP_PERIOD_SECONDS - elapsed;
}

export function getTotpProgress(now = Date.now()): number {
  return getTotpRemainingSeconds(now) / TOTP_PERIOD_SECONDS;
}

export function assertValidTotpSecret(secret: string): void {
  decodeBase32(secret);
}

export function getTotpPeriodSeconds(): number {
  return TOTP_PERIOD_SECONDS;
}
