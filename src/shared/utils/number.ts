/** 把数值夹到 0..1（进度、比例用）。非有限数按 0 处理，避免 NaN 漏进样式。 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
