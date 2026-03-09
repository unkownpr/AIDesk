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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className={`text-lg font-semibold ${s.heading}`}>Activity Log</h1>
        <span className={`text-[12px] ${s.muted}`}>{data.total} events</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filterEntity}
          onChange={(e) => handleFilterChange(e.target.value)}
          className={`rounded-md border px-2.5 py-1.5 text-[13px] ${s.input}`}
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
          <Loader2 size={20} className={`animate-spin ${s.spinner}`} />
        </div>
      ) : data.logs.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-lg border py-16 ${s.card} ${s.muted}`}>
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className={`rounded-lg border overflow-hidden ${s.card}`}>
          <div className="divide-y divide-zinc-800/40">
            {data.logs.map((log) => {
              const Icon = entityIcons[log.entity_type] || Monitor;
              const actionColor = actionColors[log.action] || s.label;
              return (
                <div key={log.id} className={`flex items-center gap-3 px-4 py-2.5 ${s.hover}`}>
                  <Icon size={14} className={s.muted} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-medium ${actionColor}`}>{log.action}</span>
                      <span className={`text-[12px] ${s.label}`}>{log.entity_type}</span>
                      {log.entity_name && (
                        <span className={`text-[13px] truncate ${s.textSecondary}`}>{log.entity_name}</span>
                      )}
                    </div>
                    {log.details && (
                      <p className={`text-[11px] ${s.muted} truncate mt-0.5`}>{log.details}</p>
                    )}
                  </div>
                  <span className={`text-[11px] ${s.muted} whitespace-nowrap shrink-0`}>
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
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${s.hover}`}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} className={s.label} />
          </button>
          <span className={`text-[12px] ${s.muted}`}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${s.hover}`}
            aria-label="Next page"
          >
            <ChevronRight size={16} className={s.label} />
          </button>
        </div>
      )}
    </div>
  );
}
