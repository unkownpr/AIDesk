import { useCallback, useMemo } from "react";
import { listTasks, listAgents } from "@/lib/tauri";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { statusColors, timeAgo } from "@/lib/utils";
import type { Task, Agent } from "@/lib/types";
import { CheckCircle, Clock, AlertCircle, Bot, ListTodo, Loader2, AlertTriangle } from "lucide-react";

export function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = themeStyles(isDark);

  const fetcher = useCallback(async () => {
    const [tasks, agents] = await Promise.all([listTasks(), listAgents()]);
    return { tasks, agents };
  }, []);

  const { data, loading } = usePolling(fetcher, { tasks: [] as Task[], agents: [] as Agent[] }, 3000);

  const stats = useMemo(() => ({
    total: data.tasks.length,
    running: data.tasks.filter((t) => t.status === "running").length,
    completed: data.tasks.filter((t) => t.status === "completed").length,
    failed: data.tasks.filter((t) => t.status === "failed").length,
    pending: data.tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
    agentsOnline: data.agents.filter((a) => a.status === "online" || a.status === "busy").length,
    agentsTotal: data.agents.length,
    offlineAgents: data.agents.filter((a) => a.agent_type === "remote" && a.status === "offline"),
  }), [data]);

  return (
    <div className="space-y-6">
      <h1 className={`text-lg font-semibold ${s.heading}`}>Dashboard</h1>

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={20} className={`animate-spin ${s.spinner}`} />
        </div>
      )}

      {!loading && (<>
      <div className="grid grid-cols-5 gap-3">
        <StatCard title="Total Tasks" value={stats.total} icon={<ListTodo size={16} className={s.muted} />} isDark={isDark} />
        <StatCard title="Running" value={stats.running} icon={<Loader2 size={16} className={`animate-spin ${s.accent}`} />} accent={s.accent} isDark={isDark} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCircle size={16} className="text-emerald-500" />} accent="text-emerald-500" isDark={isDark} />
        <StatCard title="Failed" value={stats.failed} icon={<AlertCircle size={16} className="text-red-500" />} accent="text-red-500" isDark={isDark} />
        <StatCard title="Agents" value={`${stats.agentsOnline}/${stats.agentsTotal}`} icon={<Bot size={16} className="text-blue-500" />} accent="text-blue-500" isDark={isDark} />
      </div>

      {stats.offlineAgents.length > 0 && (
        <div className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 ${isDark ? "border-amber-500/30 bg-amber-500/5" : "border-amber-300 bg-amber-50"}`}>
          <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className={`text-[13px] font-medium ${isDark ? "text-amber-400" : "text-amber-700"}`}>
              {stats.offlineAgents.length} agent{stats.offlineAgents.length > 1 ? "s" : ""} offline
            </span>
            <span className={`text-[12px] ml-2 ${s.muted}`}>
              {stats.offlineAgents.map((a) => `${a.name} (${timeAgo(a.last_heartbeat)})`).join(", ")}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-lg border p-4 ${isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm"}`}>
          <h2 className={`mb-3 text-[11px] font-medium uppercase tracking-wider ${s.muted}`}>Recent Tasks</h2>
          {data.tasks.length === 0 ? (
            <p className={`py-6 text-center text-sm ${s.muted}`}>No tasks yet</p>
          ) : (
            <div className="space-y-1">
              {data.tasks.slice(0, 8).map((task) => (
                <div key={task.id} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${s.hover}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={task.status} accent={s.accent} />
                    <span className={`truncate text-sm ${s.textSecondary}`}>{task.title}</span>
                  </div>
                  <Badge className={statusColors[task.status]}>{task.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-lg border p-4 ${isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm"}`}>
          <h2 className={`mb-3 text-[11px] font-medium uppercase tracking-wider ${s.muted}`}>Agents</h2>
          {data.agents.length === 0 ? (
            <p className={`py-6 text-center text-sm ${s.muted}`}>No agents configured</p>
          ) : (
            <div className="space-y-1">
              {data.agents.map((agent) => (
                <div key={agent.id} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${s.hover}`}>
                  <div className="flex items-center gap-2">
                    <Bot size={14} className={s.muted} />
                    <span className={`text-sm ${s.textSecondary}`}>{agent.name}</span>
                    <span className={`text-[11px] ${s.muted}`}>{agent.agent_type}</span>
                  </div>
                  <Badge className={statusColors[agent.status]}>{agent.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}

function StatCard({ title, value, icon, accent, isDark }: {
  title: string; value: number | string; icon: React.ReactNode; accent?: string; isDark: boolean;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{title}</span>
        {icon}
      </div>
      <p className={`mt-1.5 text-xl font-semibold ${accent || (isDark ? "text-zinc-200" : "text-zinc-800")}`}>{value}</p>
    </div>
  );
}

function StatusIcon({ status, accent }: { status: string; accent: string }) {
  switch (status) {
    case "completed": return <CheckCircle size={13} className="text-emerald-500" />;
    case "running": return <Loader2 size={13} className={`animate-spin ${accent}`} />;
    case "failed": return <AlertCircle size={13} className="text-red-500" />;
    default: return <Clock size={13} className="text-zinc-400" />;
  }
}
