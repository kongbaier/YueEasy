import { useEffect, useRef, useState } from 'react';
import * as windowApi from '@/tauri/window';

/** 上报者编号：同名控件可能有多处（标题栏 / 播放页），原生侧按 id 各建一份命中层。 */
let reporterSeq = 0;

/**
 * Windows 11「贴靠布局」桥接：把最大化按钮登记为原生命中层，并镜像原生悬停态。
 *
 * 为什么必须在原生侧做：系统只在鼠标下那个窗口的 `WM_NCHITTEST` 返回 `HTMAXBUTTON` 时，才会在
 * 悬停时弹出贴靠布局浮出层 —— WebView 里的 DOM 给不出这个信号。而 `decorations: false` 下客户区
 * 被一层层子窗口盖满（tauri 的缩放边条 + WebView2 子窗口），所以原生侧是在按钮位置**叠一个透明
 * 命中层子窗口**，而不是给顶层窗口装子类（见 Rust `platform::snap_layout`）。
 *
 * 由此带来的两个副作用，本 hook 一并兜住：
 * 1. 命中层在系统眼里是非客户区 → WebView 收不到该区域的鼠标消息，点击由原生接管（最大化/还原照旧）；
 * 2. 同理 `:hover` 不再生效 → 用 `hovered` 手动补高亮。
 *
 * @param enabled 按钮存在且可用时为 true（窗口全屏时传 false，撤销命中层）
 * @returns `ref` 绑到最大化按钮；`hovered` 为原生回灌的悬停态
 */
export function useMaximizeButtonSnap(enabled: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  const [id] = useState(() => ++reporterSeq);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!enabled) {
      void windowApi.setMaximizeButtonRect(id, null);
      return;
    }

    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let sent = '';

    const report = () => {
      frame = 0;
      const { x, y, width, height } = el.getBoundingClientRect();
      const key = `${x}|${y}|${width}|${height}`;
      if (key === sent) return;
      sent = key;
      void windowApi
        .setMaximizeButtonRect(id, { x, y, width, height })
        .catch(() => {});
    };

    // 入场动画用的是 transform 位移，getBoundingClientRect 会短暂偏离最终位置：
    // 头 1 秒逐帧追（仅在变化时过 IPC），之后交给 resize / ResizeObserver。
    const settleUntil = performance.now() + 1000;
    const tick = () => {
      report();
      if (performance.now() < settleUntil) frame = requestAnimationFrame(tick);
    };
    tick();

    // 按钮右对齐，位置只随窗口宽度变化；用 rAF 合并连续触发，避免布局抖动时反复过 IPC。
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(report);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    window.addEventListener('resize', schedule);

    // 换缩放 / 拖到不同 DPI 的副屏时，CSS 尺寸可能一点没变、物理像素却变了：原生侧按新 DPI 重算，
    // 所以这里清掉去重键强制重报一次。
    const rescale = () => {
      sent = '';
      schedule();
    };
    const scaleListener = windowApi.onScaleChanged(rescale);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      void scaleListener.then((fn) => fn());
      void windowApi.setMaximizeButtonRect(id, null).catch(() => {});
    };
  }, [enabled, id]);

  useEffect(() => {
    const unlisten = windowApi.onMaximizeButtonHover((payload) => {
      if (payload.id === id) setHovered(payload.hovering);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [id]);

  return { ref, hovered };
}
