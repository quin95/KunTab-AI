import type { EncryptedTwoFactorVault, TwoFactorEntry, TwoFactorVaultData } from '../models';
import { normalizeTotpSecret } from './totp';

const KDF_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeUtf8(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return toArrayBuffer(bytes);
}

function decodeUtf8(value: ArrayBuffer): string {
  return new TextDecoder().decode(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase.trim()) {
    throw new Error('保险箱口令不能为空');
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function createEmptyTwoFactorVaultData(): TwoFactorVaultData {
  return { entries: [] };
}

export function normalizeTwoFactorEntry(entry: TwoFactorEntry): TwoFactorEntry {
  return {
    ...entry,
    platform: entry.platform.trim(),
    account: entry.account.trim(),
    secret: normalizeTotpSecret(entry.secret),
    note: entry.note.trim(),
  };
}

export async function encryptTwoFactorVault(
  data: TwoFactorVaultData,
  passphrase: string,
  passphraseHint?: string,
): Promise<EncryptedTwoFactorVault> {
  const salt = getRandomBytes(SALT_BYTES);
  const iv = getRandomBytes(IV_BYTES);
  const key = await deriveAesKey(passphrase, salt);
  const normalizedData: TwoFactorVaultData = {
    entries: data.entries.map(normalizeTwoFactorEntry),
  };
  const plaintext = encodeUtf8(JSON.stringify(normalizedData));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);

  return {
    app: 'kuntab',
    type: 'two-factor-vault',
    schemaVersion: 1,
    updatedAt: Date.now(),
    entryCount: normalizedData.entries.length,
    passphraseHint: passphraseHint?.trim() || undefined,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export function parseEncryptedTwoFactorVault(value: unknown): EncryptedTwoFactorVault {
  if (!value || typeof value !== 'object') {
    throw new Error('2FA 保险箱格式无效');
  }
  const vault = value as Partial<EncryptedTwoFactorVault>;
  if (
    vault.app !== 'kuntab' ||
    vault.type !== 'two-factor-vault' ||
    vault.schemaVersion !== 1 ||
    vault.kdf?.name !== 'PBKDF2' ||
    vault.kdf.hash !== 'SHA-256' ||
    vault.cipher?.name !== 'AES-GCM' ||
    typeof vault.kdf.salt !== 'string' ||
    typeof vault.cipher.iv !== 'string' ||
    typeof vault.ciphertext !== 'string' ||
    (vault.passphraseHint !== undefined && typeof vault.passphraseHint !== 'string')
  ) {
    throw new Error('2FA 保险箱格式无效');
  }
  return vault as EncryptedTwoFactorVault;
}

export async function decryptTwoFactorVault(
  encrypted: EncryptedTwoFactorVault,
  passphrase: string,
): Promise<TwoFactorVaultData> {
  const parsed = parseEncryptedTwoFactorVault(encrypted);
  try {
    const key = await deriveAesKey(passphrase, base64ToBytes(parsed.kdf.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(parsed.cipher.iv)) },
      key,
      toArrayBuffer(base64ToBytes(parsed.ciphertext)),
    );
    const data = JSON.parse(decodeUtf8(plaintext)) as TwoFactorVaultData;
    if (!data || !Array.isArray(data.entries)) {
      throw new Error('2FA 保险箱数据不完整');
    }
    return {
      entries: data.entries.map((entry) =>
        normalizeTwoFactorEntry({
          ...entry,
          note: entry.note ?? '',
        }),
      ),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('2FA 保险箱数据不完整');
    }
    throw new Error('保险箱口令不正确或数据已损坏');
  }
}
