import KeepAliveRouteOutlet from "keepalive-for-react-router";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { LenisScroll } from "@/components/lenis-scroll";
import WindowControls from "@/components/system/WindowControls";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useCanGoBack } from "@/hooks/use-can-go-back";
import { PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";

const Header = () => {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return (
    <header
      className="absolute top-0 left-0 right-0 h-10 z-10 flex items-center bg-white/50 backdrop-blur-lg backdrop-brightness-150 dark:bg-black/50"
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
      <WindowControls className="ml-auto mr-1" />
    </header>
  );
};

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen flex-col text-foreground">
        <div className="relative flex flex-1 overflow-hidden">
          <AppSidebar />

          <main className="relative flex flex-1 flex-col bg-background">
            <Header />
            <LenisScroll className="flex-1 min-h-0" overflowTop={40}>
              <KeepAliveRouteOutlet max={5} />
            </LenisScroll>
          </main>
        </div>

        <PlayerBar className="h-18 bg-background rounded-b-md" />

        <QueuePanel />
      </div>
    </SidebarProvider>
  );
}
