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
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

const useNavIndicator = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const elRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is a trigger, not a value read
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    if (state === "collapsed") {
      el.style.opacity = "0";
      return;
    }

    const sidebar = document.querySelector(
      '[data-sidebar="sidebar"]',
    ) as HTMLElement;
    if (!sidebar) return;

    const activeBtn = sidebar.querySelector("[data-active]") as HTMLElement;
    if (!activeBtn) {
      el.style.opacity = "0";
      return;
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const btnH = btnRect.height;
    const top = btnRect.top - sidebarRect.top + btnH * 0.25;
    const left = btnRect.left - sidebarRect.left;
    const height = btnH * 0.5;

    el.style.left = `${left}px`;
    el.style.height = `${height}px`;
    el.style.transform = `translateY(${top}px)`;
    el.style.opacity = "1";
  }, [location.pathname, state]);

  return elRef;
};

const NavIndicator = () => {
  const ref = useNavIndicator();
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-0.5 rounded-r-full bg-primary opacity-0 transition-[transform,opacity] duration-[250ms] ease-out"
      ref={ref}
    />
  );
};

const SidebarBrand = ({ expanded }: { expanded: boolean }) => {
  const [visible, setVisible] = useState(expanded);
  const [entered, setEntered] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setVisible(true);
      const raf = requestAnimationFrame(() => {
        setEntered(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setEntered(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 shrink-0 overflow-hidden whitespace-nowrap transition-all duration-200",
        entered ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
      )}
    >
      {" "}
      <img alt="icon" className="size-4" src="/icon.svg" />
      <span className="text-sm">
        <span className="text-red-400">乐</span>·易
      </span>
    </div>
  );
};

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);

  const [delayedCollapse, setDelayedCollapse] = useState(state === "collapsed");

  useEffect(() => {
    if (state !== "collapsed") {
      setDelayedCollapse(false);
      return;
    }
    const timer = setTimeout(() => setDelayedCollapse(true), 200);
    return () => clearTimeout(timer);
  }, [state]);

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
        if (!cancelled)
          setUserPlaylists(res.playlist.filter((p) => p.specialType !== 5));
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
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader
        className={cn(
          "h-10 flex-row items-center shrink-0 justify-between overflow-hidden",
          delayedCollapse && "justify-center",
        )}
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
                          {p.coverImgUrl ? (
                            <img
                              alt=""
                              className="h-5 w-5 shrink-0 rounded-sm object-cover"
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
                          {p.coverImgUrl ? (
                            <img
                              alt=""
                              className="h-5 w-5 shrink-0 rounded-sm object-cover"
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
