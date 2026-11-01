import KeepAliveRouteOutlet from 'keepalive-for-react-router';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { PageTitleProvider } from './PageTitleContext';
import { PlayerBar } from '@/features/player/components/PlayerBar';
import { QueuePanel } from '@/features/player/components/QueueDrawer';

export function AppLayout() {
  return (
    <PageTitleProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-screen flex-col text-foreground">
          <div className="relative flex flex-1 overflow-hidden">
            <AppSidebar />

            <main className="relative flex flex-1 flex-col bg-background min-w-0">
              <AppHeader />
              <div className="flex-1 min-h-0 min-w-0">
                {/* /my/liked 是纯守卫页（登录态 + id 解析后立即重定向），无 UI 状态可缓存，
                    且缓存会让其重定向逻辑在切走后仍存活，故排除出 KeepAlive。

                    上限给到 8：首页 / 搜索等一级页之外，二级页（歌单、专辑、歌手、用户）
                    都是高频来回跳的详情页，5 个槽位会被 LRU 过快淘汰（返回时会丢滚动位置与展开态）。

                    滚动所有权在页面：布局层只给一个定高（h-full 可解析）的挂载点，
                    不提供滚动容器 —— 各页面按自己的结构决定滚什么（见 AGENTS.md §8）。 */}
                <KeepAliveRouteOutlet exclude={['/my/liked']} max={8} />
              </div>
            </main>
          </div>

          <PlayerBar className="h-18" />

          <QueuePanel />
        </div>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
