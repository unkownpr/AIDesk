use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::mpsc;

use tauri::Emitter;

use crate::agent::{self, AgentOutput};
use crate::db::Database;

/// Event payload for task completion notifications
#[derive(Clone, serde::Serialize)]
pub struct TaskNotification {
    pub task_id: String,
    pub title: String,
    pub status: String, // "completed" | "failed"
    pub message: String,
}

pub struct Orchestrator {
    db: Arc<Database>,
    app_handle: Option<tauri::AppHandle>,
}

impl Orchestrator {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db, app_handle: None }
    }

    pub fn with_app_handle(mut self, handle: tauri::AppHandle) -> Self {
        self.app_handle = Some(handle);
        self
    }

    /// Mark remote agents as offline if their heartbeat is stale (>60s)
    fn check_agent_health(&self, agents: &[crate::db::models::Agent]) {
        for agent in agents {
            if agent.agent_type != "remote" || agent.status == "offline" {
                continue;
            }
            let is_stale = match &agent.last_heartbeat {
                Some(hb) => self.db.is_heartbeat_stale(hb, 60),
                None => true,
            };
            if is_stale {
                self.db.update_agent_heartbeat(&agent.id, "offline").ok();
                self.db.add_activity("went_offline", "agent", Some(&agent.id), Some(&agent.name), Some("Heartbeat timeout (60s)")).ok();
                tracing::warn!("Agent '{}' marked offline (heartbeat timeout)", agent.name);
                self.emit_notification(TaskNotification {
                    task_id: String::new(),
                    title: agent.name.clone(),
                    status: "agent_offline".to_string(),
                    message: format!("No heartbeat for 60s"),
                });
            }
        }
    }

    fn emit_notification(&self, notification: TaskNotification) {
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("task-notification", notification);
        }
    }

    /// Check for pending tasks and execute them with available local agents.
    /// Task assignment strategy:
    /// 1. Priority ordering: critical > high > medium > low (handled by SQL)
    /// 2. Manual assignment: if task has assigned_agent_id, only that agent can run it
    /// 3. Load balancing: auto-assigned tasks go to agent with fewest running tasks
    pub async fn tick(&self) {
        let agents = match self.db.list_agents() {
            Ok(a) => a,
            Err(e) => {
                tracing::error!("Orchestrator: failed to list agents: {}", e);
                return;
            }
        };

        // Health check: mark stale remote agents as offline (60s timeout)
        self.check_agent_health(&agents);

        let pending = match self.db.get_pending_tasks() {
            Ok(tasks) => tasks,
            Err(e) => {
                tracing::error!("Orchestrator: failed to fetch pending tasks: {}", e);
                return;
            }
        };

        if pending.is_empty() {
            return;
        }

        // Get running task counts for load balancing and concurrent limit
        let mut task_counts = self.db.count_running_tasks_per_agent().unwrap_or_default();

        // Find local agents that are available (online or idle)
        let local_agents: Vec<_> = agents
            .iter()
            .filter(|a| a.agent_type == "local" && (a.status == "online" || a.status == "idle" || a.status == "busy"))
            .collect();

        let mut dispatched_this_tick = HashSet::new();

        for task in &pending {
            // --- Manual assignment: task has a specific agent assigned ---
            if let Some(ref target_id) = task.assigned_agent_id {
                let target = agents.iter().find(|a| a.id == *target_id);
                match target {
                    Some(a) if a.agent_type == "remote" => continue,
                    Some(a) if a.agent_type == "local" => {
                        let running = task_counts.get(&a.id).copied().unwrap_or(0);
                        if running < a.max_concurrent_tasks as i64
                            && (a.status == "online" || a.status == "idle" || a.status == "busy")
                        {
                            self.dispatch_task(task, a, &mut dispatched_this_tick).await;
                            *task_counts.entry(a.id.clone()).or_insert(0) += 1;
                        }
                    }
                    _ => continue,
                }
                continue;
            }

            // --- Auto-assignment: pick agent with most remaining capacity ---
            let best_agent = local_agents
                .iter()
                .filter(|a| {
                    let running = task_counts.get(&a.id).copied().unwrap_or(0);
                    running < a.max_concurrent_tasks as i64
                })
                .min_by_key(|a| task_counts.get(&a.id).copied().unwrap_or(0));

            match best_agent {
                Some(agent) => {
                    self.dispatch_task(task, agent, &mut dispatched_this_tick).await;
                    *task_counts.entry(agent.id.clone()).or_insert(0) += 1;
                }
                None => break, // All agents at capacity
            }
        }
    }

    /// Assign and launch a task on an agent
    async fn dispatch_task(
        &self,
        task: &crate::db::models::Task,
        agent: &crate::db::models::Agent,
        used_agents: &mut HashSet<String>,
    ) {
        // Atomic assignment — prevents double-assign race
        match self.db.try_assign_task(&task.id, &agent.id) {
            Ok(true) => {}
            Ok(false) => return, // Already assigned by another path
            Err(e) => {
                tracing::error!("Orchestrator: failed to assign task {}: {}", task.id, e);
                return;
            }
        }

        used_agents.insert(agent.id.clone());

        if let Err(e) = self.db.update_task_status(&task.id, "running", None, None) {
            tracing::error!("Orchestrator: failed to update task status: {}", e);
            return;
        }
        if let Err(e) = self.db.update_agent_heartbeat(&agent.id, "busy") {
            tracing::error!("Orchestrator: failed to update agent status: {}", e);
        }
        self.db
            .add_task_log(
                &task.id,
                Some(&agent.id),
                "info",
                &format!("Task assigned to agent '{}' (priority: {})", agent.name, task.priority),
                None,
            )
            .ok();

        // Spawn task execution
        let db = self.db.clone();
        let task_id = task.id.clone();
        let task_title = task.title.clone();
        let agent_id = agent.id.clone();
        // Use project path as working dir, fallback to agent's dir
        let project = task.project_id.as_ref()
            .and_then(|pid| db.get_project(pid).ok());
        let working_dir = project.as_ref()
            .map(|p| p.path.clone())
            .or_else(|| agent.working_directory.clone());
        // Build description with project analysis context
        let description = if let Some(ref proj) = project {
            let mut desc = task.description.clone();
            if let Some(ref analysis) = proj.analysis {
                desc = format!(
                    "<project_analysis>\nThis is the existing project analysis. Use it as context, do not re-analyze the entire project.\n{}\n</project_analysis>\n\n{}", analysis, desc
                );
            } else {
                desc = format!(
                    "<project_context>\nProject: {} ({})\nThis is the first task for this project. Before starting the task, briefly analyze the project structure (key files, tech stack, architecture). Then proceed with the task.\n</project_context>\n\n{}", proj.name, proj.path, desc
                );
            }
            desc
        } else {
            task.description.clone()
        };
        let project_id_for_analysis = task.project_id.clone();
        let model = Some(agent.model.clone());
        let max_turns = Some(agent.max_turns);
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            // Guard: ensure agent status is restored even on panic
            let _guard = AgentStatusGuard {
                db: db.clone(),
                agent_id: agent_id.clone(),
                task_id: task_id.clone(),
            };

            let (tx, mut rx) = mpsc::channel::<AgentOutput>(256);

            // Log collector
            let db_log = db.clone();
            let tid = task_id.clone();
            let aid = agent_id.clone();
            let log_handle = tokio::spawn(async move {
                while let Some(output) = rx.recv().await {
                    db_log
                        .add_task_log(&tid, Some(&aid), &output.output_type, &output.content, None)
                        .ok();
                }
            });

            let result = agent::run_claude_task(
                &task_id,
                &description,
                working_dir.as_deref(),
                model.as_deref(),
                max_turns,
                None,
                None,
                None,
                tx,
            )
            .await;

            // Wait for log collector to finish
            log_handle.await.ok();

            match result {
                Ok(output) => {
                    db.update_task_status(&task_id, "completed", Some(&output), None)
                        .ok();
                    db.add_task_log(
                        &task_id,
                        Some(&agent_id),
                        "info",
                        "Task completed successfully",
                        None,
                    )
                    .ok();
                    db.add_activity("completed", "task", Some(&task_id), Some(&task_title), None).ok();

                    // Update project analysis after task completion
                    if let Some(ref pid) = project_id_for_analysis {
                        Self::update_analysis_after_task(&db, pid, &task_id, &agent_id, &output);
                    }

                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("task-notification", TaskNotification {
                            task_id: task_id.clone(),
                            title: task_title.clone(),
                            status: "completed".to_string(),
                            message: "Task completed successfully".to_string(),
                        });
                    }
                }
                Err(err) => {
                    // Check if task has retry budget remaining
                    let should_retry = db.get_task(&task_id)
                        .map(|t| t.retry_count < t.max_retries)
                        .unwrap_or(false);

                    if should_retry {
                        db.retry_task(&task_id).ok();
                        db.add_task_log(&task_id, Some(&agent_id), "warn",
                            &format!("Task failed, auto-retrying: {}", &err), None).ok();
                        db.add_activity("retried", "task", Some(&task_id), Some(&task_title), Some(&err)).ok();
                        if let Some(ref handle) = app_handle {
                            let _ = handle.emit("task-notification", TaskNotification {
                                task_id: task_id.clone(),
                                title: task_title.clone(),
                                status: "retrying".to_string(),
                                message: format!("Retrying after failure: {}", &err),
                            });
                        }
                    } else {
                        db.update_task_status(&task_id, "failed", None, Some(&err))
                            .ok();
                        db.add_task_log(&task_id, Some(&agent_id), "error", &err, None)
                            .ok();
                        db.add_activity("failed", "task", Some(&task_id), Some(&task_title), Some(&err)).ok();
                        if let Some(ref handle) = app_handle {
                            let _ = handle.emit("task-notification", TaskNotification {
                                task_id: task_id.clone(),
                                title: task_title.clone(),
                                status: "failed".to_string(),
                                message: format!("Task failed: {}", &err),
                            });
                        }
                    }
                }
            }

            db.update_agent_heartbeat(&agent_id, "online").ok();
            // Defuse the guard — we handled cleanup manually
            std::mem::forget(_guard);
        });
    }
}

impl Orchestrator {
    /// Extract a brief project analysis summary from task output
    fn update_analysis_after_task(
        db: &Arc<Database>,
        project_id: &str,
        task_id: &str,
        agent_id: &str,
        task_output: &str,
    ) {
        // Take last 2000 chars of output as analysis context
        let analysis = if task_output.len() > 2000 {
            &task_output[task_output.len() - 2000..]
        } else {
            task_output
        };

        if let Err(e) = db.update_project_analysis(project_id, analysis) {
            tracing::warn!("Failed to update project analysis for {}: {}", project_id, e);
        } else {
            db.add_task_log(task_id, Some(agent_id), "info", "Project analysis updated", None).ok();
            tracing::info!("Updated project analysis for {}", project_id);
        }
    }
}

/// Drop guard that restores agent status if the task panics
struct AgentStatusGuard {
    db: Arc<Database>,
    agent_id: String,
    task_id: String,
}

impl Drop for AgentStatusGuard {
    fn drop(&mut self) {
        self.db
            .update_agent_heartbeat(&self.agent_id, "online")
            .ok();
        self.db
            .update_task_status(
                &self.task_id,
                "failed",
                None,
                Some("Task panicked unexpectedly"),
            )
            .ok();
        self.db
            .add_task_log(
                &self.task_id,
                Some(&self.agent_id),
                "error",
                "Task panicked",
                None,
            )
            .ok();
    }
}
