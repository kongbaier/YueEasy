import KeepAliveRouteOutlet from "keepalive-for-react-router";
import { ChevronLeft } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { PlayerBar, QueuePanel } from "@/components/player";
import { WindowControls } from "@/components/system";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ScrollContainerContext } from "@/hooks/useScrollContainer";
import { useCanGoBack } from "./useCanGoBack";

const Header = () => {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return (
    <header className="h-10 flex items-center shrink-0" data-tauri-drag-region>
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
      <WindowControls className="ml-auto mr-1" />
    </header>
  );
};

export const MainLayout = () => {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  );
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    setScrollContainer(el);
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen flex-col text-foreground">
        <div className="relative flex flex-1 overflow-hidden">
          <AppSidebar />

          <main className="relative flex flex-1 flex-col bg-background min-w-0">
            <Header />
            <ScrollContainerContext.Provider value={scrollContainer}>
              <div
                className="flex-1 min-h-0 min-w-0 overflow-y-auto"
                ref={scrollRef}
              >
                <KeepAliveRouteOutlet max={5} />
              </div>
            </ScrollContainerContext.Provider>
          </main>
        </div>

        <PlayerBar className="h-18 bg-background rounded-b-md" />

        <QueuePanel />
      </div>
    </SidebarProvider>
  );
};
