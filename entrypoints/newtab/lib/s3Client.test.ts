import { describe, expect, it } from 'vitest';
import {
  buildPathStyleObjectUrl,
  buildS3ConnectionTestKey,
  buildS3ObjectKey,
  formatS3ErrorMessage,
  normalizeS3KeyPrefix,
} from './s3Client';

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

  it('builds the fixed KunTab connection test object key', () => {
    expect(buildS3ConnectionTestKey('/kuntab/')).toBe('kuntab/.kuntab-connection-test.json');
  });

  it('builds a path-style encoded object URL', () => {
    const url = buildPathStyleObjectUrl(
      'https://example.r2.cloudflarestorage.com/',
      'backup',
      'kuntab/a file.json',
    );
    expect(url.toString()).toBe('https://example.r2.cloudflarestorage.com/backup/kuntab/a%20file.json');
  });
});

describe('S3 error formatting', () => {
  it('formats R2 access key length XML errors as a friendly message', () => {
    const body = '<?xml version="1.0" encoding="UTF-8"?><Error><Code>InvalidArgument</Code><Message>Credential access key has length 33, should be 32</Message></Error>';

    expect(formatS3ErrorMessage('PUT', 400, body)).toBe(
      'Access Key ID 格式不正确：应为 32 位，当前是 33 位，请检查是否多复制或少复制了字符。（S3 PUT 400，InvalidArgument）',
    );
  });

  it('keeps useful details for unknown XML errors', () => {
    const body = '<Error><Code>SomeError</Code><Message>Something failed</Message></Error>';

    expect(formatS3ErrorMessage('GET', 403, body)).toBe('S3 GET 403：SomeError - Something failed');
  });

  it('falls back to plain response bodies', () => {
    expect(formatS3ErrorMessage('PUT', 500, 'temporary unavailable')).toBe(
      'S3 PUT 500：temporary unavailable',
    );
  });
});
