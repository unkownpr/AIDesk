import { useCallback, useMemo } from "react";
import { listTasks, listAgents, listProjects } from "@/lib/tauri";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { statusColors, timeAgo } from "@/lib/utils";
import type { Task, Agent, Project, Page } from "@/lib/types";
import {
  CheckCircle, Clock, AlertCircle, Bot, Loader2, AlertTriangle,
  FolderKanban, ArrowRight, Plus, Zap,
} from "lucide-react";

export function DashboardPage({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = themeStyles(isDark);

  const fetcher = useCallback(async () => {
    const [tasks, agents, projects] = await Promise.all([listTasks(), listAgents(), listProjects()]);
    return { tasks, agents, projects };
  }, []);

  const { data, loading } = usePolling(fetcher, { tasks: [] as Task[], agents: [] as Agent[], projects: [] as Project[] }, 3000);

  const stats = useMemo(() => ({
    running: data.tasks.filter((t) => t.status === "running").length,
    completed: data.tasks.filter((t) => t.status === "completed").length,
    failed: data.tasks.filter((t) => t.status === "failed").length,
    pending: data.tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
    agentsOnline: data.agents.filter((a) => a.status === "online" || a.status === "busy").length,
    agentsTotal: data.agents.length,
    offlineAgents: data.agents.filter((a) => a.agent_type === "remote" && a.status === "offline"),
  }), [data]);

  const nav = (page: Page) => onNavigate?.(page);

  const needsSetup = data.projects.length === 0 || data.agents.length === 0;

  if (loading && data.tasks.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 size={22} className={`animate-spin ${s.spinner}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className={`text-xl font-semibold ${s.heading}`}>Dashboard</h1>

      {/* Onboarding */}
      {needsSetup && (
        <div className={`rounded-2xl border p-6 ${s.card}`}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <Zap size={16} className="text-emerald-500" />
            </div>
            <h2 className={`text-[15px] font-semibold ${s.heading}`}>Get started</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <OnboardingStep
              step={1}
              title="Add a project"
              desc="Select a folder on your computer"
              done={data.projects.length > 0}
              action={() => nav("projects")}
              isDark={isDark}
            />
            <OnboardingStep
              step={2}
              title="Create an agent"
              desc="An AI that will do the work for you"
              done={data.agents.length > 0}
              action={() => nav("agents")}
              isDark={isDark}
            />
            <OnboardingStep
              step={3}
              title="Send a task"
              desc="Tell the agent what to do"
              done={data.tasks.length > 0}
              action={() => nav("projects")}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard title="Pending" value={stats.pending} icon={<Clock size={16} />} color="text-amber-400" isDark={isDark} />
        <StatCard title="Running" value={stats.running} icon={<Loader2 size={16} className="animate-spin" />} color="text-indigo-400" isDark={isDark} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCircle size={16} />} color="text-emerald-500" isDark={isDark} />
        <StatCard title="Failed" value={stats.failed} icon={<AlertCircle size={16} />} color="text-red-500" isDark={isDark} />
        <StatCard title="Agents" value={`${stats.agentsOnline}/${stats.agentsTotal}`} icon={<Bot size={16} />} color="text-blue-400" isDark={isDark} />
      </div>

      {/* Offline agents warning */}
      {stats.offlineAgents.length > 0 && (
        <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 ${isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50"}`}>
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span className={`text-[14px] ${isDark ? "text-amber-400" : "text-amber-700"}`}>
            {stats.offlineAgents.length} agent{stats.offlineAgents.length > 1 ? "s" : ""} offline:
            <span className={`ml-1 font-normal ${s.muted}`}>
              {stats.offlineAgents.map((a) => a.name).join(", ")}
            </span>
          </span>
        </div>
      )}

      {/* Projects with activity */}
      {data.projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className={s.sectionTitle}>Projects</h2>
            <button onClick={() => nav("projects")} className={`text-[13px] font-medium ${s.accent} ${s.accentHover} flex items-center gap-1`}>
              All projects <ArrowRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {data.projects.slice(0, 6).map((project) => {
              const projectTasks = data.tasks.filter((t) => t.project_id === project.id);
              const activeCount = projectTasks.filter((t) => ["pending", "assigned", "running"].includes(t.status)).length;
              const doneCount = projectTasks.filter((t) => t.status === "completed").length;
              return (
                <button key={project.id} onClick={() => nav("projects")}
                  className={`text-left rounded-xl border p-4 transition-all duration-150 ${s.cardHover}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                      <FolderKanban size={14} className="text-emerald-500" />
                    </div>
                    <span className={`text-[14px] font-medium ${s.heading} truncate`}>{project.name}</span>
                  </div>
                  <div className={`flex items-center gap-3 text-[12px] ${s.muted}`}>
                    {activeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin text-indigo-400" />
                        {activeCount} active
                      </span>
                    )}
                    <span>{doneCount} done</span>
                    <span>{projectTasks.length} total</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Tasks & Agents */}
      <div className="grid grid-cols-2 gap-5">
        <div className={`rounded-2xl border p-5 ${s.card}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={s.sectionTitle}>Recent Tasks</h2>
            <button onClick={() => nav("tasks")} className={`text-[13px] font-medium ${s.accent} ${s.accentHover}`}>View all</button>
          </div>
          {data.tasks.length === 0 ? (
            <div className="py-8 text-center">
              <Clock size={24} className={`mx-auto mb-2 ${s.muted}`} />
              <p className={`text-[13px] ${s.muted} mb-1`}>No tasks yet</p>
              <p className={`text-[12px] ${s.muted}`}>Open a project and send your first task</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.tasks.slice(0, 8).map((task) => (
                <div key={task.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.hover}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusIcon status={task.status} />
                    <span className={`truncate text-[14px] ${s.textSecondary}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Badge className={statusColors[task.status]}>{task.status}</Badge>
                    <span className={`text-[12px] ${s.muted}`}>{timeAgo(task.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-5 ${s.card}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={s.sectionTitle}>Agents</h2>
            <button onClick={() => nav("agents")} className={`text-[13px] font-medium ${s.accent} ${s.accentHover}`}>Manage</button>
          </div>
          {data.agents.length === 0 ? (
            <div className="py-8 text-center">
              <Bot size={24} className={`mx-auto mb-2 ${s.muted}`} />
              <p className={`text-[13px] ${s.muted} mb-1`}>No agents yet</p>
              <p className={`text-[12px] ${s.muted} mb-3`}>Create an AI agent to start working</p>
              <button onClick={() => nav("agents")}
                className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${s.accent} ${s.accentHover}`}>
                <Plus size={14} /> Create agent
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {data.agents.map((agent) => (
                <div key={agent.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.hover}`}>
                  <div className="flex items-center gap-2.5">
                    <Bot size={15} className={s.muted} />
                    <span className={`text-[14px] ${s.textSecondary}`}>{agent.name}</span>
                    <span className={`text-[12px] ${s.muted}`}>{agent.model}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge className={statusColors[agent.status]}>{agent.status}</Badge>
                    <span className={`text-[12px] ${s.muted}`}>{timeAgo(agent.last_heartbeat)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, isDark }: {
  title: string; value: number | string; icon: React.ReactNode; color: string; isDark: boolean;
}) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${isDark ? "bg-[#14141b] border-[#2d2d3c]/60 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" : "bg-white border-gray-200 shadow-sm"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[12px] font-semibold uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>{title}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-semibold ${isDark ? "text-gray-100" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle size={15} className="text-emerald-500" />;
    case "running": return <Loader2 size={15} className="animate-spin text-indigo-400" />;
    case "failed": return <AlertCircle size={15} className="text-red-500" />;
    default: return <Clock size={15} className="text-gray-400" />;
  }
}

function OnboardingStep({ step, title, desc, done, action, isDark }: {
  step: number; title: string; desc: string; done: boolean; action: () => void; isDark: boolean;
}) {
  return (
    <button onClick={action} disabled={done}
      className={`text-left rounded-xl border p-4 transition-all duration-150 ${
        done
          ? isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50"
          : isDark ? "border-[#2d2d3c]/60 bg-[#14141b] hover:border-emerald-500/30 hover:shadow-[0_2px_8px_rgba(16,185,129,0.08)]" : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md"
      }`}>
      <div className="flex items-center gap-2.5 mb-1.5">
        {done
          ? <CheckCircle size={16} className="text-emerald-500" />
          : <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              isDark ? "bg-[#1e1e28] text-gray-400" : "bg-gray-100 text-gray-500"
            }`}>{step}</span>
        }
        <span className={`text-[14px] font-medium ${done ? "text-emerald-500" : isDark ? "text-gray-200" : "text-gray-800"}`}>{title}</span>
      </div>
      <p className={`text-[13px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{desc}</p>
    </button>
  );
}
