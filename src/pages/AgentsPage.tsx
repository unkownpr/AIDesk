import { useCallback, useState, useRef, useEffect } from "react";
import { listAgents, createAgent, updateAgent, deleteAgent, pickDirectory, checkClaudeStatus } from "@/lib/tauri";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { statusColors, timeAgo } from "@/lib/utils";
import type { Agent, ClaudeStatus } from "@/lib/types";
import {
  Plus, Trash2, Copy, Check, X, Bot, Globe, Monitor, Loader2,
  FolderOpen, Info, CheckCircle, XCircle, AlertTriangle, Pencil, Save,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";

export function AgentsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = themeStyles(isDark);

  const fetcher = useCallback(() => listAgents(), []);
  const { data: agents, loading, refresh } = usePolling(fetcher, [] as Agent[], 5000);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [claude, setClaude] = useState<ClaudeStatus | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [form, setForm] = useState({
    name: "", agent_type: "local" as "local" | "remote",
    working_directory: "", model: "sonnet", max_turns: 50, max_concurrent_tasks: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", working_directory: "", model: "sonnet", max_turns: 50, max_concurrent_tasks: 1 });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  useEffect(() => {
    setClaudeLoading(true);
    checkClaudeStatus()
      .then(setClaude)
      .catch(() => setClaude({ installed: false, version: null, authenticated: false, auth_method: null }))
      .finally(() => setClaudeLoading(false));
  }, []);

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setForm((f) => ({ ...f, working_directory: dir }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || submitting) return;
    setFormError(null);

    if (form.agent_type === "local") {
      if (!form.working_directory) {
        setFormError("Select a working directory for this agent");
        return;
      }
      if (claude && !claude.installed) {
        setFormError("Claude CLI is not installed. Install it first.");
        return;
      }
      if (claude && !claude.authenticated) {
        setFormError("Claude CLI is not authenticated. Run: claude auth login");
        return;
      }
    }

    setSubmitting(true);
    try {
      await createAgent({
        name: form.name.trim(),
        agent_type: form.agent_type,
        working_directory: form.working_directory || undefined,
        model: form.model,
        max_turns: form.max_turns,
        max_concurrent_tasks: form.max_concurrent_tasks,
      });
      setForm({ name: "", agent_type: "local", working_directory: "", model: "sonnet", max_turns: 50, max_concurrent_tasks: 1 });
      setShowForm(false);
      refresh();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setEditForm({
      name: agent.name,
      working_directory: agent.working_directory || "",
      model: agent.model,
      max_turns: agent.max_turns,
      max_concurrent_tasks: agent.max_concurrent_tasks,
    });
    setEditError(null);
  };

  const handleEditPickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setEditForm((f) => ({ ...f, working_directory: dir }));
  };

  const handleEditSave = async () => {
    if (!editingId || !editForm.name.trim() || editSubmitting) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await updateAgent({
        id: editingId,
        name: editForm.name.trim(),
        working_directory: editForm.working_directory || undefined,
        model: editForm.model,
        max_turns: editForm.max_turns,
        max_concurrent_tasks: editForm.max_concurrent_tasks,
      });
      setEditingId(null);
      refresh();
    } catch (e) {
      setEditError(String(e));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete Agent",
      message: "This agent and its configuration will be permanently removed. Are you sure?",
    });
    if (!ok) return;
    await deleteAgent(id);
    refresh();
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(key);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedToken(null), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className={`text-lg font-semibold ${s.heading}`}>Agents</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition-colors ${
              isDark ? "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600" : "border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
            }`}
          >
            <Info size={14} />
            Guide
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-colors ${s.accentBtn}`}
          >
            <Plus size={14} />
            New Agent
          </button>
        </div>
      </div>

      {/* Claude System Status */}
      {!claudeLoading && claude && (
        <div className={`rounded-lg border px-4 py-3 ${s.card}`}>
          <div className="flex items-center gap-4 text-[13px]">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${s.muted}`}>System</span>
            <StatusChip ok={claude.installed} label={claude.installed ? `Claude ${claude.version || "CLI"}` : "CLI not found"} isDark={isDark} />
            <StatusChip ok={claude.authenticated} label={claude.authenticated ? (claude.auth_method || "Authenticated") : "Not logged in"} isDark={isDark} />
          </div>
          {!claude.installed && (
            <div className={`mt-2 text-[12px] ${s.muted}`}>
              Install: <code className={`font-mono ${s.accent}`}>curl -fsSL https://claude.ai/install.sh | bash</code>
            </div>
          )}
          {claude.installed && !claude.authenticated && (
            <div className={`mt-2 text-[12px] ${s.muted}`}>
              Login: <code className={`font-mono ${s.accent}`}>claude auth login</code>
            </div>
          )}
        </div>
      )}

      {/* Setup Guide */}
      {showGuide && (
        <div className={`rounded-lg border p-4 space-y-4 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${s.heading}`}>Setup Guide</h3>
            <button onClick={() => setShowGuide(false)} className={`${s.muted} hover:text-zinc-400`} aria-label="Close guide"><X size={16} /></button>
          </div>
          <GuideStep step={1} title="Local Agent" desc="Runs on this machine" isDark={isDark} accent={s.accent}>
            <ol className={`space-y-1 text-[12px] ${s.label} list-decimal list-inside`}>
              <li>Install Claude CLI: <code className={`font-mono ${s.accent}`}>curl -fsSL https://claude.ai/install.sh | bash</code></li>
              <li>Login: <code className={`font-mono ${s.accent}`}>claude auth login</code></li>
              <li>Click "New Agent" → Local → pick working directory</li>
              <li>Create a task - agent will automatically pick it up</li>
            </ol>
          </GuideStep>
          <GuideStep step={2} title="Remote Agent" desc="Runs on another machine" isDark={isDark} accent={s.accent}>
            <ol className={`space-y-1 text-[12px] ${s.label} list-decimal list-inside`}>
              <li>Click "New Agent" → Remote → copy the connection token</li>
              <li>On remote machine: <code className={`font-mono ${s.accent}`}>npx aidesk-agent --server http://YOUR_IP:3939 --token TOKEN</code></li>
              <li>For public access: <code className={`font-mono ${s.accent}`}>cloudflared tunnel --url http://localhost:3939</code></li>
            </ol>
          </GuideStep>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className={`rounded-lg border p-4 space-y-3 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${s.heading}`}>New Agent</h3>
            <button onClick={() => { setShowForm(false); setFormError(null); }} className={`${s.muted} hover:text-zinc-400`} aria-label="Close form"><X size={16} /></button>
          </div>

          <div className="flex gap-2">
            <TypeTab active={form.agent_type === "local"} onClick={() => setForm({ ...form, agent_type: "local" })} icon={<Monitor size={14} />} label="Local" desc="This machine" isDark={isDark} />
            <TypeTab active={form.agent_type === "remote"} onClick={() => setForm({ ...form, agent_type: "remote" })} icon={<Globe size={14} />} label="Remote" desc="Another machine" isDark={isDark} />
          </div>

          {form.agent_type === "local" && claude && !claude.installed && (
            <Warning text="Claude CLI not installed. Local agents require it." />
          )}
          {form.agent_type === "local" && claude && claude.installed && !claude.authenticated && (
            <Warning text="Claude CLI not authenticated. Run: claude auth login" />
          )}

          <div className="grid grid-cols-3 gap-2">
            <input placeholder="Agent name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Agent name"
              className={`rounded-md border px-3 py-2 text-sm ${s.focus} ${s.input}`} />
            <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} aria-label="Model"
              className={`rounded-md border px-2.5 py-2 text-sm ${s.input}`}>
              <option value="sonnet">Sonnet (balanced)</option>
              <option value="opus">Opus (powerful)</option>
              <option value="haiku">Haiku (fast)</option>
            </select>
            <select value={form.max_concurrent_tasks} onChange={(e) => setForm({ ...form, max_concurrent_tasks: parseInt(e.target.value) })} aria-label="Concurrent tasks"
              className={`rounded-md border px-2.5 py-2 text-sm ${s.input}`}>
              <option value={1}>1 concurrent task</option>
              <option value={2}>2 concurrent tasks</option>
              <option value={3}>3 concurrent tasks</option>
              <option value={5}>5 concurrent tasks</option>
            </select>
          </div>

          {form.agent_type === "local" && (
            <div>
              <label className={`text-[11px] ${s.muted} mb-1 block`}>Working Directory</label>
              <div className="flex gap-2">
                <input
                  value={form.working_directory}
                  onChange={(e) => setForm({ ...form, working_directory: e.target.value })}
                  placeholder="Select a project folder..."
                  aria-label="Working directory"
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-mono ${s.focus} ${s.input}`}
                  readOnly
                />
                <button onClick={handlePickDir}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                    isDark ? "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600" : "border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
                  }`}
                  aria-label="Browse">
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-500">
              <XCircle size={13} />
              {formError}
            </div>
          )}

          <button onClick={handleCreate}
            disabled={!form.name.trim() || submitting || (form.agent_type === "local" && claude !== null && (!claude.installed || !claude.authenticated))}
            className={`rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${s.accentBtn}`}>
            {submitting ? "Creating..." : "Create Agent"}
          </button>
        </div>
      )}

      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />

      {/* Agents List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 size={20} className={`animate-spin ${s.spinner}`} /></div>
      ) : agents.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-lg border py-16 ${s.card} ${s.muted}`}>
          <Bot size={32} className="mb-2 opacity-30" />
          <p className="text-sm mb-1">No agents registered</p>
          <button onClick={() => setShowGuide(true)} className={`text-[12px] ${s.accent} ${s.accentHover}`}>View setup guide</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div key={agent.id} className={`rounded-lg border p-4 space-y-3 ${s.card}`}>
              {editingId === agent.id ? (
                /* === Edit Mode === */
                <>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${s.heading}`}>Edit Agent</h3>
                    <button onClick={() => { setEditingId(null); setEditError(null); }} className={`${s.muted} hover:text-zinc-400`} aria-label="Cancel edit"><X size={16} /></button>
                  </div>

                  <div>
                    <label className={`text-[11px] ${s.muted} mb-1 block`}>Name</label>
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} aria-label="Agent name"
                      className={`w-full rounded-md border px-3 py-2 text-sm ${s.focus} ${s.input}`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={`text-[11px] ${s.muted} mb-1 block`}>Model</label>
                      <select value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} aria-label="Model"
                        className={`w-full rounded-md border px-2.5 py-2 text-sm ${s.input}`}>
                        <option value="sonnet">Sonnet (balanced)</option>
                        <option value="opus">Opus (powerful)</option>
                        <option value="haiku">Haiku (fast)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-[11px] ${s.muted} mb-1 block`}>Max Turns</label>
                      <input type="number" min={1} max={500} value={editForm.max_turns}
                        onChange={(e) => setEditForm({ ...editForm, max_turns: parseInt(e.target.value) || 50 })}
                        aria-label="Max turns"
                        className={`w-full rounded-md border px-3 py-2 text-sm ${s.focus} ${s.input}`} />
                    </div>
                    <div>
                      <label className={`text-[11px] ${s.muted} mb-1 block`}>Concurrent</label>
                      <select value={editForm.max_concurrent_tasks} onChange={(e) => setEditForm({ ...editForm, max_concurrent_tasks: parseInt(e.target.value) })} aria-label="Concurrent tasks"
                        className={`w-full rounded-md border px-2.5 py-2 text-sm ${s.input}`}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                      </select>
                    </div>
                  </div>

                  {agent.agent_type === "local" && (
                    <div>
                      <label className={`text-[11px] ${s.muted} mb-1 block`}>Working Directory</label>
                      <div className="flex gap-2">
                        <input value={editForm.working_directory} readOnly placeholder="Select a project folder..."
                          aria-label="Working directory"
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-mono ${s.focus} ${s.input}`} />
                        <button onClick={handleEditPickDir}
                          className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                            isDark ? "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600" : "border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
                          }`}
                          aria-label="Browse">
                          <FolderOpen size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {editError && (
                    <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-500">
                      <XCircle size={13} />
                      {editError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleEditSave}
                      disabled={!editForm.name.trim() || editSubmitting}
                      className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${s.accentBtn}`}>
                      <Save size={13} />
                      {editSubmitting ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => { setEditingId(null); setEditError(null); }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        isDark ? "border-zinc-800 text-zinc-400 hover:text-zinc-200" : "border-zinc-300 text-zinc-500 hover:text-zinc-700"
                      }`}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* === View Mode === */
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {agent.agent_type === "local" ? <Monitor size={15} className={s.muted} /> : <Globe size={15} className={s.muted} />}
                      <div>
                        <h3 className={`text-sm font-medium ${s.heading}`}>{agent.name}</h3>
                        <p className={`text-[11px] ${s.muted}`}>{agent.agent_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[agent.status]}>{agent.status}</Badge>
                      <button onClick={() => startEdit(agent)} className={`transition-colors ${isDark ? "text-zinc-600 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`} aria-label="Edit agent"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(agent.id)} className={`transition-colors ${s.hoverDelete}`} aria-label="Delete agent"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                    <span className={s.muted}>Model</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.model}</span>
                    <span className={s.muted}>Max turns</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.max_turns}</span>
                    <span className={s.muted}>Concurrent</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.max_concurrent_tasks}</span>
                    {agent.working_directory && <>
                      <span className={s.muted}>Directory</span>
                      <span className={`${s.label} text-right truncate font-mono text-[11px]`} title={agent.working_directory}>{agent.working_directory}</span>
                    </>}
                    <span className={s.muted}>Last seen</span>
                    <span className={`${s.label} text-right`}>{timeAgo(agent.last_heartbeat)}</span>
                  </div>

                  {agent.agent_type === "remote" && agent.token && (
                    <>
                      <div>
                        <label className={`text-[11px] ${s.muted} mb-1 block`}>Token</label>
                        <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${s.row}`}>
                          <code className={`flex-1 truncate text-[11px] ${s.muted} font-mono`}>{agent.token}</code>
                          <button onClick={() => copyToClipboard(agent.token, `token-${agent.id}`)} className={`${s.muted} hover:text-emerald-500 transition-colors`} aria-label="Copy token">
                            {copiedToken === `token-${agent.id}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={`text-[11px] ${s.muted} mb-1 block`}>Connect command</label>
                        <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${s.row}`}>
                          <code className={`flex-1 truncate text-[10px] ${s.accent} font-mono`}>
                            AIDESK_TOKEN={agent.token} npx aidesk-agent --server http://localhost:3939 --insecure
                          </code>
                          <button
                            onClick={() => copyToClipboard(`AIDESK_TOKEN=${agent.token} npx aidesk-agent --server http://localhost:3939 --insecure`, `cmd-${agent.id}`)}
                            className={`shrink-0 ${s.muted} hover:text-emerald-500 transition-colors`}
                            aria-label="Copy connect command"
                          >
                            {copiedToken === `cmd-${agent.id}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ ok, label, isDark }: { ok: boolean; label: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok
        ? <CheckCircle size={13} className="text-emerald-500" />
        : <XCircle size={13} className="text-red-500" />}
      <span className={ok ? (isDark ? "text-zinc-300" : "text-zinc-700") : (isDark ? "text-zinc-500" : "text-zinc-400")}>{label}</span>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[12px] text-amber-600">
      <AlertTriangle size={13} className="shrink-0" />
      {text}
    </div>
  );
}

function TypeTab({ active, onClick, icon, label, desc, isDark }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string; isDark: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors ${
        active
          ? isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700"
          : isDark ? "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300" : "border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700"
      }`}>
      {icon}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] opacity-60">{desc}</p>
      </div>
    </button>
  );
}

function GuideStep({ step, title, desc, children, isDark, accent }: {
  step: number; title: string; desc: string; children: React.ReactNode; isDark: boolean; accent: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"} text-[11px] font-medium ${accent}`}>{step}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h4 className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{title}</h4>
          <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{desc}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
