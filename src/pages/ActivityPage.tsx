import { useCallback, useState } from "react";
import { listActivityLogs } from "@/lib/tauri";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { formatDate } from "@/lib/utils";
import type { ActivityLogResponse, EntityType } from "@/lib/types";
import {
  ListTodo, Bot, KeyRound, Server, GitBranch, Monitor, FolderKanban,
  Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 30;

const entityIcons: Record<EntityType, React.FC<{ size?: number; className?: string }>> = {
  task: ListTodo,
  agent: Bot,
  secret: KeyRound,
  mcp: Server,
  git: GitBranch,
  project: FolderKanban,
  system: Monitor,
};

const actionColors: Record<string, string> = {
  created: "text-emerald-500",
  completed: "text-emerald-500",
  deleted: "text-red-400",
  cancelled: "text-amber-400",
  failed: "text-red-500",
  went_offline: "text-amber-500",
};

export function ActivityPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = themeStyles(isDark);

  const [page, setPage] = useState(0);
  const [filterEntity, setFilterEntity] = useState<EntityType | "all">("all");

  const fetcher = useCallback(async () => {
    return listActivityLogs({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      entity_type: filterEntity === "all" ? undefined : filterEntity,
    });
  }, [page, filterEntity]);

  const { data, loading } = usePolling(fetcher, { logs: [], total: 0 } as ActivityLogResponse, 5000);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const handleFilterChange = (value: string) => {
    setFilterEntity(value as EntityType | "all");
    setPage(0);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className={`text-xl font-semibold ${s.heading}`}>Activity Log</h1>
        <span className={`text-[13px] ${s.muted}`}>{data.total} events</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterEntity}
          onChange={(e) => handleFilterChange(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-[14px] ${s.input}`}
        >
          <option value="all">All Types</option>
          <option value="task">Tasks</option>
          <option value="agent">Agents</option>
          <option value="secret">Secrets</option>
          <option value="mcp">MCP</option>
          <option value="git">Git</option>
          <option value="project">Projects</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Log List */}
      {loading && data.logs.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={22} className={`animate-spin ${s.spinner}`} />
        </div>
      ) : data.logs.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-2xl border py-20 ${s.card} ${s.muted}`}>
          <p className="text-[15px] mb-1">No activity yet</p>
          <p className={`text-[13px] ${s.muted}`}>Events will appear here as you use the app</p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${s.card}`}>
          <div className={`divide-y ${isDark ? "divide-[#2d2d3c]/40" : "divide-gray-100"}`}>
            {data.logs.map((log) => {
              const Icon = entityIcons[log.entity_type] || Monitor;
              const actionColor = actionColors[log.action] || s.label;
              return (
                <div key={log.id} className={`flex items-center gap-3.5 px-5 py-3 ${s.hover}`}>
                  <Icon size={15} className={s.muted} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[14px] font-medium ${actionColor}`}>{log.action}</span>
                      <span className={`text-[13px] ${s.label}`}>{log.entity_type}</span>
                      {log.entity_name && (
                        <span className={`text-[14px] truncate ${s.textSecondary}`}>{log.entity_name}</span>
                      )}
                    </div>
                    {log.details && (
                      <p className={`text-[13px] ${s.muted} truncate mt-0.5`}>{log.details}</p>
                    )}
                  </div>
                  <span className={`text-[12px] ${s.muted} whitespace-nowrap shrink-0`}>
                    {formatDate(log.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={`p-2 rounded-xl transition-all duration-150 disabled:opacity-30 ${s.hover}`}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} className={s.label} />
          </button>
          <span className={`text-[13px] ${s.muted}`}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className={`p-2 rounded-xl transition-all duration-150 disabled:opacity-30 ${s.hover}`}
            aria-label="Next page"
          >
            <ChevronRight size={18} className={s.label} />
          </button>
        </div>
      )}
    </div>
  );
}
