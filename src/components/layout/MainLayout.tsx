import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import WindowControls from "@/components/system/WindowControls";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PlayerBar } from "./PlayerBar";

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen flex-col text-foreground">
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />

          <main className="flex flex-1 flex-col overflow-hidden bg-background">
            <div
              className="flex h-10 shrink-0 items-center"
              data-tauri-drag-region
            >
              <WindowControls className="ml-auto" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <PlayerBar className="z-10" />
      </div>
    </SidebarProvider>
  );
}
