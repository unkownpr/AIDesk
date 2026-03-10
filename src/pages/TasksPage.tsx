import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { listTasks, listAgents, listProjects, getQueueInfo, createTask, deleteTask, cancelTask, retryTask } from "@/lib/tauri";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { statusColors, priorityColors, formatDate } from "@/lib/utils";
import type { Task, Agent, Project, QueueInfo, TaskStatus, Priority } from "@/lib/types";
import { Plus, Trash2, ChevronDown, ChevronRight, X, Loader2, Ban, Search, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { useTaskLogStream } from "@/hooks/useTaskLogStream";

export function TasksPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = themeStyles(isDark);

  const fetcher = useCallback(async () => {
    const [tasks, agents, projects, queueInfo] = await Promise.all([listTasks(), listAgents(), listProjects(), getQueueInfo()]);
    return { tasks, agents, projects, queueInfo };
  }, []);

  const { data, loading, refresh } = usePolling(fetcher, { tasks: [] as Task[], agents: [] as Agent[], projects: [] as Project[], queueInfo: { positions: {}, running_per_agent: {} } as QueueInfo }, 3000);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", project_id: "", max_retries: 0, assigned_agent_id: "",
  });
  const logEndRef = useRef<HTMLDivElement>(null);

  const expandedTaskData = data.tasks.find((t) => t.id === expandedTask);
  const expandedTaskActive = expandedTaskData ? ["pending", "assigned", "running"].includes(expandedTaskData.status) : false;
  const streamedLogs = useTaskLogStream(expandedTask, expandedTaskActive);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterAgent !== "all" && task.assigned_agent_id !== filterAgent) return false;
      if (filterProject !== "all" && task.project_id !== filterProject) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data.tasks, filterStatus, filterPriority, filterAgent, filterProject, searchQuery]);

  const hasActiveFilters = filterStatus !== "all" || filterPriority !== "all" || filterAgent !== "all" || filterProject !== "all" || searchQuery.trim() !== "";

  useEffect(() => {
    if (expandedTask && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [expandedTask, streamedLogs]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.project_id || submitting) return;
    setSubmitting(true);
    try {
      await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        project_id: form.project_id,
        max_retries: form.max_retries || undefined,
        assigned_agent_id: form.assigned_agent_id || undefined,
      });
      setForm({ title: "", description: "", priority: "medium", project_id: "", max_retries: 0, assigned_agent_id: "" });
      setShowForm(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Task", message: "This task and its logs will be permanently removed. Are you sure?" });
    if (!ok) return;
    await deleteTask(id);
    refresh();
  };

  const handleCancel = async (id: string) => {
    const ok = await confirm({ title: "Cancel Task", message: "This will cancel the running task. Are you sure?", confirmLabel: "Cancel Task", variant: "warning" });
    if (!ok) return;
    try { await cancelTask(id); refresh(); } catch (e) { alert(String(e)); }
  };

  const handleRetry = async (id: string) => {
    try { await retryTask(id); refresh(); } catch (e) { alert(String(e)); }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterAgent("all");
    setFilterProject("all");
  };

  const toggleLogs = (taskId: string) => setExpandedTask(expandedTask === taskId ? null : taskId);
  const isActive = (status: string) => ["pending", "assigned", "running"].includes(status);

  return (
    <div className="space-y-5 max-w-6xl">
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />
      <div className="flex items-center justify-between">
        <h1 className={`text-xl font-semibold ${s.heading}`}>Tasks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-medium text-white transition-all duration-150 ${s.accentBtn}`}
        >
          <Plus size={16} />
          New Task
        </button>
      </div>

      {/* Filter Bar */}
      <div className={`flex items-center gap-3 flex-wrap`}>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${s.muted}`} />
          <input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl border pl-9 pr-4 py-2 text-[14px] ${s.focus} ${s.input}`}
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")}
          className={`rounded-xl border px-3 py-2 text-[14px] ${s.input}`}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
          className={`rounded-xl border px-3 py-2 text-[14px] ${s.input}`}>
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-[14px] ${s.input}`}>
          <option value="all">All Projects</option>
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-[14px] ${s.input}`}>
          <option value="all">All Agents</option>
          {data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-150 ${s.hoverDelete}`}
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-[15px] font-semibold ${s.heading}`}>New Task</h3>
            <button onClick={() => setShowForm(false)} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`} aria-label="Close form"><X size={18} /></button>
          </div>
          <input
            placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Task title"
            className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
          />
          <textarea
            placeholder="Describe what the AI should do... (e.g., 'Add a search feature to the homepage')" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} aria-label="Task description"
            className={`w-full rounded-xl border px-4 py-2.5 text-[14px] resize-none ${s.focus} ${s.input}`}
          />
          <div className="grid grid-cols-4 gap-3">
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} aria-label="Project" className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value="">Select project...</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} aria-label="Priority" className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select value={form.max_retries} onChange={(e) => setForm({ ...form, max_retries: parseInt(e.target.value) })} aria-label="Max retries" className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value={0}>No retry</option>
              <option value={1}>1 retry</option>
              <option value={2}>2 retries</option>
              <option value={3}>3 retries</option>
            </select>
            <select value={form.assigned_agent_id} onChange={(e) => setForm({ ...form, assigned_agent_id: e.target.value })} aria-label="Assign agent" className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value="">Auto-assign</option>
              {data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {!form.project_id && (
            <p className={`text-[13px] text-amber-500`}>Please select a project first — every task needs a project</p>
          )}
          <button onClick={handleCreate} disabled={!form.title.trim() || !form.description.trim() || !form.project_id || submitting}
            className={`rounded-xl px-5 py-2 text-[14px] font-medium disabled:opacity-40 transition-all duration-150 ${s.accentBtn}`}>
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 size={22} className={`animate-spin ${s.spinner}`} /></div>
        ) : filteredTasks.length === 0 ? (
          <div className={`flex flex-col items-center justify-center rounded-2xl border py-20 ${s.card} ${s.muted}`}>
            <p className="text-[15px]">{hasActiveFilters ? "No tasks match your filters" : "No tasks yet"}</p>
            {!hasActiveFilters && <p className={`text-[13px] mt-1 ${s.muted}`}>Go to a project and send your first task</p>}
            {hasActiveFilters && (
              <button onClick={clearFilters} className={`mt-2 text-[13px] font-medium ${s.accent} hover:underline`}>Clear filters</button>
            )}
          </div>
        ) : (
          <>
            {hasActiveFilters && (
              <p className={`text-[13px] ${s.muted}`}>
                Showing {filteredTasks.length} of {data.tasks.length} tasks
              </p>
            )}
            {filteredTasks.map((task) => {
              const logs = expandedTask === task.id ? streamedLogs : [];
              const agentName = data.agents.find((a) => a.id === task.assigned_agent_id)?.name;
              const projectName = data.projects.find((p) => p.id === task.project_id)?.name;
              const active = isActive(task.status);
              return (
                <div key={task.id} className={`rounded-xl border overflow-hidden ${
                  active
                    ? isDark ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-emerald-200 bg-emerald-50/30"
                    : s.card
                }`}>
                  <button
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${s.hover}`}
                    onClick={() => toggleLogs(task.id)}
                    aria-expanded={expandedTask === task.id}
                  >
                    {expandedTask === task.id ? <ChevronDown size={15} className={s.muted} /> : <ChevronRight size={15} className={s.muted} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`truncate text-[14px] font-medium ${s.heading}`}>{task.title}</span>
                        {projectName && (
                          <span className={`text-[12px] px-2 py-0.5 rounded-lg ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                            {projectName}
                          </span>
                        )}
                        <span className={`text-[12px] ${priorityColors[task.priority]}`}>{task.priority}</span>
                        {task.status === "pending" && data.queueInfo.positions[task.id] && (
                          <span className={`text-[12px] px-2 py-0.5 rounded-lg ${isDark ? "bg-[#1e1e28] text-gray-500" : "bg-gray-100 text-gray-500"}`}>
                            #{data.queueInfo.positions[task.id]} in queue
                          </span>
                        )}
                        {task.retry_count > 0 && (
                          <span className={`text-[12px] px-2 py-0.5 rounded-lg ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                            retry {task.retry_count}/{task.max_retries}
                          </span>
                        )}
                        {active && <Loader2 size={13} className={`animate-spin ${s.accent}`} />}
                      </div>
                      <p className={`truncate text-[13px] ${s.muted} mt-0.5`}>{task.description}</p>
                    </div>
                    <Badge className={statusColors[task.status]}>{task.status}</Badge>
                    <span className={`text-[12px] ${s.muted} whitespace-nowrap`}>{formatDate(task.created_at)}</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {task.status === "failed" && (
                        <button onClick={() => handleRetry(task.id)} className={`p-1 rounded-lg ${isDark ? "text-gray-600" : "text-gray-400"} hover:text-amber-500 hover:bg-amber-500/5 transition-all`} aria-label="Retry task" title="Retry task">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {isActive(task.status) && (
                        <button onClick={() => handleCancel(task.id)} className={`p-1 rounded-lg ${s.hoverDelete} hover:bg-red-500/5 transition-all`} aria-label="Cancel task" title="Cancel task">
                          <Ban size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(task.id)} className={`p-1 rounded-lg ${s.hoverDelete} hover:bg-red-500/5 transition-all`} aria-label="Delete task" title="Delete task">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>

                  {expandedTask === task.id && (
                    <div className={`border-t px-5 py-4 space-y-3 ${s.border}`}>
                      <div className={`flex gap-6 text-[13px] ${s.muted}`}>
                        {projectName && <span>Project: <span className={s.accent}>{projectName}</span></span>}
                        <span>Agent: {agentName || (task.assigned_agent_id ? task.assigned_agent_id.slice(0, 8) + "..." : "Unassigned")}</span>
                        {task.git_repo && <span>Repo: {task.git_repo}</span>}
                        {task.git_branch && <span>Branch: {task.git_branch}</span>}
                        {task.started_at && <span>Started: {formatDate(task.started_at)}</span>}
                        {task.completed_at && <span>Ended: {formatDate(task.completed_at)}</span>}
                      </div>
                      {task.result && (
                        <div className={`rounded-xl p-4 ${s.row}`}>
                          <p className="text-[12px] font-semibold text-emerald-500 mb-1.5">Result</p>
                          <pre className={`whitespace-pre-wrap text-[13px] ${s.textSecondary} leading-relaxed max-h-64 overflow-y-auto`}>{task.result}</pre>
                        </div>
                      )}
                      {task.error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                          <p className="text-[12px] font-semibold text-red-500 mb-1.5">Error</p>
                          <pre className="whitespace-pre-wrap text-[13px] text-red-400 max-h-32 overflow-y-auto">{task.error}</pre>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className={`text-[12px] font-medium ${s.muted}`}>Logs ({logs.length})</p>
                          {active && <span className={`flex items-center gap-1 text-[12px] ${s.accent}`}><Loader2 size={11} className="animate-spin" /> live</span>}
                        </div>
                        {logs.length === 0 ? (
                          <p className={`text-[13px] ${s.muted}`}>{active ? "Waiting for logs..." : "No logs"}</p>
                        ) : (
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {logs.map((log) => (
                              <div key={log.id} className="flex gap-2.5 text-[13px] py-1">
                                <span className={`${s.muted} whitespace-nowrap`}>{formatDate(log.created_at)}</span>
                                <Badge className={
                                  log.log_type === "error" || log.log_type === "stderr"
                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                    : log.log_type === "assistant"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : log.log_type === "result"
                                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                    : isDark ? "bg-[#1e1e28] text-gray-500 border-[#2d2d3c]" : "bg-gray-100 text-gray-500 border-gray-200"
                                }>
                                  {log.log_type}
                                </Badge>
                                <span className={`flex-1 ${log.log_type === "error" ? "text-red-500" : s.label}`}>{log.message}</span>
                              </div>
                            ))}
                            <div ref={logEndRef} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
