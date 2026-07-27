import KeepAliveRouteOutlet from "keepalive-for-react-router";
import { PlayerBar, QueuePanel } from "@/features/player/components";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { PageScroller } from "./PageScroller";
import { PageTitleProvider } from "./PageTitleContext";

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
                <KeepAliveRouteOutlet max={5} wrapperComponent={PageScroller} />
              </div>
            </main>
          </div>

          <PlayerBar className="h-18 bg-background rounded-b-md" />

          <QueuePanel />
        </div>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
