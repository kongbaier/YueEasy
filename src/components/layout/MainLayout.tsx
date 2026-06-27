import { getCurrentWindow } from "@tauri-apps/api/window";
import KeepAliveRouteOutlet from "keepalive-for-react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar, QueuePanel } from "@/components/player";
import { WindowControls } from "@/components/system";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUiStore } from "@/stores";
import { PageScroller } from "./PageScroller";
import { PageTitleProvider, usePageTitle } from "./PageTitleContext";
import { useCanGoBack } from "./useCanGoBack";

const Header = () => {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { title } = usePageTitle();

  return (
    <header
      className="h-10 flex items-center shrink-0 select-none"
      data-tauri-drag-region
    >
      {canGoBack && (
        <button
          aria-label="返回"
          className="ml-2 p-1 rounded-md hover:bg-black/10 transition-colors"
          onClick={() => navigate(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {title && (
        <nav className="ml-3 flex items-center gap-1.5 text-xs min-w-0">
          <span className="text-muted-foreground/60 font-medium">乐·易</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/80 font-medium truncate">
            {title}
          </span>
        </nav>
      )}
      <WindowControls className="ml-auto mr-1" />
    </header>
  );
};

export function MainLayout() {
  // Single listener for window maximize state — shared by all WindowControls instances
  const setMaximized = useUiStore((s) => s.setMaximized);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const check = () => {
      appWindow.isMaximized().then(setMaximized);
    };
    check();
    const unlisten = appWindow.onResized(() => {
      check();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setMaximized]);

  return (
    <PageTitleProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-screen flex-col text-foreground">
          <div className="relative flex flex-1 overflow-hidden">
            <AppSidebar />

            <main className="relative flex flex-1 flex-col bg-background min-w-0">
              <Header />
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
