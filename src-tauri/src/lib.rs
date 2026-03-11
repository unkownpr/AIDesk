pub mod agent;
pub mod api;
pub mod db;
pub mod orchestrator;
pub mod vault;

use db::models::{
    ActivityLog, AgentWithToken, CreateAgentRequest, CreateGitConfigRequest,
    CreateMcpConfigRequest, CreateProjectRequest, CreateTaskRequest, GitConfig, McpConfig,
    Project, Task, TaskLog, UpdateAgentRequest, UpdateProjectRequest, UpdateTaskRequest,
};
use db::Database;
use orchestrator::Orchestrator;
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
use tokio::sync::Mutex;

/// Find the `claude` binary by checking common install locations.
/// macOS GUI apps don't inherit shell PATH, so we search known paths.
fn find_claude_binary() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates = [
        format!("{}/.local/bin/claude", home),
        format!("{}/.claude/local/claude", home),
        "/usr/local/bin/claude".to_string(),
        "/opt/homebrew/bin/claude".to_string(),
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.clone();
        }
    }
    // Fallback to bare name (works if PATH happens to include it)
    "claude".to_string()
}

pub struct AppState {
    pub db: Arc<Database>,
    pub orchestrator: Arc<Mutex<Orchestrator>>,
}

/// Dashboard API key for authenticating internal HTTP requests (SSE, etc.)
#[derive(Clone)]
pub struct DashboardKey(pub String);

#[tauri::command]
async fn get_dashboard_key(key: tauri::State<'_, DashboardKey>) -> Result<String, String> {
    Ok(key.0.clone())
}

// === Task Commands ===

#[tauri::command]
async fn list_tasks(state: tauri::State<'_, AppState>) -> Result<Vec<Task>, String> {
    state.db.list_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_task(
    state: tauri::State<'_, AppState>,
    title: String,
    description: String,
    priority: Option<String>,
    project_id: Option<String>,
    max_retries: Option<i32>,
    git_repo: Option<String>,
    git_branch: Option<String>,
    assigned_agent_id: Option<String>,
) -> Result<Task, String> {
    // If project selected, auto-fill git info from project
    let (final_git_repo, final_git_branch) = if let Some(ref pid) = project_id {
        let project = state.db.get_project(pid).map_err(|e| e.to_string())?;
        (
            git_repo.or(project.git_repo),
            git_branch.or(project.git_branch),
        )
    } else {
        (git_repo, git_branch)
    };

    let req = CreateTaskRequest {
        title,
        description,
        priority,
        project_id,
        max_retries,
        git_repo: final_git_repo,
        git_branch: final_git_branch,
        mcp_servers: None,
        assigned_agent_id,
    };
    let task = state.db.create_task(&req).map_err(|e| e.to_string())?;
    state.db.add_activity("created", "task", Some(&task.id), Some(&task.title), Some(&format!("priority: {}", task.priority))).ok();
    Ok(task)
}

#[tauri::command]
async fn get_task(state: tauri::State<'_, AppState>, id: String) -> Result<Task, String> {
    state.db.get_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_task(
    state: tauri::State<'_, AppState>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    priority: Option<String>,
) -> Result<Task, String> {
    let req = UpdateTaskRequest {
        title,
        description,
        priority,
    };
    state.db.update_task(&id, &req).map_err(|e| e.to_string())
}

#[tauri::command]
async fn cancel_task(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let task = state.db.get_task(&id).map_err(|e| e.to_string())?;
    state.db.cancel_task(&id).map_err(|e| e.to_string())?;
    state.db.add_activity("cancelled", "task", Some(&id), Some(&task.title), None).ok();
    Ok(())
}

#[tauri::command]
async fn delete_task(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let task = state.db.get_task(&id).ok();
    state.db.delete_task(&id).map_err(|e| e.to_string())?;
    state.db.add_activity("deleted", "task", Some(&id), task.as_ref().map(|t| t.title.as_str()), None).ok();
    Ok(())
}

#[tauri::command]
async fn get_task_logs(
    state: tauri::State<'_, AppState>,
    task_id: String,
) -> Result<Vec<TaskLog>, String> {
    state.db.get_task_logs(&task_id).map_err(|e| e.to_string())
}

// === Agent Commands ===

#[tauri::command]
async fn list_agents(state: tauri::State<'_, AppState>) -> Result<Vec<AgentWithToken>, String> {
    state
        .db
        .list_agents()
        .map(|agents| agents.into_iter().map(AgentWithToken::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_agent(
    state: tauri::State<'_, AppState>,
    name: String,
    agent_type: Option<String>,
    working_directory: Option<String>,
    model: Option<String>,
    max_turns: Option<i32>,
    max_concurrent_tasks: Option<i32>,
) -> Result<AgentWithToken, String> {
    let agent_type_str = agent_type.as_deref().unwrap_or("local");

    let req = CreateAgentRequest {
        name,
        agent_type: Some(agent_type_str.to_string()),
        working_directory,
        model,
        max_turns,
        max_concurrent_tasks,
        allowed_tools: None,
    };

    let agent = state
        .db
        .create_agent(&req)
        .map_err(|e| e.to_string())?;

    state.db.add_activity("created", "agent", Some(&agent.id), Some(&agent.name), Some(&format!("type: {}, model: {}", agent.agent_type, agent.model))).ok();

    if agent.agent_type == "local" {
        state
            .db
            .update_agent_heartbeat(&agent.id, "online")
            .map_err(|e| e.to_string())?;
        return state
            .db
            .get_agent(&agent.id)
            .map(AgentWithToken::from)
            .map_err(|e| e.to_string());
    }

    Ok(AgentWithToken::from(agent))
}

#[tauri::command]
async fn update_agent(
    state: tauri::State<'_, AppState>,
    id: String,
    name: Option<String>,
    working_directory: Option<String>,
    model: Option<String>,
    max_turns: Option<i32>,
    max_concurrent_tasks: Option<i32>,
) -> Result<AgentWithToken, String> {
    if let Some(ref dir) = working_directory {
        if !std::path::Path::new(dir).is_dir() {
            return Err(format!("Directory does not exist: {}", dir));
        }
    }

    let req = UpdateAgentRequest {
        name,
        working_directory,
        model,
        max_turns,
        max_concurrent_tasks,
    };

    state
        .db
        .update_agent(&id, &req)
        .map(AgentWithToken::from)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_agent(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let agent = state.db.get_agent(&id).ok();
    state.db.delete_agent(&id).map_err(|e| e.to_string())?;
    state.db.add_activity("deleted", "agent", Some(&id), agent.as_ref().map(|a| a.name.as_str()), None).ok();
    Ok(())
}

// === Secret Commands ===

#[tauri::command]
async fn list_secrets(state: tauri::State<'_, AppState>) -> Result<Vec<SecretInfo>, String> {
    let secrets = state.db.list_secrets().map_err(|e| e.to_string())?;
    // Return without encrypted values
    Ok(secrets
        .into_iter()
        .map(|s| SecretInfo {
            id: s.id,
            name: s.name,
            category: s.category,
            created_at: s.created_at,
            updated_at: s.updated_at,
        })
        .collect())
}

#[derive(serde::Serialize)]
struct SecretInfo {
    id: String,
    name: String,
    category: String,
    created_at: String,
    updated_at: String,
}

#[tauri::command]
async fn create_secret(
    state: tauri::State<'_, AppState>,
    name: String,
    value: String,
    category: Option<String>,
) -> Result<SecretInfo, String> {
    let encrypted = vault::encrypt_secret(&value);
    let cat = category.as_deref().unwrap_or("general");
    let sec = state
        .db
        .create_secret(&name, &encrypted, cat)
        .map_err(|e| e.to_string())?;
    state.db.add_activity("created", "secret", Some(&sec.id), Some(&sec.name), Some(&format!("category: {}", sec.category))).ok();
    Ok(SecretInfo {
        id: sec.id,
        name: sec.name,
        category: sec.category,
        created_at: sec.created_at,
        updated_at: sec.updated_at,
    })
}

#[tauri::command]
async fn get_secret_value(state: tauri::State<'_, AppState>, id: String) -> Result<String, String> {
    let secret = state.db.get_secret(&id).map_err(|e| e.to_string())?;
    vault::decrypt_secret(&secret.encrypted_value)
}

#[tauri::command]
async fn delete_secret(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let secret = state.db.get_secret(&id).ok();
    state.db.delete_secret(&id).map_err(|e| e.to_string())?;
    state.db.add_activity("deleted", "secret", Some(&id), secret.as_ref().map(|s| s.name.as_str()), None).ok();
    Ok(())
}

// === MCP Config Commands ===

#[tauri::command]
async fn list_mcp_configs(state: tauri::State<'_, AppState>) -> Result<Vec<McpConfig>, String> {
    state.db.list_mcp_configs().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_mcp_config(
    state: tauri::State<'_, AppState>,
    name: String,
    transport: String,
    url: Option<String>,
    command: Option<String>,
    args: Option<String>,
    env_vars: Option<String>,
) -> Result<McpConfig, String> {
    let req = CreateMcpConfigRequest {
        name,
        transport,
        url,
        command,
        args,
        env_vars,
    };
    state.db.create_mcp_config(&req).map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_mcp_config(
    state: tauri::State<'_, AppState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    state
        .db
        .toggle_mcp_config(&id, enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_mcp_config(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_mcp_config(&id).map_err(|e| e.to_string())
}

// === Git Config Commands ===

#[tauri::command]
async fn list_git_configs(state: tauri::State<'_, AppState>) -> Result<Vec<GitConfig>, String> {
    state.db.list_git_configs().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_git_config(
    state: tauri::State<'_, AppState>,
    name: String,
    repo_url: String,
    default_branch: Option<String>,
    credentials_secret_id: Option<String>,
) -> Result<GitConfig, String> {
    let req = CreateGitConfigRequest {
        name,
        repo_url,
        default_branch,
        credentials_secret_id,
    };
    state.db.create_git_config(&req).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_git_config(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_git_config(&id).map_err(|e| e.to_string())
}

// === Queue Commands ===

#[tauri::command]
async fn retry_task(state: tauri::State<'_, AppState>, id: String) -> Result<Task, String> {
    let task = state.db.retry_task(&id).map_err(|_| "Can only retry failed tasks".to_string())?;
    state.db.add_activity("retried", "task", Some(&id), Some(&task.title), Some(&format!("retry #{}", task.retry_count))).ok();
    Ok(task)
}

#[tauri::command]
async fn get_queue_info(state: tauri::State<'_, AppState>) -> Result<QueueInfo, String> {
    let positions = state.db.get_queue_info().map_err(|e| e.to_string())?;
    let task_counts = state.db.count_running_tasks_per_agent().unwrap_or_default();
    Ok(QueueInfo { positions, running_per_agent: task_counts })
}

#[derive(serde::Serialize)]
struct QueueInfo {
    positions: std::collections::HashMap<String, i64>,
    running_per_agent: std::collections::HashMap<String, i64>,
}

// === Project Commands ===

#[tauri::command]
async fn list_projects(state: tauri::State<'_, AppState>) -> Result<Vec<Project>, String> {
    state.db.list_projects().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_project(
    state: tauri::State<'_, AppState>,
    name: String,
    path: String,
    description: Option<String>,
    git_repo: Option<String>,
    git_branch: Option<String>,
) -> Result<Project, String> {
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Directory does not exist: {}", path));
    }
    let req = CreateProjectRequest {
        name,
        path,
        description,
        git_repo,
        git_branch,
    };
    let project = state.db.create_project(&req).map_err(|e| e.to_string())?;
    state.db.add_activity("created", "project", Some(&project.id), Some(&project.name), None).ok();
    Ok(project)
}

#[tauri::command]
async fn update_project(
    state: tauri::State<'_, AppState>,
    id: String,
    name: Option<String>,
    path: Option<String>,
    description: Option<String>,
    git_repo: Option<String>,
    git_branch: Option<String>,
) -> Result<Project, String> {
    if let Some(ref p) = path {
        if !std::path::Path::new(p).is_dir() {
            return Err(format!("Directory does not exist: {}", p));
        }
    }
    let req = UpdateProjectRequest {
        name,
        path,
        description,
        git_repo,
        git_branch,
    };
    state.db.update_project(&id, &req).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_project(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let project = state.db.get_project(&id).ok();
    state.db.delete_project(&id).map_err(|e| e.to_string())?;
    state.db.add_activity("deleted", "project", Some(&id), project.as_ref().map(|p| p.name.as_str()), None).ok();
    Ok(())
}

#[tauri::command]
async fn get_project(state: tauri::State<'_, AppState>, id: String) -> Result<Project, String> {
    state.db.get_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_tasks_by_project(state: tauri::State<'_, AppState>, project_id: String) -> Result<Vec<Task>, String> {
    state.db.list_tasks_by_project(&project_id).map_err(|e| e.to_string())
}

// === Project Stats Commands ===

#[derive(serde::Serialize)]
struct ProjectTaskStats {
    active_count: i64,
    total_count: i64,
}

#[tauri::command]
async fn get_project_stats(
    state: tauri::State<'_, AppState>,
) -> Result<std::collections::HashMap<String, ProjectTaskStats>, String> {
    let raw = state.db.count_tasks_per_project().map_err(|e| e.to_string())?;
    Ok(raw
        .into_iter()
        .map(|(id, (active, total))| {
            (id, ProjectTaskStats { active_count: active, total_count: total })
        })
        .collect())
}

// === Activity Log Commands ===

#[tauri::command]
async fn list_activity_logs(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
    entity_type: Option<String>,
) -> Result<ActivityLogResponse, String> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);
    let et = entity_type.as_deref();
    let logs = state.db.list_activity_logs(lim, off, et).map_err(|e| e.to_string())?;
    let total = state.db.count_activity_logs(et).map_err(|e| e.to_string())?;
    Ok(ActivityLogResponse { logs, total })
}

#[derive(serde::Serialize)]
struct ActivityLogResponse {
    logs: Vec<ActivityLog>,
    total: i64,
}

// === System Commands ===

#[tauri::command]
async fn trigger_orchestrator(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let orch = state.orchestrator.lock().await;
    orch.tick().await;
    Ok(())
}

#[derive(serde::Serialize)]
pub struct ClaudeStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub authenticated: bool,
    pub auth_method: Option<String>,
}

#[tauri::command]
async fn check_claude_status() -> Result<ClaudeStatus, String> {
    let claude_bin = find_claude_binary();

    let mut cmd = tokio::process::Command::new(&claude_bin);
    cmd.env_remove("CLAUDECODE");
    cmd.arg("--version");
    let version_result = cmd.output().await;

    let (installed, version) = match version_result {
        Ok(output) if output.status.success() => {
            let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(v))
        }
        _ => (false, None),
    };

    if !installed {
        return Ok(ClaudeStatus {
            installed: false,
            version: None,
            authenticated: false,
            auth_method: None,
        });
    }

    let mut auth_cmd = tokio::process::Command::new(&claude_bin);
    auth_cmd.env_remove("CLAUDECODE");
    auth_cmd.args(["auth", "status"]);
    let auth_result = auth_cmd.output().await;

    let (authenticated, auth_method) = match auth_result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = format!("{}{}", stdout, stderr);

            let is_auth = output.status.success()
                || combined.contains("Logged in")
                || combined.contains("authenticated")
                || combined.contains("API key");

            let method = if combined.contains("API key") || combined.contains("ANTHROPIC_API_KEY") {
                Some("API Key".to_string())
            } else if combined.contains("Max") || combined.contains("Pro") {
                Some("Subscription (Max/Pro)".to_string())
            } else if is_auth {
                Some("Claude.ai".to_string())
            } else {
                None
            };

            (is_auth, method)
        }
        Err(_) => (false, None),
    };

    Ok(ClaudeStatus {
        installed,
        version,
        authenticated,
        auth_method,
    })
}

#[derive(serde::Serialize)]
struct SystemInfo {
    hostname: String,
    local_ip: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let hostname = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "localhost".to_string());

    // Find the first non-loopback IPv4 address
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string());

    SystemInfo { hostname, local_ip }
}

// === App Entry Point ===

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Custom macOS menu with About metadata
            let icon_bytes = include_bytes!("../icons/128x128.png");
            let icon = tauri::image::Image::from_bytes(icon_bytes).expect("Failed to load app icon");

            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("AIDesk".to_string()))
                .version(Some("0.1.0".to_string()))
                .copyright(Some("© 2026 ssilistre.dev".to_string()))
                .authors(Some(vec!["ssilistre.dev".to_string()]))
                .comments(Some("AI agent'larınızı tek panelden yönetin.\nGörev atayın, logları izleyin, MCP ve Git entegrasyonlarını yapılandırın.".to_string()))
                .website(Some("https://ssilistre.dev".to_string()))
                .icon(Some(icon))
                .build();

            let app_menu = SubmenuBuilder::new(app, "AIDesk")
                .about(Some(about_metadata))
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            // Initialize encrypted vault
            vault::init(&data_dir).expect("Failed to initialize vault");

            let db = Arc::new(
                Database::new(&data_dir).expect("Failed to initialize database"),
            );
            let orchestrator = Arc::new(Mutex::new(
                Orchestrator::new(db.clone()).with_app_handle(app.handle().clone())
            ));

            // Mark all local agents as online at startup
            if let Ok(agents) = db.list_agents() {
                for agent in agents {
                    if agent.agent_type == "local" {
                        db.update_agent_heartbeat(&agent.id, "online").ok();
                    }
                }
            }

            // Generate dashboard API key for internal auth
            let dashboard_key = uuid::Uuid::new_v4().to_string();
            app.manage(DashboardKey(dashboard_key.clone()));

            // Start API server for remote agents
            let api_db = db.clone();
            let api_key = dashboard_key.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = api::start_api_server(api_db, 3939, api_key, true).await {
                    tracing::error!("API server failed: {}", e);
                }
            });

            // Orchestrator tick loop
            let orch = orchestrator.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
                loop {
                    interval.tick().await;
                    let o = orch.lock().await;
                    o.tick().await;
                }
            });

            app.manage(AppState { db, orchestrator });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tasks
            list_tasks,
            create_task,
            get_task,
            update_task,
            cancel_task,
            delete_task,
            get_task_logs,
            // Agents
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            // Secrets
            list_secrets,
            create_secret,
            get_secret_value,
            delete_secret,
            // MCP
            list_mcp_configs,
            create_mcp_config,
            toggle_mcp_config,
            delete_mcp_config,
            // Git
            list_git_configs,
            create_git_config,
            delete_git_config,
            // Queue
            retry_task,
            get_queue_info,
            // Projects
            list_projects,
            get_project,
            create_project,
            update_project,
            delete_project,
            list_tasks_by_project,
            get_project_stats,
            // Activity
            list_activity_logs,
            // System
            trigger_orchestrator,
            check_claude_status,
            get_dashboard_key,
            get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AIDesk");
}
