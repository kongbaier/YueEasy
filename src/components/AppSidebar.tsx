import {
  ChevronDown,
  Clock,
  Heart,
  Home,
  Library,
  LogIn,
  Music,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import type { TopPlaylist } from "@/services/ncm";
import { ncm } from "@/services/ncm";
import { useAuthStore, useUiStore } from "@/stores";
import { Brand } from "./Brand";

const items = [
  { to: "/", icon: Home, label: "发现" },
  { to: "/search", icon: Search, label: "搜索" },
  { to: "/daily", icon: Sparkles, label: "每日推荐" },
];

const myItems = [
  { to: "/my/liked", icon: Heart, label: "我的喜欢" },
  { to: "/my/recent", icon: Clock, label: "最近播放" },
];

const footerItems = [{ to: "/settings", icon: Settings, label: "设置" }];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);

  const [userPlaylists, setUserPlaylists] = useState<TopPlaylist[]>([]);
  const [createdCollapsed, setCreatedCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_created_collapsed") === "true";
  });
  const [favoritedCollapsed, setFavoritedCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_favorited_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_created_collapsed", String(createdCollapsed));
  }, [createdCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      "sidebar_favorited_collapsed",
      String(favoritedCollapsed),
    );
  }, [favoritedCollapsed]);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let cancelled = false;

    ncm
      .userPlaylist(userId)
      .then((res) => {
        if (!cancelled) setUserPlaylists(res.playlist);
      })
      .catch(() => {
        // silently ignore
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userId]);

  const createdPlaylists = userPlaylists.filter(
    (p) => p.creator.userId === userId,
  );
  const favoritedPlaylists = userPlaylists.filter(
    (p) => p.creator.userId !== userId,
  );

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

        {isLoggedIn && (
          <SidebarGroup>
            <SidebarGroupLabel>我的</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {myItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        className="gap-x-2"
                        isActive={isActive}
                        onClick={() => navigate(item.to)}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isLoggedIn && createdPlaylists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setCreatedCollapsed(!createdCollapsed)}
            >
              <span>创建的歌单</span>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 transition-transform",
                  createdCollapsed && "-rotate-90",
                )}
              />
            </SidebarGroupLabel>
            {!createdCollapsed && (
              <SidebarGroupContent className="max-h-48 overflow-y-auto">
                <SidebarMenu className="space-y-0.5">
                  {createdPlaylists.map((p) => {
                    const isActive = location.pathname === `/playlist/${p.id}`;
                    return (
                      <SidebarMenuItem key={p.id}>
                        <SidebarMenuButton
                          className="gap-x-2"
                          isActive={isActive}
                          onClick={() => navigate(`/playlist/${p.id}`)}
                        >
                          <Music className="h-4 w-4 shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {isLoggedIn && favoritedPlaylists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setFavoritedCollapsed(!favoritedCollapsed)}
            >
              <span>收藏的歌单</span>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 transition-transform",
                  favoritedCollapsed && "-rotate-90",
                )}
              />
            </SidebarGroupLabel>
            {!favoritedCollapsed && (
              <SidebarGroupContent className="max-h-48 overflow-y-auto">
                <SidebarMenu className="space-y-0.5">
                  {favoritedPlaylists.map((p) => {
                    const isActive = location.pathname === `/playlist/${p.id}`;
                    return (
                      <SidebarMenuItem key={p.id}>
                        <SidebarMenuButton
                          className="gap-x-2"
                          isActive={isActive}
                          onClick={() => navigate(`/playlist/${p.id}`)}
                        >
                          <Library className="h-4 w-4 shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}
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
