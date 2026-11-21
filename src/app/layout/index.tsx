import { useEffect, useRef } from 'react';
import KeepAliveRouteOutlet from 'keepalive-for-react-router';
import { useLocation } from 'react-router-dom';
import { setFullscreen } from '@/tauri/window';
import { cn } from '@/shared/utils/cn';
import { PLAYER_PAGE_PATH } from '@/features/player/hooks/usePlayerPage';
import { usePlayerPanelStore } from '@/features/player/stores/playerPanelStore';
import PlayerPanel from '@/features/player/PlayerPanel';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { useFocusNavigation } from '@/shared/hooks/useFocusNavigation';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { PageTitleProvider } from './PageTitleContext';
import { RouteViewTransition } from './RouteViewTransition';
import { PlayerBar } from '@/features/player/components/PlayerBar';
import { QueuePanel } from '@/features/player/components/QueueDrawer';

export function AppLayout() {
  // 全应用只装一次：Tab 走区域、方向键走区域内条目（见 shared/lib/focus）
  useFocusNavigation();

  const { pathname } = useLocation();
  const onPlayerPage = pathname === PLAYER_PAGE_PATH;
  /**
   * 板子 A 什么时候让位：
   * - 进场：面板一出现就让位（两者同时淡变）；
   * - 退场：**进入退出相位时就回来**（`closing` 一翻就淡入），而不是等面板淡出跑完
   *   （`visible` 变 false）才回来 —— 那样背景会「等图片到位了才开始变」。
   */
  const panelVisible = usePlayerPanelStore((s) => s.visible);
  const panelClosing = usePlayerPanelStore((s) => s.closing);
  const appBoardDimmed = panelVisible && !panelClosing;

  /**
   * 收全屏挂在「离开 /player」这一个观察点上 —— 出口由导航产生（返回键、侧栏跳转、
   * 歌手跳转、无歌可播的安全网），写在这里所有出口自动一致，见 AGENTS §3。
   */
  const wasOnPlayerPage = useRef(onPlayerPage);
  useEffect(() => {
    if (wasOnPlayerPage.current && !onPlayerPage) void setFullscreen(false);
    wasOnPlayerPage.current = onPlayerPage;
  }, [onPlayerPage]);

  return (
    <PageTitleProvider>
      <SidebarProvider defaultOpen={true}>
        {/* data-focus-shell：模态浮层（播放页面板 / 队列抽屉）打开时，
            引擎把「浮层之外的外壳」标 inert，被盖住的页面既不能 Tab 也读不到 */}
        <div
          className="flex h-screen w-screen flex-col text-foreground"
          data-focus-shell
        >
          {/* ═══ 板子 A：应用（外壳 + 当前页）═══
              进入播放页时整块淡出：面板在场时它 `opacity-0 invisible` ——
              `invisible` 不只是看不见，还让它退出焦点序列与辅助技术树（比 inert 便宜）。
              **必须保持挂载与布局**：下面那块板子（`PlayerPanel`）的交叉淡变依赖它也活着。 */}
          <div
            className={cn(
              'relative flex flex-1 flex-col overflow-hidden',
              'transition-[opacity,visibility] duration-300',
              appBoardDimmed && 'invisible opacity-0',
            )}
          >
            <div className="relative flex flex-1 overflow-hidden">
              <AppSidebar />

              <main className="relative flex flex-1 flex-col bg-background min-w-0">
                <AppHeader />
                <div className="flex-1 min-h-0 min-w-0">
                  {/* RouteViewTransition 必须排在 outlet 前面：`data-vt` 要在 outlet
                    发起转场之前写好（它自己不发转场，只做标记与开发期断言） */}
                  <RouteViewTransition />

                  {/* 一级页（含「我的喜欢」）都留在 KeepAlive 缓存里：切回来保留滚动位置与展开态。
                    纯守卫 / 重定向页（登录守卫、一次性跳转、splash）必须用 exclude 排除。

                    上限给到 8：首页 / 搜索等一级页之外，二级页（歌单、专辑、歌手、用户）
                    都是高频来回跳的详情页，5 个槽位会被 LRU 过快淘汰（返回时会丢滚动位置与展开态）。

                    滚动所有权在页面：布局层只给一个定高（h-full 可解析）的挂载点，
                    不提供滚动容器 —— 各页面按自己的结构决定滚什么（见 AGENTS.md §8）。

                    viewTransition：切页走浏览器的双快照转场（而不是瞬时换 DOM）。
                    它与「transition」属性（延迟卸载）是两套机制，不要同时开。 */}
                  <KeepAliveRouteOutlet max={8} viewTransition />
                </div>
              </main>
            </div>

            <PlayerBar className="h-18" />
          </div>

          {/* ═══ 板子 B：播放页（挂在布局层，不参与 outlet 换页）═══
              两块板子同时在文档里，各自改透明度就是页面切换。
              路由 /player 只做 URL / 返回键镜像。 */}
          {panelVisible && <PlayerPanel />}

          <QueuePanel />
        </div>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
