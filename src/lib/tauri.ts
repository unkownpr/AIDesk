import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Agent, Task, TaskLog, ClaudeStatus, Secret, McpConfig, GitConfig, Project, QueueInfo, ActivityLogResponse, SystemInfo } from "./types";

// Agent commands
export const listAgents = () => invoke<Agent[]>("list_agents");
export const createAgent = (params: {
  name: string;
  agent_type?: string;
  working_directory?: string;
  model?: string;
  max_turns?: number;
  max_concurrent_tasks?: number;
}) => invoke<Agent>("create_agent", {
  name: params.name,
  agentType: params.agent_type,
  workingDirectory: params.working_directory,
  model: params.model,
  maxTurns: params.max_turns,
  maxConcurrentTasks: params.max_concurrent_tasks,
});
export const updateAgent = (params: {
  id: string;
  name?: string;
  working_directory?: string;
  model?: string;
  max_turns?: number;
  max_concurrent_tasks?: number;
}) => invoke<Agent>("update_agent", {
  id: params.id,
  name: params.name,
  workingDirectory: params.working_directory,
  model: params.model,
  maxTurns: params.max_turns,
  maxConcurrentTasks: params.max_concurrent_tasks,
});
export const deleteAgent = (id: string) => invoke<void>("delete_agent", { id });

// Task commands
export const listTasks = () => invoke<Task[]>("list_tasks");
export const createTask = (params: {
  title: string;
  description: string;
  priority?: string;
  git_repo?: string;
  git_branch?: string;
  project_id?: string;
  max_retries?: number;
  assigned_agent_id?: string;
}) => invoke<Task>("create_task", {
  title: params.title,
  description: params.description,
  priority: params.priority,
  projectId: params.project_id,
  maxRetries: params.max_retries,
  gitRepo: params.git_repo,
  gitBranch: params.git_branch,
  assignedAgentId: params.assigned_agent_id,
});
export const getTask = (id: string) => invoke<Task>("get_task", { id });
export const updateTask = (params: {
  id: string;
  title?: string;
  description?: string;
  priority?: string;
}) => invoke<Task>("update_task", params);
export const cancelTask = (id: string) => invoke<void>("cancel_task", { id });
export const deleteTask = (id: string) => invoke<void>("delete_task", { id });
export const getTaskLogs = (taskId: string) =>
  invoke<TaskLog[]>("get_task_logs", { taskId });
export const retryTask = (id: string) => invoke<Task>("retry_task", { id });
export const getQueueInfo = () => invoke<QueueInfo>("get_queue_info");

// Secret commands
export const listSecrets = () => invoke<Secret[]>("list_secrets");
export const createSecret = (params: {
  name: string;
  value: string;
  category?: string;
}) => invoke<Secret>("create_secret", params);
export const getSecretValue = (id: string) => invoke<string>("get_secret_value", { id });
export const deleteSecret = (id: string) => invoke<void>("delete_secret", { id });

// MCP commands
export const listMcpConfigs = () => invoke<McpConfig[]>("list_mcp_configs");
export const createMcpConfig = (params: {
  name: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string;
  env_vars?: string;
}) => invoke<McpConfig>("create_mcp_config", {
  name: params.name,
  transport: params.transport,
  url: params.url,
  command: params.command,
  args: params.args,
  envVars: params.env_vars,
});
export const toggleMcpConfig = (id: string, enabled: boolean) =>
  invoke<void>("toggle_mcp_config", { id, enabled });
export const deleteMcpConfig = (id: string) => invoke<void>("delete_mcp_config", { id });

// Git commands
export const listGitConfigs = () => invoke<GitConfig[]>("list_git_configs");
export const createGitConfig = (params: {
  name: string;
  repo_url: string;
  default_branch?: string;
  credentials_secret_id?: string;
}) => invoke<GitConfig>("create_git_config", {
  name: params.name,
  repoUrl: params.repo_url,
  defaultBranch: params.default_branch,
  credentialsSecretId: params.credentials_secret_id,
});
export const deleteGitConfig = (id: string) => invoke<void>("delete_git_config", { id });

// Project commands
export const listProjects = () => invoke<Project[]>("list_projects");
export const createProject = (params: {
  name: string;
  path: string;
  description?: string;
  git_repo?: string;
  git_branch?: string;
}) => invoke<Project>("create_project", {
  name: params.name,
  path: params.path,
  description: params.description,
  gitRepo: params.git_repo,
  gitBranch: params.git_branch,
});
export const updateProject = (params: {
  id: string;
  name?: string;
  path?: string;
  description?: string;
  git_repo?: string;
  git_branch?: string;
}) => invoke<Project>("update_project", {
  id: params.id,
  name: params.name,
  path: params.path,
  description: params.description,
  gitRepo: params.git_repo,
  gitBranch: params.git_branch,
});
export const deleteProject = (id: string) => invoke<void>("delete_project", { id });
export const getProject = (id: string) => invoke<Project>("get_project", { id });
export const listTasksByProject = (projectId: string) => invoke<Task[]>("list_tasks_by_project", { projectId });

// Activity logs
export const listActivityLogs = (params?: {
  limit?: number;
  offset?: number;
  entity_type?: string;
}) => invoke<ActivityLogResponse>("list_activity_logs", {
  limit: params?.limit,
  offset: params?.offset,
  entityType: params?.entity_type,
});

// Orchestrator
export const triggerOrchestrator = () => invoke<void>("trigger_orchestrator");

// System
export const checkClaudeStatus = () => invoke<ClaudeStatus>("check_claude_status");
export const getDashboardKey = () => invoke<string>("get_dashboard_key");
export const getSystemInfo = () => invoke<SystemInfo>("get_system_info");

// Dialog - pick a directory
export const pickDirectory = async (): Promise<string | null> => {
  const result = await open({ directory: true, multiple: false, title: "Select Working Directory" });
  if (typeof result === "string") return result;
  return null;
};
