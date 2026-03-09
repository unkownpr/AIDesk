import { useState, useEffect, useCallback } from "react";
import { FolderKanban, Plus, Trash2, FolderOpen, Pencil, Save, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/hooks/useConfirm";
import { useTheme } from "@/hooks/useTheme";
import { themeStyles } from "@/lib/theme";
import type { Project } from "@/lib/types";
import {
  listProjects, createProject, updateProject, deleteProject, pickDirectory,
} from "@/lib/tauri";

function useStyles() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const base = themeStyles(isDark);
  return {
    ...base,
    section: isDark ? "text-zinc-500" : "text-zinc-400",
    value: isDark ? "text-zinc-300" : "text-zinc-700",
    isDark,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <div>
      <h3 className={`text-[11px] font-medium uppercase tracking-wider mb-2 ${s.section}`}>{title}</h3>
      {children}
    </div>
  );
}

export function ProjectsPage() {
  const s = useStyles();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");
  const [gitRepo, setGitRepo] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", path: "", description: "", git_repo: "", git_branch: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const { state: confirmState, confirm, cancel: cancelConfirm } = useConfirm();

  const load = useCallback(async () => {
    try { setProjects(await listProjects()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setPath(dir);
  };

  const handleEditPickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setEditForm((f) => ({ ...f, path: dir }));
  };

  const handleCreate = async () => {
    if (!name.trim() || !path.trim()) return;
    setSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        path: path.trim(),
        description: description.trim() || undefined,
        git_repo: gitRepo.trim() || undefined,
        git_branch: gitBranch.trim() || undefined,
      });
      setName(""); setPath(""); setDescription(""); setGitRepo(""); setGitBranch("main");
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      path: p.path,
      description: p.description || "",
      git_repo: p.git_repo || "",
      git_branch: p.git_branch || "main",
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingId || !editForm.name.trim() || !editForm.path.trim()) return;
    setEditError(null);
    try {
      await updateProject({
        id: editingId,
        name: editForm.name.trim(),
        path: editForm.path.trim(),
        description: editForm.description.trim() || undefined,
        git_repo: editForm.git_repo.trim() || undefined,
        git_branch: editForm.git_branch.trim() || undefined,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setEditError(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete Project",
      message: "This project will be removed. Tasks referencing it will be unlinked. Are you sure?",
    });
    if (!ok) return;
    try {
      await deleteProject(id);
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className={`text-lg font-semibold ${s.heading}`}>Projects</h1>
      <ConfirmDialog {...confirmState} onCancel={cancelConfirm} />

      <div className={`rounded-lg border p-5 ${s.card}`}>
        <Section title="Add Project">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`rounded-md border px-3 py-2 text-[13px] ${s.focus} ${s.input}`}
              />
              <input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`rounded-md border px-3 py-2 text-[13px] ${s.focus} ${s.input}`}
              />
            </div>
            <div className="flex gap-2">
              <input
                value={path}
                readOnly
                placeholder="Select project directory..."
                className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-mono ${s.focus} ${s.input}`}
              />
              <button onClick={handlePickDir}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] transition-colors ${
                  s.isDark ? "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600" : "border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700 hover:border-zinc-400"
                }`}>
                <FolderOpen size={14} />
                Browse
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Git repo URL (optional)"
                value={gitRepo}
                onChange={(e) => setGitRepo(e.target.value)}
                className={`rounded-md border px-3 py-2 text-[13px] ${s.focus} ${s.input}`}
              />
              <input
                placeholder="Default branch"
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
                className={`rounded-md border px-3 py-2 text-[13px] ${s.focus} ${s.input}`}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={submitting || !name.trim() || !path.trim()}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              <Plus size={14} />
              Add Project
            </button>
          </div>
        </Section>
      </div>

      <div className={`rounded-lg border p-5 ${s.card}`}>
        <Section title={`Projects (${projects.length})`}>
          {projects.length === 0 ? (
            <p className={`text-[12px] py-4 text-center ${s.muted}`}>No projects configured yet</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => editingId === p.id ? (
                <div key={p.id} className={`rounded-md border p-3 space-y-2 ${s.row}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${s.section}`}>Edit Project</span>
                    <button onClick={() => { setEditingId(null); setEditError(null); }} className={`${s.muted} hover:text-zinc-400`}><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Name" className={`rounded-md border px-3 py-1.5 text-[13px] ${s.focus} ${s.input}`} />
                    <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Description" className={`rounded-md border px-3 py-1.5 text-[13px] ${s.focus} ${s.input}`} />
                  </div>
                  <div className="flex gap-2">
                    <input value={editForm.path} readOnly
                      className={`flex-1 rounded-md border px-3 py-1.5 text-[13px] font-mono ${s.focus} ${s.input}`} />
                    <button onClick={handleEditPickDir}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-[12px] ${
                        s.isDark ? "border-zinc-800 text-zinc-400 hover:text-zinc-200" : "border-zinc-300 text-zinc-500 hover:text-zinc-700"
                      }`}>
                      <FolderOpen size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editForm.git_repo} onChange={(e) => setEditForm({ ...editForm, git_repo: e.target.value })}
                      placeholder="Git repo URL" className={`rounded-md border px-3 py-1.5 text-[13px] ${s.focus} ${s.input}`} />
                    <input value={editForm.git_branch} onChange={(e) => setEditForm({ ...editForm, git_branch: e.target.value })}
                      placeholder="Branch" className={`rounded-md border px-3 py-1.5 text-[13px] ${s.focus} ${s.input}`} />
                  </div>
                  {editError && <p className="text-[12px] text-red-500">{editError}</p>}
                  <button onClick={handleEditSave}
                    disabled={!editForm.name.trim() || !editForm.path.trim()}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
                    <Save size={12} /> Save
                  </button>
                </div>
              ) : (
                <div key={p.id} className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${s.row}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderKanban size={13} className="text-emerald-500/70 shrink-0" />
                      <span className={`text-[13px] font-medium ${s.value}`}>{p.name}</span>
                      {p.description && <span className={`text-[11px] ${s.muted} truncate`}>{p.description}</span>}
                    </div>
                    <div className={`flex gap-4 mt-1 text-[11px] ${s.muted}`}>
                      <span className="font-mono truncate max-w-[250px]" title={p.path}>{p.path}</span>
                      {p.git_repo && <span className="truncate max-w-[200px]">{p.git_repo}</span>}
                      {p.git_branch && <span>{p.git_branch}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(p)} className={`p-1 ${s.muted} hover:text-emerald-500`}><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p.id)} className={`p-1 ${s.muted} hover:text-red-400`}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
