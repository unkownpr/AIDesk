import { useCallback, useState, useRef, useEffect } from "react";
import { listAgents, createAgent, updateAgent, deleteAgent, checkClaudeStatus, getSystemInfo } from "@/lib/tauri";
import type { SystemInfo } from "@/lib/types";
import { usePolling } from "@/hooks/usePolling";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { statusColors, timeAgo } from "@/lib/utils";
import type { Agent, ClaudeStatus } from "@/lib/types";
import {
  Plus, Trash2, Copy, Check, X, Bot, Globe, Monitor, Loader2,
  Info, CheckCircle, XCircle, AlertTriangle, Pencil, Save,
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
    model: "sonnet", max_turns: 50, max_concurrent_tasks: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", model: "sonnet", max_turns: 50, max_concurrent_tasks: 1 });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const serverUrl = sysInfo ? `http://${sysInfo.local_ip}:3939` : "http://localhost:3939";

  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  useEffect(() => {
    setClaudeLoading(true);
    checkClaudeStatus()
      .then(setClaude)
      .catch(() => setClaude({ installed: false, version: null, authenticated: false, auth_method: null }))
      .finally(() => setClaudeLoading(false));
    getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || submitting) return;
    setFormError(null);

    if (form.agent_type === "local") {
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
        model: form.model,
        max_turns: form.max_turns,
        max_concurrent_tasks: form.max_concurrent_tasks,
      });
      setForm({ name: "", agent_type: "local", model: "sonnet", max_turns: 50, max_concurrent_tasks: 1 });
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
      model: agent.model,
      max_turns: agent.max_turns,
      max_concurrent_tasks: agent.max_concurrent_tasks,
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingId || !editForm.name.trim() || editSubmitting) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await updateAgent({
        id: editingId,
        name: editForm.name.trim(),
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
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className={`text-xl font-semibold ${s.heading}`}>Agents</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] transition-all duration-150 ${
              isDark ? "border-[#2d2d3c]/60 text-gray-400 hover:text-gray-200 hover:border-gray-500" : "border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
            }`}
          >
            <Info size={15} />
            Guide
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-medium text-white transition-all duration-150 ${s.accentBtn}`}
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>
      </div>

      {/* Claude System Status */}
      {!claudeLoading && claude && (
        <div className={`rounded-xl border px-5 py-3.5 ${s.card}`}>
          <div className="flex items-center gap-5 text-[14px]">
            <span className={s.sectionTitle}>System</span>
            <StatusChip ok={claude.installed} label={claude.installed ? `Claude ${claude.version || "CLI"}` : "CLI not found"} isDark={isDark} />
            <StatusChip ok={claude.authenticated} label={claude.authenticated ? (claude.auth_method || "Authenticated") : "Not logged in"} isDark={isDark} />
          </div>
          {!claude.installed && (
            <div className={`mt-2.5 text-[13px] ${s.muted}`}>
              Install: <code className={`font-mono ${s.accent}`}>curl -fsSL https://claude.ai/install.sh | bash</code>
            </div>
          )}
          {claude.installed && !claude.authenticated && (
            <div className={`mt-2.5 text-[13px] ${s.muted}`}>
              Login: <code className={`font-mono ${s.accent}`}>claude auth login</code>
            </div>
          )}
        </div>
      )}

      {/* Setup Guide */}
      {showGuide && (
        <div className={`rounded-2xl border p-5 space-y-5 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-[15px] font-semibold ${s.heading}`}>Setup Guide</h3>
            <button onClick={() => setShowGuide(false)} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`} aria-label="Close guide"><X size={18} /></button>
          </div>
          <GuideStep step={1} title="Local Agent" desc="Runs on this machine" isDark={isDark} accent={s.accent}>
            <ol className={`space-y-1.5 text-[13px] ${s.label} list-decimal list-inside`}>
              <li>Install Claude CLI: <code className={`font-mono ${s.accent}`}>curl -fsSL https://claude.ai/install.sh | bash</code></li>
              <li>Login: <code className={`font-mono ${s.accent}`}>claude auth login</code></li>
              <li>Click "New Agent" → Local → set model & concurrency</li>
              <li>Go to Projects → open a project → send a task</li>
            </ol>
          </GuideStep>
          <GuideStep step={2} title="Remote Agent" desc="Runs on another machine" isDark={isDark} accent={s.accent}>
            <ol className={`space-y-1.5 text-[13px] ${s.label} list-decimal list-inside`}>
              <li>Click "New Agent" → Remote → copy the connection token</li>
              <li>On remote machine: <code className={`font-mono ${s.accent}`}>npx aidesk-agent --server {serverUrl} --token TOKEN</code></li>
              <li>For public access: <code className={`font-mono ${s.accent}`}>cloudflared tunnel --url http://localhost:3939</code></li>
            </ol>
          </GuideStep>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${s.card}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-[15px] font-semibold ${s.heading}`}>New Agent</h3>
            <button onClick={() => { setShowForm(false); setFormError(null); }} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`} aria-label="Close form"><X size={18} /></button>
          </div>

          <div className="flex gap-3">
            <TypeTab active={form.agent_type === "local"} onClick={() => setForm({ ...form, agent_type: "local" })} icon={<Monitor size={16} />} label="Local Agent" desc="Runs on this computer" isDark={isDark} />
            <TypeTab active={form.agent_type === "remote"} onClick={() => setForm({ ...form, agent_type: "remote" })} icon={<Globe size={16} />} label="Remote Agent" desc="Runs on a different computer" isDark={isDark} />
          </div>

          {form.agent_type === "local" && claude && !claude.installed && (
            <Warning text="Claude CLI not installed. Local agents require it." />
          )}
          {form.agent_type === "local" && claude && claude.installed && !claude.authenticated && (
            <Warning text="Claude CLI not authenticated. Run: claude auth login" />
          )}

          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Agent name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Agent name"
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
            <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} aria-label="Model"
              className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value="sonnet">Sonnet — balanced</option>
              <option value="opus">Opus — most capable</option>
              <option value="haiku">Haiku — fastest</option>
            </select>
            <select value={form.max_concurrent_tasks} onChange={(e) => setForm({ ...form, max_concurrent_tasks: parseInt(e.target.value) })} aria-label="Concurrent tasks"
              className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
              <option value={1}>1 concurrent task</option>
              <option value={2}>2 concurrent tasks</option>
              <option value={3}>3 concurrent tasks</option>
              <option value={5}>5 concurrent tasks</option>
            </select>
          </div>

          {formError && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[13px] text-red-500">
              <XCircle size={15} />
              {formError}
            </div>
          )}

          <button onClick={handleCreate}
            disabled={!form.name.trim() || submitting || (form.agent_type === "local" && claude !== null && (!claude.installed || !claude.authenticated))}
            className={`rounded-xl px-5 py-2 text-[14px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ${s.accentBtn}`}>
            {submitting ? "Creating..." : "Create Agent"}
          </button>
        </div>
      )}

      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />

      {/* Agents List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 size={22} className={`animate-spin ${s.spinner}`} /></div>
      ) : agents.length === 0 ? (
        <div className={`flex flex-col items-center justify-center rounded-2xl border py-20 ${s.card} ${s.muted}`}>
          <Bot size={40} className="mb-3 opacity-20" />
          <p className="text-[15px] mb-1">No agents yet</p>
          <p className={`text-[13px] mb-3 ${s.muted}`}>Agents are AI workers that complete tasks for you</p>
          <button onClick={() => { setShowForm(true); setFormError(null); }} className={`text-[14px] font-medium ${s.accent} ${s.accentHover}`}>+ Create your first agent</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className={`rounded-2xl border p-5 space-y-4 ${s.card}`}>
              {editingId === agent.id ? (
                /* === Edit Mode === */
                <>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-[15px] font-semibold ${s.heading}`}>Edit Agent</h3>
                    <button onClick={() => { setEditingId(null); setEditError(null); }} className={`rounded-lg p-1 ${s.muted} hover:text-gray-300`} aria-label="Cancel edit"><X size={18} /></button>
                  </div>

                  <div>
                    <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Name</label>
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} aria-label="Agent name"
                      className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Model</label>
                      <select value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} aria-label="Model"
                        className={`w-full rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
                        <option value="sonnet">Sonnet (balanced)</option>
                        <option value="opus">Opus (powerful)</option>
                        <option value="haiku">Haiku (fast)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Max Turns</label>
                      <input type="number" min={1} max={500} value={editForm.max_turns}
                        onChange={(e) => setEditForm({ ...editForm, max_turns: parseInt(e.target.value) || 50 })}
                        aria-label="Max turns"
                        className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`} />
                    </div>
                    <div>
                      <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Concurrent</label>
                      <select value={editForm.max_concurrent_tasks} onChange={(e) => setEditForm({ ...editForm, max_concurrent_tasks: parseInt(e.target.value) })} aria-label="Concurrent tasks"
                        className={`w-full rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                      </select>
                    </div>
                  </div>

                  {editError && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[13px] text-red-500">
                      <XCircle size={15} />
                      {editError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={handleEditSave}
                      disabled={!editForm.name.trim() || editSubmitting}
                      className={`flex items-center gap-2 rounded-xl px-5 py-2 text-[14px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 ${s.accentBtn}`}>
                      <Save size={14} />
                      {editSubmitting ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => { setEditingId(null); setEditError(null); }}
                      className={`rounded-xl border px-4 py-2 text-[14px] transition-all duration-150 ${
                        isDark ? "border-[#2d2d3c]/60 text-gray-400 hover:text-gray-200" : "border-gray-300 text-gray-500 hover:text-gray-700"
                      }`}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                /* === View Mode === */
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${agent.agent_type === "local" ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
                        {agent.agent_type === "local" ? <Monitor size={16} className="text-blue-400" /> : <Globe size={16} className="text-purple-400" />}
                      </div>
                      <div>
                        <h3 className={`text-[15px] font-medium ${s.heading}`}>{agent.name}</h3>
                        <p className={`text-[13px] ${s.muted}`}>{agent.agent_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge className={statusColors[agent.status]}>{agent.status}</Badge>
                      <button onClick={() => startEdit(agent)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-gray-600 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`} aria-label="Edit agent"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(agent.id)} className={`p-1.5 rounded-lg transition-all ${s.hoverDelete} hover:bg-red-500/5`} aria-label="Delete agent"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-[13px]">
                    <span className={s.muted}>Model</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.model}</span>
                    <span className={s.muted}>Max turns</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.max_turns}</span>
                    <span className={s.muted}>Concurrent</span>
                    <span className={`${s.textSecondary} text-right`}>{agent.max_concurrent_tasks}</span>
                    <span className={s.muted}>Last seen</span>
                    <span className={`${s.label} text-right`}>{timeAgo(agent.last_heartbeat)}</span>
                  </div>

                  {agent.agent_type === "remote" && agent.token && (
                    <>
                      <div>
                        <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Token</label>
                        <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${s.row}`}>
                          <code className={`flex-1 truncate text-[12px] ${s.muted} font-mono`}>{agent.token}</code>
                          <button onClick={() => copyToClipboard(agent.token, `token-${agent.id}`)} className={`p-1 rounded-lg ${s.muted} hover:text-emerald-500 transition-all`} aria-label="Copy token">
                            {copiedToken === `token-${agent.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={`text-[12px] ${s.muted} mb-1.5 block`}>Connect command</label>
                        <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 ${s.row}`}>
                          <code className={`flex-1 truncate text-[12px] ${s.accent} font-mono`}>
                            AIDESK_TOKEN={agent.token} npx aidesk-agent --server {serverUrl} --insecure
                          </code>
                          <button
                            onClick={() => copyToClipboard(`AIDESK_TOKEN=${agent.token} npx aidesk-agent --server ${serverUrl} --insecure`, `cmd-${agent.id}`)}
                            className={`shrink-0 p-1 rounded-lg ${s.muted} hover:text-emerald-500 transition-all`}
                            aria-label="Copy connect command"
                          >
                            {copiedToken === `cmd-${agent.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
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
    <div className="flex items-center gap-2">
      {ok
        ? <CheckCircle size={15} className="text-emerald-500" />
        : <XCircle size={15} className="text-red-500" />}
      <span className={`text-[14px] ${ok ? (isDark ? "text-gray-300" : "text-gray-700") : (isDark ? "text-gray-500" : "text-gray-400")}`}>{label}</span>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-[13px] text-amber-600">
      <AlertTriangle size={15} className="shrink-0" />
      {text}
    </div>
  );
}

function TypeTab({ active, onClick, icon, label, desc, isDark }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string; isDark: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
        active
          ? isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.06)]" : "border-emerald-300 bg-emerald-50 text-emerald-700"
          : isDark ? "border-[#2d2d3c]/60 bg-[#14141b] text-gray-500 hover:text-gray-300 hover:border-gray-600" : "border-gray-300 bg-white text-gray-500 hover:text-gray-700"
      }`}>
      {icon}
      <div>
        <p className="text-[14px] font-medium">{label}</p>
        <p className="text-[12px] opacity-60">{desc}</p>
      </div>
    </button>
  );
}

function GuideStep({ step, title, desc, children, isDark, accent }: {
  step: number; title: string; desc: string; children: React.ReactNode; isDark: boolean; accent: string;
}) {
  return (
    <div className="flex gap-3.5">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"} text-[12px] font-semibold ${accent}`}>{step}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <h4 className={`text-[14px] font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>{title}</h4>
          <span className={`text-[12px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{desc}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
