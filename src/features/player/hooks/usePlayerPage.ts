import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { setFullscreen } from '@/tauri/window';
import { usePlayerPanelStore } from '@/features/player/stores/playerPanelStore';

/** 播放页的路由 —— 只做 URL / 返回键镜像，画面由布局层的面板负责（见 playerPanelStore）。 */
export const PLAYER_PAGE_PATH = '/player';

/** 等一帧：让窗口尺寸的变化真正落到视口上（IPC 回来 ≠ WebView 已经重新布局）。 */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * 播放页的 VM 门面。**开关不是导航，是两块板子的交叉淡变**：
 *
 * - `open()`：面板进场（淡入 + 封面 FLIP，应用那块板子同时淡出）。**先进场、后导航**——
 *   进场期间应用那页还必须是活的，否则「下面那块板子」是空的；
 * - `close(afterClose?)`：**先收全屏并等它落地**，再导航回来（应用那页先回到文档里
 *   当底下的板子），最后淡出面板；退出动画结束时面板自己 `hide()`。
 *   收全屏必须在这里**导航之前**做完：退场里封面要 FLIP 回播放栏，量到的 rect 必须是
 *   窗口化之后的坐标 —— 先导航的话窗口随后缩小，封面会落到错的位置。
 *
 * 导航进 /player 的时机在面板里（进场动画跑完），不在这里 —— 这里只管意图。
 *
 * 不在播放页时 `close()` 只跑收尾（安全网 / 重复调用不会挂住）。
 *
 * 收全屏挂在「离开 /player」这个观察点（`AppLayout`），见 AGENTS §3。
 */
export function usePlayerPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOpen = pathname === PLAYER_PAGE_PATH;
  const { visible, closing } = usePlayerPanelStore(
    useShallow((s) => ({ visible: s.visible, closing: s.closing })),
  );

  const open = useCallback(() => {
    const store = usePlayerPanelStore.getState();
    if (store.visible) return;
    store.show();
  }, []);

  const close = useCallback(
    async (afterClose?: () => void) => {
      /**
       * 先收全屏（并等 IPC 回来）：全屏 → 窗口态会改视口尺寸，退场动画的封面 FLIP
       * 是按视口坐标算的。不等的话动画先按全屏坐标起飞，窗口再缩小 → 落到错的位置。
       * 非全屏时 `set_fullscreen(false)` 在 tao 侧早退（`old_fullscreen == None`），零副作用。
       */
      await setFullscreen(false).catch(() => {});
      await nextFrame();

      if (isOpen) {
        // 深链直接进 /player 时没有上一页（idx === 0），退首页而不是把应用历史退掉
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (typeof idx === 'number' && idx > 0) navigate(-1);
        else navigate('/', { replace: true });
      }
      usePlayerPanelStore.getState().startClosing();
      afterClose?.();
    },
    [isOpen, navigate],
  );

  return { isOpen, visible, closing, open, close };
}
