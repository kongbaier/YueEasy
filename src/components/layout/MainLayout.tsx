import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { LenisScroll } from "@/components/lenis-scroll";
import WindowControls from "@/components/system/WindowControls";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PlayerBar } from "./PlayerBar";

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen flex-col text-foreground">
        <div className="relative flex flex-1 overflow-hidden">
          <AppSidebar />

          <main className="relative flex flex-1 flex-col bg-background/70">
            <header
              className="absolute top-0 left-0 right-0 h-10 z-10 flex items-center bg-white/50 backdrop-blur-lg backdrop-brightness-150"
              data-tauri-drag-region
            >
              <WindowControls className="ml-auto mr-1" />
            </header>
            <LenisScroll className="flex-1 min-h-0" overflowTop={40}>
              <Outlet />
            </LenisScroll>
          </main>
        </div>
        <PlayerBar className="h-19 bg-background rounded-b-md" />
      </div>
    </SidebarProvider>
  );
}
