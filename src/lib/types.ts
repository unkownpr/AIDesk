// === Enums ===

export type AgentType = "local" | "remote";
export type AgentStatus = "online" | "offline" | "busy" | "idle";
export type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed" | "cancelled";
export type Priority = "low" | "medium" | "high" | "critical";
export type LogType = "info" | "warn" | "error" | "debug" | "assistant" | "result" | "stderr";
export type Model = "sonnet" | "opus" | "haiku";
export type Page = "dashboard" | "tasks" | "agents" | "projects" | "activity" | "settings";

export type EntityType = "task" | "agent" | "secret" | "mcp" | "git" | "project" | "system";

// === Entities ===

export interface Agent {
  id: string;
  name: string;
  agent_type: AgentType;
  status: AgentStatus;
  token: string;
  working_directory: string | null;
  model: Model;
  max_turns: number;
  max_concurrent_tasks: number;
  allowed_tools: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigned_agent_id: string | null;
  parent_task_id: string | null;
  project_id: string | null;
  retry_count: number;
  max_retries: number;
  git_repo: string | null;
  git_branch: string | null;
  mcp_servers: string | null;
  result: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaudeStatus {
  installed: boolean;
  version: string | null;
  authenticated: boolean;
  auth_method: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  agent_id: string | null;
  log_type: LogType;
  message: string;
  metadata: string | null;
  created_at: string;
}

// === New Entities ===

export interface Secret {
  id: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface McpConfig {
  id: string;
  name: string;
  transport: "stdio" | "http" | "sse";
  url: string | null;
  command: string | null;
  args: string | null;
  env_vars: string | null;
  enabled: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string | null;
  git_repo: string | null;
  git_branch: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueInfo {
  positions: Record<string, number>;
  running_per_agent: Record<string, number>;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  created_at: string;
}

export interface ActivityLogResponse {
  logs: ActivityLog[];
  total: number;
}

export interface GitConfig {
  id: string;
  name: string;
  repo_url: string;
  default_branch: string;
  credentials_secret_id: string | null;
  created_at: string;
}
