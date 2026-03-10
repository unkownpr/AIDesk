use std::collections::HashMap;

use super::models::*;
use super::Database;
use rusqlite::{params, Result as SqlResult};
use uuid::Uuid;

// === Row mapper helpers ===

fn row_to_agent(row: &rusqlite::Row) -> rusqlite::Result<Agent> {
    Ok(Agent {
        id: row.get(0)?,
        name: row.get(1)?,
        agent_type: row.get(2)?,
        status: row.get(3)?,
        token: row.get(4)?,
        working_directory: row.get(5)?,
        model: row.get(6)?,
        max_turns: row.get(7)?,
        max_concurrent_tasks: row.get(8)?,
        allowed_tools: row.get(9)?,
        last_heartbeat: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        assigned_agent_id: row.get(5)?,
        parent_task_id: row.get(6)?,
        project_id: row.get(7)?,
        retry_count: row.get(8)?,
        max_retries: row.get(9)?,
        git_repo: row.get(10)?,
        git_branch: row.get(11)?,
        mcp_servers: row.get(12)?,
        result: row.get(13)?,
        error: row.get(14)?,
        started_at: row.get(15)?,
        completed_at: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

const AGENT_COLUMNS: &str =
    "id, name, agent_type, status, token, working_directory, model, max_turns, \
     max_concurrent_tasks, allowed_tools, last_heartbeat, created_at, updated_at";

const TASK_COLUMNS: &str =
    "id, title, description, status, priority, assigned_agent_id, parent_task_id, \
     project_id, retry_count, max_retries, git_repo, git_branch, mcp_servers, result, error, \
     started_at, completed_at, created_at, updated_at";

impl Database {
    // === Agents ===

    pub fn create_agent(&self, req: &CreateAgentRequest) -> SqlResult<Agent> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        let token = format!("adk_{}", Uuid::new_v4().to_string().replace('-', ""));
        let allowed_tools = req
            .allowed_tools
            .as_ref()
            .map(|t| serde_json::to_string(t).unwrap_or_default());

        conn.execute(
            "INSERT INTO agents (id, name, agent_type, token, working_directory, model, max_turns, max_concurrent_tasks, allowed_tools)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                req.name,
                req.agent_type.as_deref().unwrap_or("local"),
                token,
                req.working_directory,
                req.model.as_deref().unwrap_or("sonnet"),
                req.max_turns.unwrap_or(50),
                req.max_concurrent_tasks.unwrap_or(1),
                allowed_tools,
            ],
        )?;

        conn.query_row(
            &format!("SELECT {AGENT_COLUMNS} FROM agents WHERE id = ?1"),
            params![id],
            row_to_agent,
        )
    }

    pub fn get_agent(&self, id: &str) -> SqlResult<Agent> {
        let conn = self.conn();
        conn.query_row(
            &format!("SELECT {AGENT_COLUMNS} FROM agents WHERE id = ?1"),
            params![id],
            row_to_agent,
        )
    }

    pub fn get_agent_by_token(&self, token: &str) -> SqlResult<Agent> {
        let conn = self.conn();
        conn.query_row(
            &format!("SELECT {AGENT_COLUMNS} FROM agents WHERE token = ?1"),
            params![token],
            row_to_agent,
        )
    }

    pub fn list_agents(&self) -> SqlResult<Vec<Agent>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            &format!("SELECT {AGENT_COLUMNS} FROM agents ORDER BY created_at DESC"),
        )?;
        let result = stmt.query_map([], row_to_agent)?
            .collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn update_agent_heartbeat(&self, id: &str, status: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE agents SET status = ?1, last_heartbeat = datetime('now'), updated_at = datetime('now')
             WHERE id = ?2",
            params![status, id],
        )?;
        Ok(())
    }

    /// Check if a heartbeat timestamp is older than `timeout_secs` seconds
    pub fn is_heartbeat_stale(&self, heartbeat: &str, timeout_secs: i64) -> bool {
        let conn = self.conn();
        conn.query_row(
            "SELECT (strftime('%s', 'now') - strftime('%s', ?1)) > ?2",
            params![heartbeat, timeout_secs],
            |row| row.get::<_, bool>(0),
        )
        .unwrap_or(true)
    }

    pub fn delete_agent(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        // ON DELETE SET NULL handles tasks.assigned_agent_id
        conn.execute("DELETE FROM agents WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === Tasks ===

    pub fn create_task(&self, req: &CreateTaskRequest) -> SqlResult<Task> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        let mcp_servers = req
            .mcp_servers
            .as_ref()
            .map(|s| serde_json::to_string(s).unwrap_or_default());

        conn.execute(
            "INSERT INTO tasks (id, title, description, priority, project_id, max_retries, git_repo, git_branch, mcp_servers, assigned_agent_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id,
                req.title,
                req.description,
                req.priority.as_deref().unwrap_or("medium"),
                req.project_id,
                req.max_retries.unwrap_or(0),
                req.git_repo,
                req.git_branch,
                mcp_servers,
                req.assigned_agent_id,
            ],
        )?;

        conn.query_row(
            &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
            params![id],
            row_to_task,
        )
    }

    pub fn get_task(&self, id: &str) -> SqlResult<Task> {
        let conn = self.conn();
        conn.query_row(
            &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
            params![id],
            row_to_task,
        )
    }

    pub fn list_tasks(&self) -> SqlResult<Vec<Task>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            &format!("SELECT {TASK_COLUMNS} FROM tasks ORDER BY created_at DESC"),
        )?;
        let result = stmt.query_map([], row_to_task)?
            .collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn get_pending_tasks(&self) -> SqlResult<Vec<Task>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            &format!(
                "SELECT {TASK_COLUMNS} FROM tasks WHERE status = 'pending'
                 ORDER BY
                    CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                    created_at ASC"
            ),
        )?;
        let result = stmt.query_map([], row_to_task)?
            .collect::<SqlResult<Vec<_>>>();
        result
    }

    /// Atomically assign a task to an agent. Returns false if task was already assigned.
    pub fn try_assign_task(&self, task_id: &str, agent_id: &str) -> SqlResult<bool> {
        let conn = self.conn();
        let updated = conn.execute(
            "UPDATE tasks SET assigned_agent_id = ?1, status = 'assigned', updated_at = datetime('now')
             WHERE id = ?2 AND status = 'pending'",
            params![agent_id, task_id],
        )?;
        Ok(updated > 0)
    }

    pub fn update_task_status(
        &self,
        task_id: &str,
        status: &str,
        result: Option<&str>,
        error: Option<&str>,
    ) -> SqlResult<()> {
        let conn = self.conn();
        match status {
            "running" => {
                conn.execute(
                    "UPDATE tasks SET status = ?1, started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?2",
                    params![status, task_id],
                )?;
            }
            "completed" | "failed" | "cancelled" => {
                conn.execute(
                    "UPDATE tasks SET status = ?1, result = ?2, error = ?3, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?4",
                    params![status, result, error, task_id],
                )?;
            }
            _ => {
                conn.execute(
                    "UPDATE tasks SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
                    params![status, task_id],
                )?;
            }
        }
        Ok(())
    }

    pub fn delete_task(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        // task_logs has ON DELETE CASCADE, so only need to delete the task
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Verify a task is assigned to a specific agent
    pub fn is_task_owned_by_agent(&self, task_id: &str, agent_id: &str) -> SqlResult<bool> {
        let conn = self.conn();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE id = ?1 AND assigned_agent_id = ?2",
            params![task_id, agent_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    /// Count running tasks per agent (for load balancing)
    pub fn count_running_tasks_per_agent(&self) -> SqlResult<HashMap<String, i64>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT assigned_agent_id, COUNT(*) FROM tasks
             WHERE status IN ('assigned', 'running') AND assigned_agent_id IS NOT NULL
             GROUP BY assigned_agent_id",
        )?;
        let mut map = HashMap::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (id, count) = row?;
            map.insert(id, count);
        }
        Ok(map)
    }

    // === Task Logs ===

    pub fn add_task_log(
        &self,
        task_id: &str,
        agent_id: Option<&str>,
        log_type: &str,
        message: &str,
        metadata: Option<&str>,
    ) -> SqlResult<()> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO task_logs (id, task_id, agent_id, log_type, message, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, task_id, agent_id, log_type, message, metadata],
        )?;
        Ok(())
    }

    pub fn get_task_logs(&self, task_id: &str) -> SqlResult<Vec<TaskLog>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, task_id, agent_id, log_type, message, metadata, created_at
             FROM task_logs WHERE task_id = ?1 ORDER BY created_at ASC",
        )?;
        let result = stmt.query_map(params![task_id], |row| {
            Ok(TaskLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                agent_id: row.get(2)?,
                log_type: row.get(3)?,
                message: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>();
        result
    }

    /// Get logs newer than the given log ID (for SSE streaming)
    pub fn get_task_logs_after(&self, task_id: &str, after_id: Option<&str>) -> SqlResult<Vec<TaskLog>> {
        let conn = self.conn();
        match after_id {
            Some(aid) => {
                let mut stmt = conn.prepare(
                    "SELECT id, task_id, agent_id, log_type, message, metadata, created_at
                     FROM task_logs
                     WHERE task_id = ?1 AND created_at > (SELECT created_at FROM task_logs WHERE id = ?2)
                     ORDER BY created_at ASC",
                )?;
                let result = stmt.query_map(params![task_id, aid], |row| {
                    Ok(TaskLog {
                        id: row.get(0)?,
                        task_id: row.get(1)?,
                        agent_id: row.get(2)?,
                        log_type: row.get(3)?,
                        message: row.get(4)?,
                        metadata: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                })?.collect::<SqlResult<Vec<_>>>();
                result
            }
            None => self.get_task_logs(task_id),
        }
    }

    // === Agent Update ===

    pub fn update_agent(&self, id: &str, req: &UpdateAgentRequest) -> SqlResult<Agent> {
        let conn = self.conn();
        let agent = self.get_agent(id)?;

        let name = req.name.as_deref().unwrap_or(&agent.name);
        let working_directory = req.working_directory.as_ref().or(agent.working_directory.as_ref());
        let model = req.model.as_deref().unwrap_or(&agent.model);
        let max_turns = req.max_turns.unwrap_or(agent.max_turns);
        let max_concurrent = req.max_concurrent_tasks.unwrap_or(agent.max_concurrent_tasks);

        conn.execute(
            "UPDATE agents SET name = ?1, working_directory = ?2, model = ?3, max_turns = ?4, max_concurrent_tasks = ?5, updated_at = datetime('now') WHERE id = ?6",
            params![name, working_directory, model, max_turns, max_concurrent, id],
        )?;

        self.get_agent(id)
    }

    // === Task Update ===

    pub fn update_task(&self, id: &str, req: &UpdateTaskRequest) -> SqlResult<Task> {
        let conn = self.conn();
        let task = self.get_task(id)?;

        // Only allow updates on pending tasks
        if task.status != "pending" {
            return Err(rusqlite::Error::QueryReturnedNoRows); // hack for "not allowed"
        }

        let title = req.title.as_deref().unwrap_or(&task.title);
        let description = req.description.as_deref().unwrap_or(&task.description);
        let priority = req.priority.as_deref().unwrap_or(&task.priority);

        conn.execute(
            "UPDATE tasks SET title = ?1, description = ?2, priority = ?3, updated_at = datetime('now') WHERE id = ?4 AND status = 'pending'",
            params![title, description, priority, id],
        )?;

        self.get_task(id)
    }

    pub fn cancel_task(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE tasks SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1 AND status IN ('pending', 'assigned', 'running')",
            params![id],
        )?;
        Ok(())
    }

    // === Secrets ===

    pub fn create_secret(&self, name: &str, encrypted_value: &str, category: &str) -> SqlResult<Secret> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO secrets (id, name, encrypted_value, category) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, encrypted_value, category],
        )?;
        self.get_secret(&id)
    }

    pub fn get_secret(&self, id: &str) -> SqlResult<Secret> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, name, encrypted_value, category, created_at, updated_at FROM secrets WHERE id = ?1",
            params![id],
            |row| Ok(Secret {
                id: row.get(0)?,
                name: row.get(1)?,
                encrypted_value: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }),
        )
    }

    pub fn list_secrets(&self) -> SqlResult<Vec<Secret>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, encrypted_value, category, created_at, updated_at FROM secrets ORDER BY name ASC",
        )?;
        let result = stmt.query_map([], |row| Ok(Secret {
            id: row.get(0)?,
            name: row.get(1)?,
            encrypted_value: row.get(2)?,
            category: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }))?.collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn update_secret(&self, id: &str, encrypted_value: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE secrets SET encrypted_value = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![encrypted_value, id],
        )?;
        Ok(())
    }

    pub fn delete_secret(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM secrets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === MCP Configs ===

    pub fn create_mcp_config(&self, req: &CreateMcpConfigRequest) -> SqlResult<McpConfig> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO mcp_configs (id, name, transport, url, command, args, env_vars) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, req.name, req.transport, req.url, req.command, req.args, req.env_vars],
        )?;
        self.get_mcp_config(&id)
    }

    pub fn get_mcp_config(&self, id: &str) -> SqlResult<McpConfig> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, name, transport, url, command, args, env_vars, enabled, created_at FROM mcp_configs WHERE id = ?1",
            params![id],
            |row| Ok(McpConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                transport: row.get(2)?,
                url: row.get(3)?,
                command: row.get(4)?,
                args: row.get(5)?,
                env_vars: row.get(6)?,
                enabled: row.get(7)?,
                created_at: row.get(8)?,
            }),
        )
    }

    pub fn list_mcp_configs(&self) -> SqlResult<Vec<McpConfig>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, transport, url, command, args, env_vars, enabled, created_at FROM mcp_configs ORDER BY name ASC",
        )?;
        let result = stmt.query_map([], |row| Ok(McpConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            transport: row.get(2)?,
            url: row.get(3)?,
            command: row.get(4)?,
            args: row.get(5)?,
            env_vars: row.get(6)?,
            enabled: row.get(7)?,
            created_at: row.get(8)?,
        }))?.collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn toggle_mcp_config(&self, id: &str, enabled: bool) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE mcp_configs SET enabled = ?1 WHERE id = ?2",
            params![enabled, id],
        )?;
        Ok(())
    }

    pub fn delete_mcp_config(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM mcp_configs WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === Git Configs ===

    pub fn create_git_config(&self, req: &CreateGitConfigRequest) -> SqlResult<GitConfig> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO git_configs (id, name, repo_url, default_branch, credentials_secret_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, req.name, req.repo_url, req.default_branch.as_deref().unwrap_or("main"), req.credentials_secret_id],
        )?;
        self.get_git_config(&id)
    }

    pub fn get_git_config(&self, id: &str) -> SqlResult<GitConfig> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, name, repo_url, default_branch, credentials_secret_id, created_at FROM git_configs WHERE id = ?1",
            params![id],
            |row| Ok(GitConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                repo_url: row.get(2)?,
                default_branch: row.get(3)?,
                credentials_secret_id: row.get(4)?,
                created_at: row.get(5)?,
            }),
        )
    }

    pub fn list_git_configs(&self) -> SqlResult<Vec<GitConfig>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, repo_url, default_branch, credentials_secret_id, created_at FROM git_configs ORDER BY name ASC",
        )?;
        let result = stmt.query_map([], |row| Ok(GitConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            repo_url: row.get(2)?,
            default_branch: row.get(3)?,
            credentials_secret_id: row.get(4)?,
            created_at: row.get(5)?,
        }))?.collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn delete_git_config(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM git_configs WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Retry a failed task — reset to pending and increment retry_count
    pub fn retry_task(&self, id: &str) -> SqlResult<Task> {
        let conn = self.conn();
        let task = self.get_task(id)?;
        if task.status != "failed" {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        conn.execute(
            "UPDATE tasks SET status = 'pending', assigned_agent_id = NULL, result = NULL, error = NULL, \
             started_at = NULL, completed_at = NULL, retry_count = retry_count + 1, \
             updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        self.get_task(id)
    }

    /// Get queue position for a pending task (1-based, by priority then created_at)
    pub fn get_queue_position(&self, task_id: &str) -> SqlResult<Option<i64>> {
        let conn = self.conn();
        let position: Option<i64> = conn.query_row(
            "SELECT COUNT(*) + 1 FROM tasks WHERE status = 'pending'
             AND (
                 CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                 created_at
             ) < (
                 SELECT CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                        created_at
                 FROM tasks WHERE id = ?1
             )",
            params![task_id],
            |row| row.get(0),
        ).ok();
        Ok(position)
    }

    /// Get queue info: pending count and map of task_id -> position
    pub fn get_queue_info(&self) -> SqlResult<HashMap<String, i64>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id FROM tasks WHERE status = 'pending'
             ORDER BY
                CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                created_at ASC",
        )?;
        let mut map = HashMap::new();
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        for (i, row) in rows.enumerate() {
            if let Ok(id) = row {
                map.insert(id, (i + 1) as i64);
            }
        }
        Ok(map)
    }

    // === Projects ===

    pub fn create_project(&self, req: &CreateProjectRequest) -> SqlResult<Project> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO projects (id, name, path, description, git_repo, git_branch) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, req.name, req.path, req.description, req.git_repo, req.git_branch.as_deref().unwrap_or("main")],
        )?;
        self.get_project(&id)
    }

    pub fn get_project(&self, id: &str) -> SqlResult<Project> {
        let conn = self.conn();
        conn.query_row(
            "SELECT id, name, path, description, git_repo, git_branch, analysis, analysis_updated_at, created_at, updated_at FROM projects WHERE id = ?1",
            params![id],
            |row| Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                description: row.get(3)?,
                git_repo: row.get(4)?,
                git_branch: row.get(5)?,
                analysis: row.get(6)?,
                analysis_updated_at: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            }),
        )
    }

    pub fn list_projects(&self) -> SqlResult<Vec<Project>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, path, description, git_repo, git_branch, analysis, analysis_updated_at, created_at, updated_at FROM projects ORDER BY name ASC",
        )?;
        let result = stmt.query_map([], |row| Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            description: row.get(3)?,
            git_repo: row.get(4)?,
            git_branch: row.get(5)?,
            analysis: row.get(6)?,
            analysis_updated_at: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        }))?.collect::<SqlResult<Vec<_>>>();
        result
    }

    pub fn update_project(&self, id: &str, req: &UpdateProjectRequest) -> SqlResult<Project> {
        let conn = self.conn();
        let project = self.get_project(id)?;

        let name = req.name.as_deref().unwrap_or(&project.name);
        let path = req.path.as_deref().unwrap_or(&project.path);
        let description = req.description.as_ref().or(project.description.as_ref());
        let git_repo = req.git_repo.as_ref().or(project.git_repo.as_ref());
        let git_branch = req.git_branch.as_ref().or(project.git_branch.as_ref());

        conn.execute(
            "UPDATE projects SET name = ?1, path = ?2, description = ?3, git_repo = ?4, git_branch = ?5, updated_at = datetime('now') WHERE id = ?6",
            params![name, path, description, git_repo, git_branch, id],
        )?;

        self.get_project(id)
    }

    pub fn update_project_analysis(&self, id: &str, analysis: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute(
            "UPDATE projects SET analysis = ?1, analysis_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?2",
            params![analysis, id],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// List tasks for a specific project
    pub fn list_tasks_by_project(&self, project_id: &str) -> SqlResult<Vec<Task>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE project_id = ?1 ORDER BY created_at DESC"),
        )?;
        let result = stmt.query_map(params![project_id], row_to_task)?
            .collect::<SqlResult<Vec<_>>>();
        result
    }

    // === Activity Logs ===

    pub fn add_activity(
        &self,
        action: &str,
        entity_type: &str,
        entity_id: Option<&str>,
        entity_name: Option<&str>,
        details: Option<&str>,
    ) -> SqlResult<()> {
        let conn = self.conn();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO activity_logs (id, action, entity_type, entity_id, entity_name, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, action, entity_type, entity_id, entity_name, details],
        )?;
        Ok(())
    }

    pub fn list_activity_logs(&self, limit: i64, offset: i64, entity_type: Option<&str>) -> SqlResult<Vec<ActivityLog>> {
        let conn = self.conn();
        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match entity_type {
            Some(et) => (
                "SELECT id, action, entity_type, entity_id, entity_name, details, created_at FROM activity_logs WHERE entity_type = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3".to_string(),
                vec![Box::new(et.to_string()) as Box<dyn rusqlite::types::ToSql>, Box::new(limit), Box::new(offset)],
            ),
            None => (
                "SELECT id, action, entity_type, entity_id, entity_name, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT ?1 OFFSET ?2".to_string(),
                vec![Box::new(limit) as Box<dyn rusqlite::types::ToSql>, Box::new(offset)],
            ),
        };
        let mut stmt = conn.prepare(&sql)?;
        let result = stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
            Ok(ActivityLog {
                id: row.get(0)?,
                action: row.get(1)?,
                entity_type: row.get(2)?,
                entity_id: row.get(3)?,
                entity_name: row.get(4)?,
                details: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?.collect::<SqlResult<Vec<_>>>();
        result
    }

    /// Count tasks per project: returns HashMap<project_id, (active_count, total_count)>
    /// Active means status IN ('pending', 'assigned', 'running').
    pub fn count_tasks_per_project(&self) -> SqlResult<HashMap<String, (i64, i64)>> {
        let conn = self.conn();
        let mut stmt = conn.prepare(
            "SELECT project_id,
                    SUM(CASE WHEN status IN ('pending', 'assigned', 'running') THEN 1 ELSE 0 END),
                    COUNT(*)
             FROM tasks
             WHERE project_id IS NOT NULL
             GROUP BY project_id",
        )?;
        let mut map = HashMap::new();
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;
        for row in rows {
            let (project_id, active, total) = row?;
            map.insert(project_id, (active, total));
        }
        Ok(map)
    }

    pub fn count_activity_logs(&self, entity_type: Option<&str>) -> SqlResult<i64> {
        let conn = self.conn();
        match entity_type {
            Some(et) => conn.query_row(
                "SELECT COUNT(*) FROM activity_logs WHERE entity_type = ?1",
                params![et],
                |row| row.get(0),
            ),
            None => conn.query_row(
                "SELECT COUNT(*) FROM activity_logs",
                [],
                |row| row.get(0),
            ),
        }
    }
}
