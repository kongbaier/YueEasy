import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PlayerBar } from "./PlayerBar";

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen flex-col text-foreground">
        <header
          className="absolute w-full h-10 z-10"
          data-tauri-drag-region
        ></header>
        <div className="flex flex-1 overflow-hidden z-0">
          <AppSidebar />

          <main className="flex-1 overflow-y-auto bg-background">
            <Outlet />
          </main>
        </div>
        <PlayerBar className="z-10" />
      </div>
    </SidebarProvider>
  );
}
