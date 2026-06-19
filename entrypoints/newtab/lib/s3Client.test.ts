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
    const url = buildPathStyleObjectUrl(
      'https://example.r2.cloudflarestorage.com/',
      'backup',
      'kuntab/a file.json',
    );
    expect(url.toString()).toBe('https://example.r2.cloudflarestorage.com/backup/kuntab/a%20file.json');
  });
});
