export function faviconOf(url: string, size = 64): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  } catch {
    return '';
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function greetingByTime(language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const hour = new Date().getHours();
  if (language === 'en-US') {
    if (hour < 6) return 'Late night, take care';
    if (hour < 12) return 'Good morning, welcome back!';
    if (hour < 18) return 'Good afternoon, keep the momentum';
    return 'Good evening, great to see you';
  }
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 12) return '上午好，欢迎回来！';
  if (hour < 18) return '下午好，继续高效前进';
  return '晚上好，今天也很棒';
}

export function ensureHttpUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
