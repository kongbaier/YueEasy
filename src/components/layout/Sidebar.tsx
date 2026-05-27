import { Home, Search, Settings, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

const navItems = [
  { to: "/", icon: Home, label: "发现" },
  { to: "/search", icon: Search, label: "搜索" },
  { to: "/daily", icon: Sparkles, label: "每日推荐" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card">
      <div className="p-4 text-lg font-bold tracking-wide text-primary">
        乐易
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
            key={to}
            to={to}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
