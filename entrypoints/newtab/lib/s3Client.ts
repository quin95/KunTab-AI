import type { CloudSyncSettings } from '../models';

const SERVICE = 's3';
const REGION = 'auto';
const ALGORITHM = 'AWS4-HMAC-SHA256';
const EMPTY_PAYLOAD_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const JSON_CONTENT_TYPE = 'application/json;charset=utf-8';

export function normalizeS3KeyPrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, '');
}

export function buildS3ObjectKey(prefix: string): string {
  const normalized = normalizeS3KeyPrefix(prefix);
  if (!normalized) throw new Error('Key 前缀不能为空');
  return `${normalized}/kuntab-sync.json`;
}

export function buildS3TwoFactorObjectKey(prefix: string): string {
  const normalized = normalizeS3KeyPrefix(prefix);
  if (!normalized) throw new Error('Key 前缀不能为空');
  return `${normalized}/kuntab-2fa.json`;
}

export function buildS3ConnectionTestKey(prefix: string): string {
  const normalized = normalizeS3KeyPrefix(prefix);
  if (!normalized) throw new Error('Key 前缀不能为空');
  return `${normalized}/.kuntab-connection-test.json`;
}

export function buildPathStyleObjectUrl(endpoint: string, bucket: string, key: string): URL {
  const base = endpoint.trim().replace(/\/+$/g, '');
  const normalizedBucket = bucket.trim();
  if (!base) throw new Error('端点地址不能为空');
  if (!normalizedBucket) throw new Error('Bucket 不能为空');
  return new URL(`${base}/${encodeURIComponent(normalizedBucket)}/${key.split('/').map(encodeURIComponent).join('/')}`);
}

function assertS3Credentials(settings: CloudSyncSettings): void {
  if (!settings.accessKeyId.trim()) throw new Error('Access Key ID 不能为空');
  if (!settings.secretAccessKey.trim()) throw new Error('Secret Access Key 不能为空');
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeUtf8(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encodeUtf8(value)));
}

async function hmac(key: ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encodeUtf8(value));
}

async function getSignatureKey(secretAccessKey: string, dateStamp: string): Promise<ArrayBuffer> {
  const kDate = await hmac(encodeUtf8(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, REGION);
  const kService = await hmac(kRegion, SERVICE);
  return await hmac(kService, 'aws4_request');
}

function canonicalQueryString(url: URL): string {
  const entries = [...url.searchParams.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA === keyB) return valueA.localeCompare(valueB);
    return keyA.localeCompare(keyB);
  });
  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function buildSignedHeaders(params: {
  method: 'GET' | 'PUT';
  url: URL;
  settings: CloudSyncSettings;
  payloadHash: string;
  contentType?: string;
}): Promise<Record<string, string>> {
  assertS3Credentials(params.settings);

  const { amzDate, dateStamp } = toAmzDate(new Date());
  const signatureHeaders: Record<string, string> = {
    host: params.url.host,
    'x-amz-content-sha256': params.payloadHash,
    'x-amz-date': amzDate,
  };

  if (params.contentType) {
    signatureHeaders['content-type'] = params.contentType;
  }

  const sortedHeaderNames = Object.keys(signatureHeaders).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${signatureHeaders[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = sortedHeaderNames.join(';');
  const canonicalRequest = [
    params.method,
    params.url.pathname,
    canonicalQueryString(params.url),
    canonicalHeaders,
    signedHeaders,
    params.payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  const signingKey = await getSignatureKey(params.settings.secretAccessKey, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const requestHeaders: Record<string, string> = {
    Authorization: `${ALGORITHM} Credential=${params.settings.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': params.payloadHash,
    'x-amz-date': amzDate,
  };

  if (params.contentType) {
    requestHeaders['content-type'] = params.contentType;
  }

  return requestHeaders;
}

function readXmlTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getFriendlyS3ErrorMessage(code: string, message: string): string {
  const accessKeyLength = message.match(/Credential access key has length (\d+), should be (\d+)/i);
  if (accessKeyLength) {
    const [, actual, expected] = accessKeyLength;
    return `Access Key ID 格式不正确：应为 ${expected} 位，当前是 ${actual} 位，请检查是否多复制或少复制了字符。`;
  }

  if (code === 'InvalidAccessKeyId') {
    return 'Access Key ID 无效，请检查 R2/S3 访问密钥是否填写正确。';
  }
  if (code === 'SignatureDoesNotMatch') {
    return 'Secret Access Key 不匹配，请检查密钥是否复制完整，且没有多余空格。';
  }
  if (code === 'AccessDenied') {
    return '访问被拒绝，请确认该密钥有当前 Bucket 和 Key 前缀的读写权限。';
  }
  if (code === 'NoSuchBucket') {
    return 'Bucket 不存在，请检查 Bucket 名称和端点地址是否匹配。';
  }
  if (code === 'InvalidArgument') {
    return message ? `参数不正确：${message}` : '参数不正确，请检查云同步配置。';
  }

  return '';
}

export function formatS3ErrorMessage(method: 'GET' | 'PUT', status: number, body: string): string {
  const trimmedBody = body.trim();
  const code = decodeXmlEntities(readXmlTag(trimmedBody, 'Code'));
  const message = decodeXmlEntities(readXmlTag(trimmedBody, 'Message'));
  const friendlyMessage = getFriendlyS3ErrorMessage(code, message);

  if (friendlyMessage) {
    return `${friendlyMessage}（S3 ${method} ${status}${code ? `，${code}` : ''}）`;
  }

  if (code || message) {
    return `S3 ${method} ${status}：${[code, message].filter(Boolean).join(' - ')}`;
  }

  return `S3 ${method} ${status}${trimmedBody ? `：${trimmedBody}` : ''}`;
}

async function readErrorResponse(method: 'GET' | 'PUT', response: Response): Promise<string> {
  try {
    const text = await response.text();
    return formatS3ErrorMessage(method, response.status, text);
  } catch {
    return `S3 ${method} ${response.status}`;
  }
}

export async function getS3Json<T>(settings: CloudSyncSettings, key: string): Promise<T | null> {
  const url = buildPathStyleObjectUrl(settings.endpoint, settings.bucket, key);
  // Add a unique timestamp parameter to avoid browser or CDN caching
  url.searchParams.set('t', Date.now().toString());

  const headers = await buildSignedHeaders({
    method: 'GET',
    url,
    settings,
    payloadHash: EMPTY_PAYLOAD_SHA256,
  });
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readErrorResponse('GET', response));
  }
  return (await response.json()) as T;
}

export async function putS3Json(settings: CloudSyncSettings, key: string, value: unknown): Promise<void> {
  const url = buildPathStyleObjectUrl(settings.endpoint, settings.bucket, key);
  const body = JSON.stringify(value, null, 2);
  const headers = await buildSignedHeaders({
    method: 'PUT',
    url,
    settings,
    payloadHash: await sha256(body),
    contentType: JSON_CONTENT_TYPE,
  });
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse('PUT', response));
  }
}
