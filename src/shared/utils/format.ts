export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 把时间量格式化为 `mm:ss`，超过 1 小时则为 `hh:mm:ss`。
 * @param value 时间量，默认单位毫秒
 * @param unit 入参单位，`'ms'`（默认）或 `'s'`
 */
export function formatTime(value: number, unit: 'ms' | 's' = 'ms'): string {
  if (!Number.isFinite(value) || value <= 0) return '00:00';
  const totalSeconds = Math.floor(unit === 'ms' ? value / 1000 : value);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatCount(count: number): string {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return count.toString();
}

/**
 * 字节数 → 人类可读容量（B / KB / MB / GB / TB）。
 * 小于 1 KB 按整数 B 展示（此时小数没有意义）；其余保留一位小数。
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0
    ? `${Math.round(value)} B`
    : `${value.toFixed(1)} ${units[unit]}`;
}

/** Format queue count for display: raw number when ≤99, "99+" otherwise. */
export function formatQueueCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** 时间戳 → `YYYY-MM-DD`（需要精确到日的场景，如云盘上传时间）。 */
export function formatYmd(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};
