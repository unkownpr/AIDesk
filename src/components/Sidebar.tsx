import { cn } from "@/lib/utils";
import { LayoutDashboard, ListTodo, Bot, FolderKanban, Activity, Settings, Sun, Moon } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "@/hooks/useTheme";
import type { Page } from "@/lib/types";
import type { ComponentType } from "react";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; Icon: ComponentType<{ size?: number }>; desc: string }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, desc: "Overview" },
  { id: "projects", label: "Projects", Icon: FolderKanban, desc: "Your code" },
  { id: "tasks", label: "Tasks", Icon: ListTodo, desc: "All tasks" },
  { id: "agents", label: "Agents", Icon: Bot, desc: "AI workers" },
  { id: "activity", label: "Activity", Icon: Activity, desc: "Event log" },
  { id: "settings", label: "Settings", Icon: Settings, desc: "Config" },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside className={cn(
      "flex h-screen w-56 flex-col border-r",
      isDark ? "border-[#2d2d3c]/40 bg-[#0a0a0f]" : "border-gray-200 bg-white"
    )}>
      <div className="flex items-center gap-2.5 px-5 py-6">
        <Logo size={28} />
        <span className={cn("text-base font-semibold tracking-tight", isDark ? "text-gray-100" : "text-gray-900")}>
          AIDesk
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={currentPage === id ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-all duration-150",
              currentPage === id
                ? isDark
                  ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
                  : "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
                : isDark
                  ? "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className={cn("border-t px-4 py-4 space-y-3", isDark ? "border-[#2d2d3c]/40" : "border-gray-200")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            Port 3939
          </div>
          <button
            onClick={toggle}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150",
              isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            )}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>
        <div className={cn("text-[11px] text-center", isDark ? "text-gray-600" : "text-gray-400")}>
          ssilistre.dev
        </div>
      </div>
    </aside>
  );
}
