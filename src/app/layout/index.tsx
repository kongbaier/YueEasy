import KeepAliveRouteOutlet from 'keepalive-for-react-router';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { PageScroller } from './PageScroller';
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
                    且缓存会让其重定向逻辑在切走后仍存活，故排除出 KeepAlive。 */}
                <KeepAliveRouteOutlet
                  exclude={['/my/liked']}
                  max={5}
                  wrapperComponent={PageScroller}
                />
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
