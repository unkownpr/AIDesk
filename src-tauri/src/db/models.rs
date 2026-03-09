use serde::{Deserialize, Serialize};

// === Enums ===

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentType {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Online,
    Offline,
    Busy,
    Idle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Assigned,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Model {
    Sonnet,
    Opus,
    Haiku,
}

// === Entities ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub agent_type: String,
    pub status: String,
    #[serde(skip_serializing)]
    pub token: String,
    pub working_directory: Option<String>,
    pub model: String,
    pub max_turns: i32,
    pub max_concurrent_tasks: i32,
    pub allowed_tools: Option<String>,
    pub last_heartbeat: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Agent with token visible - only for Tauri commands (local UI)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentWithToken {
    pub id: String,
    pub name: String,
    pub agent_type: String,
    pub status: String,
    pub token: String,
    pub working_directory: Option<String>,
    pub model: String,
    pub max_turns: i32,
    pub max_concurrent_tasks: i32,
    pub allowed_tools: Option<String>,
    pub last_heartbeat: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Agent> for AgentWithToken {
    fn from(a: Agent) -> Self {
        Self {
            id: a.id,
            name: a.name,
            agent_type: a.agent_type,
            status: a.status,
            token: a.token,
            working_directory: a.working_directory,
            model: a.model,
            max_turns: a.max_turns,
            max_concurrent_tasks: a.max_concurrent_tasks,
            allowed_tools: a.allowed_tools,
            last_heartbeat: a.last_heartbeat,
            created_at: a.created_at,
            updated_at: a.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub assigned_agent_id: Option<String>,
    pub parent_task_id: Option<String>,
    pub project_id: Option<String>,
    pub retry_count: i32,
    pub max_retries: i32,
    pub git_repo: Option<String>,
    pub git_branch: Option<String>,
    pub mcp_servers: Option<String>,
    pub result: Option<String>,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskLog {
    pub id: String,
    pub task_id: String,
    pub agent_id: Option<String>,
    pub log_type: String,
    pub message: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

// === DTOs ===

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: String,
    pub priority: Option<String>,
    pub project_id: Option<String>,
    pub max_retries: Option<i32>,
    pub git_repo: Option<String>,
    pub git_branch: Option<String>,
    pub mcp_servers: Option<Vec<String>>,
    pub assigned_agent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub agent_type: Option<String>,
    pub working_directory: Option<String>,
    pub model: Option<String>,
    pub max_turns: Option<i32>,
    pub max_concurrent_tasks: Option<i32>,
    pub allowed_tools: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AgentHeartbeat {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct TaskResultReport {
    pub task_id: String,
    pub status: String,
    pub result: Option<String>,
    pub error: Option<String>,
    pub logs: Option<Vec<TaskLogEntry>>,
}

#[derive(Debug, Deserialize)]
pub struct TaskLogEntry {
    pub log_type: String,
    pub message: String,
    pub metadata: Option<String>,
}

/// Single log entry sent by remote agent during task execution
#[derive(Debug, Deserialize)]
pub struct AgentLogEntry {
    pub task_id: String,
    pub log_type: String,
    pub message: String,
    pub metadata: Option<String>,
}

// === Secret ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Secret {
    pub id: String,
    pub name: String,
    pub encrypted_value: String,
    pub category: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSecretRequest {
    pub name: String,
    pub value: String,
    pub category: Option<String>,
}

// === MCP Config ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub url: Option<String>,
    pub command: Option<String>,
    pub args: Option<String>,
    pub env_vars: Option<String>,
    pub enabled: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMcpConfigRequest {
    pub name: String,
    pub transport: String,
    pub url: Option<String>,
    pub command: Option<String>,
    pub args: Option<String>,
    pub env_vars: Option<String>,
}

// === Git Config ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitConfig {
    pub id: String,
    pub name: String,
    pub repo_url: String,
    pub default_branch: String,
    pub credentials_secret_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGitConfigRequest {
    pub name: String,
    pub repo_url: String,
    pub default_branch: Option<String>,
    pub credentials_secret_id: Option<String>,
}

// === Project ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub git_repo: Option<String>,
    pub git_branch: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub git_repo: Option<String>,
    pub git_branch: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub path: Option<String>,
    pub description: Option<String>,
    pub git_repo: Option<String>,
    pub git_branch: Option<String>,
}

// === Activity Log ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub entity_name: Option<String>,
    pub details: Option<String>,
    pub created_at: String,
}

// === Update DTOs ===
#[derive(Debug, Deserialize)]
pub struct UpdateAgentRequest {
    pub name: Option<String>,
    pub working_directory: Option<String>,
    pub model: Option<String>,
    pub max_turns: Option<i32>,
    pub max_concurrent_tasks: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
}
