/**
 * 将 CSS 像素对齐到物理设备像素网格（纯函数，dpr 由调用方注入）。
 *
 * 用途：透明窗口 + Mica/Acrylic 合成下，高饱和色元素（如红色进度条）的边缘
 * 若落在亚像素位置会产生亚像素色散（彩色晕染点），取整到设备像素后可消除。
 *
 * dpr 的读取是浏览器环境依赖，不属于本函数职责：由调用侧（组件/hook）注入，
 * 常用来源为 `window.devicePixelRatio`（见 `useDevicePixelRatio`）。
 * 这样本函数保持纯、可单测，不直接触碰 window。
 */
export function snapToDevicePixel(px: number, dpr: number): number {
  if (!(dpr > 0)) return px;
  return Math.round(px * dpr) / dpr;
}
