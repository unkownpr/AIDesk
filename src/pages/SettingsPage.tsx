import { useState, useEffect, useCallback } from "react";
import { Settings, Key, GitBranch, Server, Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight, Sun, Moon, Download, RefreshCw, CheckCircle, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { useUpdater } from "@/hooks/useUpdater";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import type { Secret, McpConfig, GitConfig } from "@/lib/types";
import {
  listSecrets, createSecret, deleteSecret, getSecretValue,
  listMcpConfigs, createMcpConfig, toggleMcpConfig, deleteMcpConfig,
  listGitConfigs, createGitConfig, deleteGitConfig,
  getSystemInfo,
} from "@/lib/tauri";
import type { SystemInfo } from "@/lib/types";

type SettingsTab = "general" | "secrets" | "git" | "mcp";

const tabs: { id: SettingsTab; label: string; Icon: typeof Settings }[] = [
  { id: "general", label: "General", Icon: Settings },
  { id: "secrets", label: "Secrets", Icon: Key },
  { id: "git", label: "Git", Icon: GitBranch },
  { id: "mcp", label: "MCP Servers", Icon: Server },
];

function useStyles() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const base = themeStyles(isDark);
  return {
    ...base,
    section: isDark ? "text-gray-500" : "text-gray-400",
    value: isDark ? "text-gray-300" : "text-gray-700",
    tab: (active: boolean) => active
      ? isDark ? "border-emerald-500 text-emerald-400" : "border-emerald-600 text-emerald-700"
      : isDark
        ? "border-transparent text-gray-500 hover:text-gray-300"
        : "border-transparent text-gray-400 hover:text-gray-600",
    tabBar: isDark ? "border-[#2d2d3c]/60" : "border-gray-200",
    isDark,
  };
}

// === Main ===

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const s = useStyles();

  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className={`text-xl font-semibold ${s.heading}`}>Settings</h1>

      <div className={`flex gap-1 border-b ${s.tabBar}`}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] font-medium transition-all duration-150 ${s.tab(activeTab === id)}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className={`rounded-2xl border p-6 ${s.card}`}>
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "secrets" && <SecretsTab />}
        {activeTab === "git" && <GitTab />}
        {activeTab === "mcp" && <McpTab />}
      </div>
    </div>
  );
}

// === General Tab ===

function GeneralTab() {
  const { theme, set } = useTheme();
  const s = useStyles();
  const updater = useUpdater();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  const serverUrl = sysInfo ? `http://${sysInfo.local_ip}:3939` : "http://YOUR_IP:3939";
  const connectCmd = `npx aidesk-agent --server ${serverUrl} --token AGENT_TOKEN`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(connectCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <Section title="Updates">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 mb-1.5 ${s.row}`}>
          <div className="flex items-center gap-2.5">
            {updater.status === "checking" && <Loader2 size={15} className="animate-spin text-emerald-500" />}
            {updater.status === "upToDate" && <CheckCircle size={15} className="text-emerald-500" />}
            {updater.status === "available" && <Download size={15} className="text-amber-500" />}
            {updater.status === "downloading" && <Loader2 size={15} className="animate-spin text-emerald-500" />}
            {updater.status === "installing" && <Loader2 size={15} className="animate-spin text-emerald-500" />}
            {updater.status === "error" && <AlertCircle size={15} className="text-red-500" />}
            {updater.status === "idle" && <RefreshCw size={15} className={s.label} />}
            <span className={`text-[14px] ${s.label}`}>
              {updater.status === "idle" && "Version 0.1.0"}
              {updater.status === "checking" && "Checking for updates..."}
              {updater.status === "upToDate" && "Up to date (v0.1.0)"}
              {updater.status === "available" && `Update available: v${updater.version}`}
              {updater.status === "downloading" && `Downloading... ${updater.progress ?? 0}%`}
              {updater.status === "installing" && "Installing update..."}
              {updater.status === "error" && `Error: ${updater.error}`}
            </span>
          </div>
          {(updater.status === "idle" || updater.status === "upToDate" || updater.status === "error") && (
            <button onClick={updater.checkForUpdate} className={`text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 ${s.accentBtnOutline} border`}>
              Check
            </button>
          )}
          {updater.status === "available" && (
            <button onClick={updater.downloadAndInstall} className={`text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 ${s.accentBtn}`}>
              Update Now
            </button>
          )}
        </div>
      </Section>
      <Section title="Appearance">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 mb-1.5 ${s.row}`}>
          <span className={`text-[14px] ${s.label}`}>Theme</span>
          <div className="flex gap-2">
            <button
              onClick={() => set("dark")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all duration-150 ${
                theme === "dark"
                  ? s.accentBtnOutline + " border"
                  : `border ${s.row} ${s.label} hover:text-emerald-600`
              }`}
            >
              <Moon size={14} />
              Dark
            </button>
            <button
              onClick={() => set("light")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all duration-150 ${
                theme === "light"
                  ? s.accentBtnOutline + " border"
                  : `border ${s.row} ${s.label} hover:text-emerald-600`
              }`}
            >
              <Sun size={14} />
              Light
            </button>
          </div>
        </div>
      </Section>
      <Section title="How agents work">
        <Row label="AI Engine" value="Claude Agent SDK" />
        <Row label="File access" value="Full (auto-approved)" />
        <Row label="Task timeout" value="10 minutes max" />
      </Section>
      <Section title="Network">
        <Row label="Port" value="3939" />
        <Row label="Accessible from" value="All devices on network" />
        {sysInfo && <Row label="Hostname" value={sysInfo.hostname} />}
        {sysInfo && <Row label="Local IP" value={sysInfo.local_ip} />}
        <Row label="Task check interval" value="Every 5 seconds" />
      </Section>
      <Section title="Connect a remote agent">
        <div className={`rounded-xl border p-4 space-y-3 text-[14px] ${s.row}`}>
          <p className={s.label}>
            To run an AI agent on another computer, paste this command there:
          </p>
          <div className="flex items-center gap-2">
            <code className={`flex-1 rounded-xl border px-4 py-2.5 text-[13px] ${s.accent} font-mono ${s.row} truncate`}>
              {connectCmd}
            </code>
            <button
              onClick={handleCopy}
              className={`shrink-0 p-2.5 rounded-xl transition-all ${s.muted} hover:text-emerald-500 hover:bg-emerald-500/5`}
              title="Copy command"
            >
              {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            </button>
          </div>
          <p className={`text-[13px] ${s.muted}`}>
            Replace <code className={`font-mono ${s.accent}`}>AGENT_TOKEN</code> with the token you'll find on the <strong>Agents</strong> page after creating a remote agent.
          </p>
        </div>
      </Section>
    </div>
  );
}

// === Secrets Tab ===

function SecretsTab() {
  const s = useStyles();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("general");
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();
  const [revealedValue, setRevealedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try { setSecrets(await listSecrets()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || !value.trim()) return;
    setSubmitting(true);
    try {
      await createSecret({ name: name.trim(), value: value.trim(), category });
      setName("");
      setValue("");
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedId === id) {
      setRevealedId(null);
      setRevealedValue("");
      return;
    }
    try {
      const val = await getSecretValue(id);
      setRevealedId(id);
      setRevealedValue(val);
    } catch (e) {
      alert(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete Secret",
      message: "This secret will be permanently deleted. Are you sure?",
    });
    if (!ok) return;
    try {
      await deleteSecret(id);
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />
      <Section title="Add Secret">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3">
          <input
            placeholder="Name (e.g. ANTHROPIC_API_KEY)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
          />
          <input
            placeholder="Value"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}
          >
            <option value="general">General</option>
            <option value="api_key">API Key</option>
            <option value="token">Token</option>
          </select>
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim() || !value.trim()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium disabled:opacity-40 ${s.accentBtn}`}
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </Section>

      <Section title={`Stored Secrets (${secrets.length})`}>
        {secrets.length === 0 ? (
          <p className={`text-[14px] py-6 text-center ${s.muted}`}>No secrets stored yet</p>
        ) : (
          <div className="space-y-1.5">
            {secrets.map((sec) => (
              <div key={sec.id} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${s.row}`}>
                <div className="flex items-center gap-3">
                  <Key size={14} className="text-amber-500/70" />
                  <span className={`text-[14px] font-mono ${s.value}`}>{sec.name}</span>
                  <span className={`text-[12px] rounded-lg px-2 py-0.5 ${s.badge}`}>{sec.category}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  {revealedId === sec.id && (
                    <span className={`text-[13px] font-mono max-w-[200px] truncate ${s.label}`}>{revealedValue}</span>
                  )}
                  <button onClick={() => handleReveal(sec.id)} className={`p-1.5 rounded-lg ${s.muted} hover:text-emerald-500 transition-all`}>
                    {revealedId === sec.id ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => handleDelete(sec.id)} className={`p-1.5 rounded-lg ${s.muted} hover:text-red-400 transition-all`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// === MCP Tab ===

function McpTab() {
  const s = useStyles();
  const [configs, setConfigs] = useState<McpConfig[]>([]);
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "http" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const load = useCallback(async () => {
    try { setConfigs(await listMcpConfigs()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createMcpConfig({
        name: name.trim(),
        transport,
        command: transport === "stdio" ? command.trim() || undefined : undefined,
        url: transport !== "stdio" ? url.trim() || undefined : undefined,
      });
      setName("");
      setCommand("");
      setUrl("");
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleMcpConfig(id, !current);
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete MCP Config",
      message: "This MCP server configuration will be permanently removed. Are you sure?",
    });
    if (!ok) return;
    try {
      await deleteMcpConfig(id);
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />
      <Section title="Add MCP Server">
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              placeholder="Server name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
            />
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as "stdio" | "http" | "sse")}
              className={`rounded-xl border px-3 py-2.5 text-[14px] ${s.input}`}
            >
              <option value="stdio">stdio</option>
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
            </select>
          </div>
          {transport === "stdio" ? (
            <input
              placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
            />
          ) : (
            <input
              placeholder="URL (e.g. http://localhost:8080/mcp)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
            />
          )}
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium disabled:opacity-40 ${s.accentBtn}`}
          >
            <Plus size={15} />
            Add Server
          </button>
        </div>
      </Section>

      <Section title={`MCP Servers (${configs.length})`}>
        {configs.length === 0 ? (
          <p className={`text-[14px] py-6 text-center ${s.muted}`}>No MCP servers configured</p>
        ) : (
          <div className="space-y-1.5">
            {configs.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${s.row}`}>
                <div className="flex items-center gap-3">
                  <Server size={14} className={c.enabled ? "text-emerald-500/70" : s.muted} />
                  <span className={`text-[14px] ${s.value}`}>{c.name}</span>
                  <span className={`text-[12px] rounded-lg px-2 py-0.5 ${s.badge}`}>{c.transport}</span>
                  <span className={`text-[12px] font-mono max-w-[300px] truncate ${s.muted}`}>
                    {c.command || c.url || ""}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => handleToggle(c.id, c.enabled)} className={`p-1.5 rounded-lg ${s.muted} hover:text-emerald-500 transition-all`}>
                    {c.enabled ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className={`p-1.5 rounded-lg ${s.muted} hover:text-red-400 transition-all`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// === Git Tab ===

function GitTab() {
  const s = useStyles();
  const [configs, setConfigs] = useState<GitConfig[]>([]);
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const load = useCallback(async () => {
    try { setConfigs(await listGitConfigs()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || !repoUrl.trim()) return;
    setSubmitting(true);
    try {
      await createGitConfig({
        name: name.trim(),
        repo_url: repoUrl.trim(),
        default_branch: branch.trim() || "main",
      });
      setName("");
      setRepoUrl("");
      setBranch("main");
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete Git Repository",
      message: "This git repository configuration will be permanently removed. Are you sure?",
    });
    if (!ok) return;
    try {
      await deleteGitConfig(id);
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />
      <Section title="Add Repository">
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <input
              placeholder="Name (e.g. my-project)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
            />
            <input
              placeholder="Default branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className={`rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
            />
          </div>
          <input
            placeholder="Repository URL (e.g. https://github.com/user/repo.git)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className={`w-full rounded-xl border px-4 py-2.5 text-[14px] ${s.focus} ${s.input}`}
          />
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim() || !repoUrl.trim()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium disabled:opacity-40 ${s.accentBtn}`}
          >
            <Plus size={15} />
            Add Repository
          </button>
        </div>
      </Section>

      <Section title={`Repositories (${configs.length})`}>
        {configs.length === 0 ? (
          <p className={`text-[14px] py-6 text-center ${s.muted}`}>No repositories configured</p>
        ) : (
          <div className="space-y-1.5">
            {configs.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${s.row}`}>
                <div className="flex items-center gap-3">
                  <GitBranch size={14} className="text-orange-500/70" />
                  <span className={`text-[14px] ${s.value}`}>{c.name}</span>
                  <span className={`text-[12px] rounded-lg px-2 py-0.5 ${s.badge}`}>{c.default_branch}</span>
                  <span className={`text-[12px] font-mono max-w-[300px] truncate ${s.muted}`}>{c.repo_url}</span>
                </div>
                <button onClick={() => handleDelete(c.id)} className={`p-1.5 rounded-lg ${s.muted} hover:text-red-400 transition-all`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// === Shared Components ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${s.section}`}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 mb-1.5 ${s.row}`}>
      <span className={`text-[14px] ${s.label}`}>{label}</span>
      <span className={`text-[14px] font-mono ${s.value}`}>{value}</span>
    </div>
  );
}
