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

export type ImageDecodeResult = 'decoded' | 'error';

/**
 * 离屏预加载并完整解码一张图。
 *
 * 浏览器对渐进式图片（progressive JPEG / 交错 PNG）会在数据流到达时逐行绘制，
 * 直接挂 `<img>` 会出现「从上往下先显示一半」的观感。`decode()` 在图片可安全绘制
 * （完整解码）后才 resolve，本函数据此把「何时可绘制」暴露给调用方。
 *
 * decode() 不可用的环境退化为 load/error 事件。**永不 reject**：失败以 `'error'`
 * 返回，由调用方决定回退策略（见 `useDecodedSrc` 的 fallbackOnError）。
 *
 * 图片解码的唯一入口：DecodedImage / CrossfadeImage / 播放页预加载都走它，
 * 避免 decode 特性检测与错误兜底在多处复制。
 */
export function decodeImage(src: string): Promise<ImageDecodeResult> {
  const img = new Image();
  img.src = src;

  const decode = (img as HTMLImageElement & { decode?: () => Promise<void> })
    .decode;
  if (typeof decode === 'function') {
    return decode.call(img).then(
      () => 'decoded' as const,
      () => 'error' as const,
    );
  }

  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve('decoded'), { once: true });
    // decode() 路径失败也走 error；这里 error 事件即失败
    img.addEventListener('error', () => resolve('error'), { once: true });
  });
}
