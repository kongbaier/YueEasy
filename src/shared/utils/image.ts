/**
 * Append thumbnail param to NCM image URLs. Non-NCM URLs pass through unchanged.
 * 默认按宽高相等裁剪；传入 height 时保留宽高比（如 banner 9:5 图传 1280, 712）。
 */
export function getNcmImageUrl(
  url: string | undefined,
  width: number,
  height?: number,
): string {
  if (!url) return '';
  if (!url.includes('music.126.net')) return url;
  const base = url.split('?')[0];
  return `${base}?param=${width}y${height ?? width}`;
}
