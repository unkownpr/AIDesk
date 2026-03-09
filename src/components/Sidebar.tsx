import { cn } from "@/lib/utils";
import { LayoutDashboard, ListTodo, Bot, FolderKanban, Activity, Settings } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import type { Page } from "@/lib/types";
import type { ComponentType } from "react";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", Icon: ListTodo },
  { id: "agents", label: "Agents", Icon: Bot },
  { id: "projects", label: "Projects", Icon: FolderKanban },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside className={cn(
      "flex h-screen w-52 flex-col border-r",
      isDark ? "border-zinc-800/80 bg-zinc-950" : "border-zinc-200 bg-white"
    )}>
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Logo size={26} />
        <span className={cn("text-[15px] font-semibold tracking-tight", isDark ? "text-zinc-100" : "text-zinc-900")}>
          AIDesk
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2" aria-label="Main navigation">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={currentPage === id ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
              currentPage === id
                ? isDark
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "bg-emerald-50 text-emerald-700 font-medium"
                : isDark
                  ? "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className={cn("border-t px-4 py-3", isDark ? "border-zinc-800/80" : "border-zinc-200")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Port 3939
          </div>
          <a
            href="https://ssilistre.dev"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-[10px] font-medium tracking-wide transition-colors",
              isDark ? "text-zinc-600 hover:text-emerald-400" : "text-zinc-400 hover:text-emerald-600"
            )}
          >
            ssilistre.dev
          </a>
        </div>
      </div>
    </aside>
  );
}
