import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban, Plus, Trash2, FolderOpen, Pencil, Save, X,
  ArrowLeft, Send, ChevronDown, ChevronRight, Loader2, Ban, RotateCcw, Brain,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { useConfirm } from "@/hooks/useConfirm";
import { useTheme } from "@/hooks/useTheme";
import { usePolling } from "@/hooks/usePolling";
import { useTaskLogStream } from "@/hooks/useTaskLogStream";
import { themeStyles } from "@/lib/theme";
import { statusColors, priorityColors, formatDate, timeAgo } from "@/lib/utils";
import type { Project, Task, Agent } from "@/lib/types";
import {
  listProjects, createProject, updateProject, deleteProject, getProject,
  listTasksByProject, listAgents, listTasks, createTask, cancelTask, deleteTask, retryTask,
  pickDirectory,
} from "@/lib/tauri";

function useStyles() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const base = themeStyles(isDark);
  return { ...base, isDark };
}

export function ProjectsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (selectedProjectId) {
    return <ProjectDetail projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />;
  }

  return <ProjectList onSelect={setSelectedProjectId} />;
}

// ============= PROJECT LIST =============

function ProjectList({ onSelect }: { onSelect: (id: string) => void }) {
  const s = useStyles();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([listProjects(), listTasks()]);
      setProjects(p);
      setTasks(t);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setPath(dir);
  };

  const handleCreate = async () => {
    if (!name.trim() || !path.trim()) return;
    setSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        path: path.trim(),
        description: description.trim() || undefined,
      });
      setName(""); setPath(""); setDescription("");
      setShowForm(false);
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete Project",
      message: "This project and its task links will be removed. Are you sure?",
    });
    if (!ok) return;
    try { await deleteProject(id); await load(); } catch (e) { alert(String(e)); }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className={`text-xl font-semibold ${s.heading}`}>Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-medium text-white transition-all duration-150 ${s.accentBtn}`}
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />

      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-[15px] font-semibold ${s.heading}`}>New Project</h3>
            <button onClick={() => setShowForm(false)} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`}><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
            <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
          </div>
          <div className="flex gap-3">
            <input value={path} readOnly placeholder="Select project directory..."
              className={`flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-mono ${s.focus} ${s.input}`} />
            <button onClick={handlePickDir}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] transition-all duration-150 ${
                s.isDark ? "border-[#2d2d3c]/60 bg-[#14141b] text-gray-400 hover:text-gray-200 hover:border-gray-600" : "border-gray-300 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-400"
              }`}>
              <FolderOpen size={16} /> Browse
            </button>
          </div>
          <button onClick={handleCreate} disabled={submitting || !name.trim() || !path.trim()}
            className={`rounded-xl px-5 py-2 text-[14px] font-medium disabled:opacity-40 transition-all duration-150 ${s.accentBtn}`}>
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-2xl border py-20 ${s.card} ${s.muted}`}>
          <FolderKanban size={40} className="mb-3 opacity-20" />
          <p className="text-[15px] mb-1">No projects yet</p>
          <p className={`text-[13px] mb-3 ${s.muted}`}>Add a project folder to start sending tasks to AI agents</p>
          <button onClick={() => setShowForm(true)} className={`text-[14px] font-medium ${s.accent} ${s.accentHover}`}>+ Add your first project</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((p) => {
            const pTasks = tasks.filter((t) => t.project_id === p.id);
            const activeCount = pTasks.filter((t) => ["pending", "assigned", "running"].includes(t.status)).length;
            const doneCount = pTasks.filter((t) => t.status === "completed").length;
            return (
              <button key={p.id} onClick={() => onSelect(p.id)}
                className={`text-left rounded-xl border p-5 transition-all duration-150 ${s.cardHover}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
                      <FolderKanban size={16} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-[15px] font-medium ${s.heading} truncate`}>{p.name}</h3>
                      {p.description && <p className={`text-[13px] ${s.muted} truncate`}>{p.description}</p>}
                    </div>
                  </div>
                  <button onClick={(e) => handleDelete(e, p.id)} className={`p-1.5 rounded-lg ${s.muted} hover:text-red-400 hover:bg-red-500/5 shrink-0`}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className={`flex items-center justify-between mt-3`}>
                  <span className={`text-[12px] font-mono ${s.muted} truncate max-w-[220px]`} title={p.path}>{p.path}</span>
                  <div className={`flex items-center gap-3 text-[12px] ${s.muted}`}>
                    {activeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Loader2 size={11} className="animate-spin text-indigo-400" />
                        {activeCount}
                      </span>
                    )}
                    {doneCount > 0 && (
                      <span className="text-emerald-500">{doneCount} done</span>
                    )}
                    {pTasks.length === 0 && <span>No tasks</span>}
                    {p.analysis_updated_at && (
                      <span className="flex items-center gap-1">
                        <Brain size={11} className="text-emerald-500/60" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= PROJECT DETAIL =============

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const s = useStyles();
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const fetcher = useCallback(async () => {
    const [project, tasks, agents] = await Promise.all([
      getProject(projectId),
      listTasksByProject(projectId),
      listAgents(),
    ]);
    return { project, tasks, agents };
  }, [projectId]);

  const { data, loading, refresh } = usePolling(fetcher, {
    project: null as Project | null,
    tasks: [] as Task[],
    agents: [] as Agent[],
  }, 3000);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", path: "", description: "" });

  const expandedTaskData = data.tasks.find((t) => t.id === expandedTask);
  const expandedTaskActive = expandedTaskData ? ["pending", "assigned", "running"].includes(expandedTaskData.status) : false;
  const streamedLogs = useTaskLogStream(expandedTask, expandedTaskActive);

  const handleCreateTask = async () => {
    if (!taskDesc.trim() || submitting) return;
    const title = taskTitle.trim() || taskDesc.trim().split("\n")[0].slice(0, 80);
    setSubmitting(true);
    try {
      await createTask({
        title,
        description: taskDesc.trim(),
        priority: taskPriority,
        project_id: projectId,
      });
      setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium");
      refresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const ok = await confirm({ title: "Delete Task", message: "This task and its logs will be removed." });
    if (!ok) return;
    await deleteTask(id); refresh();
  };

  const handleCancelTask = async (id: string) => {
    const ok = await confirm({ title: "Cancel Task", message: "Cancel this running task?", confirmLabel: "Cancel Task", variant: "warning" });
    if (!ok) return;
    try { await cancelTask(id); refresh(); } catch (e) { alert(String(e)); }
  };

  const handleRetryTask = async (id: string) => {
    try { await retryTask(id); refresh(); } catch (e) { alert(String(e)); }
  };

  const startEdit = () => {
    if (!data.project) return;
    setEditForm({ name: data.project.name, path: data.project.path, description: data.project.description || "" });
    setEditing(true);
  };

  const handleEditSave = async () => {
    if (!editForm.name.trim() || !editForm.path.trim()) return;
    try {
      await updateProject({
        id: projectId,
        name: editForm.name.trim(),
        path: editForm.path.trim(),
        description: editForm.description.trim() || undefined,
      });
      setEditing(false);
      refresh();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleEditPickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setEditForm((f) => ({ ...f, path: dir }));
  };

  const isActive = (status: string) => ["pending", "assigned", "running"].includes(status);

  if (loading && !data.project) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 size={22} className={`animate-spin ${s.spinner}`} />
      </div>
    );
  }

  const project = data.project;
  if (!project) return null;

  const activeTasks = data.tasks.filter((t) => isActive(t.status)).length;
  const completedTasks = data.tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-5 max-w-6xl">
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className={`p-2 rounded-xl ${s.muted} hover:text-emerald-500 hover:bg-emerald-500/5 transition-all duration-150`}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <FolderKanban size={16} className="text-emerald-500" />
            </div>
            <h1 className={`text-xl font-semibold ${s.heading} truncate`}>{project.name}</h1>
            <button onClick={startEdit} className={`p-1.5 rounded-lg ${s.muted} hover:text-emerald-500 hover:bg-emerald-500/5`}><Pencil size={14} /></button>
          </div>
          <div className={`flex items-center gap-3 mt-1 text-[13px] ${s.muted}`}>
            <span className="font-mono truncate max-w-[320px]" title={project.path}>{project.path}</span>
            {project.git_branch && <span>{project.git_branch}</span>}
            {project.analysis_updated_at && (
              <span className="flex items-center gap-1">
                <Brain size={12} className="text-emerald-500/60" />
                Analysis: {timeAgo(project.analysis_updated_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-[13px]">
          <div className={`text-center ${s.muted}`}>
            <span className={`block text-xl font-semibold ${s.heading}`}>{activeTasks}</span>
            active
          </div>
          <div className={`text-center ${s.muted}`}>
            <span className={`block text-xl font-semibold ${s.heading}`}>{completedTasks}</span>
            done
          </div>
        </div>
      </div>

      {/* Edit Form (inline) */}
      {editing && (
        <div className={`rounded-2xl border p-5 space-y-3 ${s.card}`}>
          <div className="flex items-center justify-between">
            <span className={s.sectionTitle}>Edit Project</span>
            <button onClick={() => setEditing(false)} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="Name" className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
            <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Description" className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
          </div>
          <div className="flex gap-3">
            <input value={editForm.path} readOnly className={`flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-mono ${s.focus} ${s.input}`} />
            <button onClick={handleEditPickDir}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] ${
                s.isDark ? "border-[#2d2d3c]/60 text-gray-400 hover:text-gray-200" : "border-gray-300 text-gray-500 hover:text-gray-700"
              }`}>
              <FolderOpen size={14} />
            </button>
          </div>
          <button onClick={handleEditSave} disabled={!editForm.name.trim() || !editForm.path.trim()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-medium disabled:opacity-40 transition-all duration-150 ${s.accentBtn}`}>
            <Save size={14} /> Save
          </button>
        </div>
      )}

      {/* Quick Task Form */}
      <div className={`rounded-2xl border p-5 ${s.card}`}>
        <textarea placeholder="Describe what the AI agent should do... (e.g., 'Fix the login bug' or 'Add a dark mode toggle')" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)}
          rows={3} className={`w-full rounded-xl border px-4 py-3 text-[14px] resize-none ${s.focus} ${s.input}`}
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey && taskDesc.trim()) handleCreateTask(); }}
        />
        <div className="flex items-center gap-3 mt-3">
          <input placeholder="Title (optional, auto-generated)" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
            className={`flex-1 rounded-xl border px-4 py-2 text-[13px] ${s.focus} ${s.input}`} />
          <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
            className={`rounded-xl border px-3 py-2 text-[13px] ${s.input}`}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button onClick={handleCreateTask} disabled={!taskDesc.trim() || submitting}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-[14px] font-medium disabled:opacity-40 transition-all duration-150 ${s.accentBtn}`}>
            <Send size={14} />
            {submitting ? "Sending..." : "Send"}
          </button>
          <span className={`text-[12px] ${s.muted}`}>Cmd+Enter</span>
        </div>
      </div>

      {/* Analysis Preview */}
      {project.analysis && (
        <details className={`rounded-2xl border ${s.card}`}>
          <summary className={`px-5 py-3 cursor-pointer text-[13px] font-medium ${s.muted} hover:text-emerald-500 flex items-center gap-2`}>
            <Brain size={15} className="text-emerald-500/60" />
            Project Analysis
            <span className={`text-[12px] ${s.muted}`}>({timeAgo(project.analysis_updated_at)})</span>
          </summary>
          <div className={`px-5 pb-4 border-t ${s.border}`}>
            <pre className={`whitespace-pre-wrap text-[13px] ${s.textSecondary} leading-relaxed max-h-52 overflow-y-auto mt-3`}>
              {project.analysis}
            </pre>
          </div>
        </details>
      )}

      {/* Task List */}
      <div>
        <h2 className={`${s.sectionTitle} mb-3`}>
          Tasks ({data.tasks.length})
        </h2>
        {data.tasks.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${s.card}`}>
            <p className={`text-[14px] ${s.muted}`}>No tasks yet. Describe what you need above and click Send.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.tasks.map((task) => {
              const logs = expandedTask === task.id ? streamedLogs : [];
              const agentName = data.agents.find((a) => a.id === task.assigned_agent_id)?.name;
              const active = isActive(task.status);
              return (
                <div key={task.id} className={`rounded-xl border overflow-hidden ${
                  active
                    ? s.isDark ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-emerald-200 bg-emerald-50/30"
                    : s.card
                }`}>
                  <button
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${s.hover}`}
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  >
                    {expandedTask === task.id ? <ChevronDown size={15} className={s.muted} /> : <ChevronRight size={15} className={s.muted} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`truncate text-[14px] font-medium ${s.heading}`}>{task.title}</span>
                        <span className={`text-[12px] ${priorityColors[task.priority]}`}>{task.priority}</span>
                        {active && <Loader2 size={13} className={`animate-spin ${s.accent}`} />}
                      </div>
                      <p className={`truncate text-[13px] ${s.muted} mt-0.5`}>{task.description}</p>
                    </div>
                    <Badge className={statusColors[task.status]}>{task.status}</Badge>
                    <span className={`text-[12px] ${s.muted} whitespace-nowrap`}>{formatDate(task.created_at)}</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {task.status === "failed" && (
                        <button onClick={() => handleRetryTask(task.id)} className={`p-1 rounded-lg ${s.isDark ? "text-gray-600" : "text-gray-400"} hover:text-amber-500 hover:bg-amber-500/5 transition-all`} title="Retry">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {active && (
                        <button onClick={() => handleCancelTask(task.id)} className={`p-1 rounded-lg ${s.hoverDelete} hover:bg-red-500/5 transition-all`} title="Cancel">
                          <Ban size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteTask(task.id)} className={`p-1 rounded-lg ${s.hoverDelete} hover:bg-red-500/5 transition-all`} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>

                  {expandedTask === task.id && (
                    <div className={`border-t px-5 py-4 space-y-3 ${s.border}`}>
                      <div className={`flex gap-6 text-[13px] ${s.muted}`}>
                        <span>Agent: {agentName || "Unassigned"}</span>
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
                                    : s.isDark ? "bg-[#1e1e28] text-gray-500 border-[#2d2d3c]" : "bg-gray-100 text-gray-500 border-gray-200"
                                }>
                                  {log.log_type}
                                </Badge>
                                <span className={`flex-1 ${log.log_type === "error" ? "text-red-500" : s.label}`}>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
