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
import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import type { TopPlaylist } from "@/shared/services/ncm";
import { ncm } from "@/shared/services/ncm";
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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import { useLocalStorageState } from "@/shared/hooks/useLocalStorageState";
import { useAuthStore } from "@/stores";
import { useLoginDialog } from "@/features/auth/login-dialog-store";

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

const useNavIndicator = (): React.CSSProperties => {
  const location = useLocation();
  const { state } = useSidebar();
  const locationPathname = location.pathname;

  // Only store measured position; derived-from-state opacity is handled during render
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (state === "collapsed") return;

    const raf = requestAnimationFrame(() => {
      const sidebar = document.querySelector(
        '[data-sidebar="sidebar"]',
      ) as HTMLElement;
      if (!sidebar) return;

      const activeBtn = sidebar.querySelector("[data-active]") as HTMLElement;
      if (!activeBtn) return;

      const sidebarRect = sidebar.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const btnH = btnRect.height;

      setPosition({
        left: btnRect.left - sidebarRect.left,
        height: btnH * 0.5,
        top: btnRect.top - sidebarRect.top + btnH * 0.25,
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [locationPathname, state]);

  // Derive indicator style during render to avoid setState in effect
  if (state === "collapsed" || !position) {
    return { opacity: 0 };
  }

  return {
    left: position.left,
    height: position.height,
    transform: `translateY(${position.top}px)`,
    opacity: 1,
  };
};

const NavIndicator = () => {
  const indicatorStyle = useNavIndicator();
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-0.5 rounded-r-full bg-primary transition-[transform,opacity] duration-250 ease-out"
      style={indicatorStyle}
    />
  );
};

const SidebarBrand = ({ expanded }: { expanded: boolean }) => (
  <AnimatePresence>
    {expanded && (
      <motion.div
        animate={{ maxWidth: "10rem", opacity: 1 }}
        className="flex items-center gap-2 shrink-0 overflow-hidden whitespace-nowrap"
        exit={{ maxWidth: 0, opacity: 0 }}
        initial={{ maxWidth: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <img alt="icon" className="size-4" src="/icon.svg" />
        <span className="text-sm">
          <span className="text-red-400">乐</span>·易
        </span>
      </motion.div>
    )}
  </AnimatePresence>
);

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);

  const [userPlaylists, setUserPlaylists] = useState<TopPlaylist[]>([]);
  const [createdCollapsed, setCreatedCollapsed] = useLocalStorageState(
    "sidebar_created_collapsed",
    false,
  );
  const [favoritedCollapsed, setFavoritedCollapsed] = useLocalStorageState(
    "sidebar_favorited_collapsed",
    false,
  );

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let cancelled = false;

    ncm
      .userPlaylist(userId)
      .then((res) => {
        if (!cancelled)
          setUserPlaylists(res.playlist.filter((p) => p.specialType !== 5));
      })
      .catch(() => {
        toast.error("加载歌单失败，请检查网络");
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
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader
        className="h-10 flex-row items-center shrink-0 justify-between overflow-hidden"
        data-drag-region
      >
        <SidebarBrand expanded={state === "expanded"} />

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
                      <item.icon
                        className={cn(
                          isActive &&
                            "fill-primary text-primary-darkest dark:text-primary-lightest",
                        )}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            我的
          </SidebarGroupLabel>
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
                      <item.icon
                        className={cn(
                          isActive &&
                            "fill-primary text-primary-darkest dark:text-primary-lightest",
                        )}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isLoggedIn &&
          (createdPlaylists.length > 0 || favoritedPlaylists.length > 0) && (
            <SidebarSeparator className="group-data-[collapsible=icon]:mx-1.5" />
          )}

        {isLoggedIn && createdPlaylists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel
              className="cursor-pointer group-data-[collapsible=icon]:hidden"
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
            {(state === "collapsed" || !createdCollapsed) && (
              <SidebarGroupContent className="max-h-48 overflow-y-auto overflow-x-hidden">
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
                          {p.coverImgUrl ? (
                            <img
                              alt=""
                              className="h-5 w-5 shrink-0 rounded-sm object-cover group-data-[collapsible=icon]:size-4"
                              src={p.coverImgUrl}
                            />
                          ) : (
                            <Music className="h-4 w-4 shrink-0" />
                          )}
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
              className="cursor-pointer group-data-[collapsible=icon]:hidden"
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
            {(state === "collapsed" || !favoritedCollapsed) && (
              <SidebarGroupContent className="max-h-48 overflow-y-auto overflow-x-hidden">
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
                          {p.coverImgUrl ? (
                            <img
                              alt=""
                              className="h-5 w-5 shrink-0 rounded-sm object-cover group-data-[collapsible=icon]:size-4"
                              src={p.coverImgUrl}
                            />
                          ) : (
                            <Library className="h-4 w-4 shrink-0" />
                          )}
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
                  <item.icon
                    className={cn(
                      isActive &&
                        "fill-primary text-primary-darkest dark:text-primary-lightest",
                    )}
                  />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>

      {state !== "collapsed" && <SidebarRail />}
      <NavIndicator />
    </Sidebar>
  );
};
