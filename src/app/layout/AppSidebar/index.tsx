import {
  Clock,
  Heart,
  Home,
  Library,
  LogIn,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/shared/utils/cn';
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
  SidebarTrigger,
  useSidebar,
} from '@/shared/ui/sidebar';
import { useAuthViewModel } from '@/modules/auth/hooks/useAuthViewModel';

const items = [
  { to: '/', icon: Home, label: '发现' },
  { to: '/search', icon: Search, label: '搜索' },
  { to: '/daily', icon: Sparkles, label: '每日推荐' },
];

const myItems = [
  { to: '/my/liked', icon: Heart, label: '我的喜欢' },
  { to: '/my/recent', icon: Clock, label: '最近播放' },
  { to: '/my/playlists', icon: Library, label: '我的歌单' },
];

const footerItems = [{ to: '/settings', icon: Settings, label: '设置' }];

const navKeys = new Set(
  [...items, ...myItems, ...footerItems].map((i) => i.to),
);

const SidebarBrand = ({ expanded }: { expanded: boolean }) => (
  <AnimatePresence>
    {expanded && (
      <motion.div
        animate={{ maxWidth: '10rem', opacity: 1 }}
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
  const { isLoggedIn, openLogin } = useAuthViewModel();

  // 双层路由：一级页更新高亮，二级页（playlist/album 详情）保持来源高亮
  const [activeKey, setActiveKey] = useState<string | null>(() =>
    navKeys.has(location.pathname) ? location.pathname : null,
  );

  const pathname = location.pathname;
  if (navKeys.has(pathname) && pathname !== activeKey) {
    setActiveKey(pathname);
  }

  return (
    <Sidebar
      style={
        {
          '--sidebar-width': 'rem',
          '--sidebar-width-mobile': '20rem',
        } as React.CSSProperties
      }
      collapsible="icon"
      side="left"
      variant="sidebar"
      className="static h-full border-sidebar-border"
    >
      <SidebarHeader
        className="h-10 flex-row items-center shrink-0 justify-between overflow-hidden"
        data-drag-region
      >
        <SidebarBrand expanded={state === 'expanded'} />

        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {items.map((item) => {
                const isActive = activeKey === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      className="gap-x-3"
                      isActive={isActive}
                      onClick={() => navigate(item.to)}
                    >
                      <item.icon className={cn(isActive && 'fill-primary')} />
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
                const isActive = activeKey === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      className="gap-x-3"
                      isActive={isActive}
                      onClick={() => navigate(item.to)}
                    >
                      <item.icon className={cn(isActive && 'fill-primary')} />
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
              <SidebarMenuButton className="gap-x-3" onClick={openLogin}>
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
                  className="gap-x-3"
                  isActive={isActive}
                  onClick={() => navigate(item.to)}
                >
                  <item.icon className={cn(isActive && 'fill-primary')} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
