import { Home, LogIn, Search, Settings, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "@/assets/icon.svg?react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuthStore, useUiStore } from "@/stores";
import { Brand } from "./Brand";

const items = [
  { to: "/", icon: Home, label: "发现" },
  { to: "/search", icon: Search, label: "搜索" },
  { to: "/daily", icon: Sparkles, label: "每日推荐" },
];

const footerItems = [{ to: "/settings", icon: Settings, label: "设置" }];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);

  return (
    <Sidebar
      collapsible="icon"
      data-tauri-drag-region
      side="left"
      variant="sidebar"
    >
      <SidebarHeader
        className={cn(
          "h-10 flex-row items-center shrink-0 justify-between",
          state === "collapsed" && "justify-center",
        )}
        data-tauri-drag-region
      >
        {state === "expanded" && (
          <div className={cn("flex items-center gap-2")}>
            <Icon width={14} />
            <Brand className="text-sm" />
          </div>
        )}

        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      className="gap-x-2"
                      isActive={isActive}
                      onClick={() => navigate(item.to)}
                    >
                      <item.icon fill={isActive ? "black" : "none"} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="space-y-0.5">
          {!isLoggedIn && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="gap-x-2"
                onClick={() => setLoginDialogOpen(true)}
              >
                <LogIn />
                <span>登录</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {footerItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  className="gap-x-2"
                  isActive={isActive}
                  onClick={() => navigate(item.to)}
                >
                  <item.icon fill={isActive ? "black" : "none"} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>

      {state !== "collapsed" && <SidebarRail />}
    </Sidebar>
  );
}
