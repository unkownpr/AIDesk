use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::sse::{Event, KeepAlive, Sse},
    routing::{delete, get, post},
    Json, Router,
};
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::db::models::*;
use crate::db::Database;

/// Shared API state
#[derive(Clone)]
pub struct ApiState {
    pub db: Arc<Database>,
    pub dashboard_key: String,
}

pub async fn start_api_server(
    db: Arc<Database>,
    port: u16,
    dashboard_key: String,
    bind_all: bool,
) -> Result<(), String> {
    let state = ApiState {
        db,
        dashboard_key: dashboard_key.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            let o = origin.as_bytes();
            // Exact match for known origins
            o == b"http://localhost:1420"
                || o == b"http://127.0.0.1:1420"
                || o.starts_with(b"tauri://")
                || o.starts_with(b"https://tauri.")
        }))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    // Agent daemon endpoints (token auth per-request, no CORS needed - not browser)
    let agent_routes = Router::new()
        .route("/api/agent/poll", get(agent_poll))
        .route("/api/agent/heartbeat", post(agent_heartbeat))
        .route("/api/agent/report", post(agent_report))
        .route("/api/agent/log", post(agent_log));

    // Dashboard endpoints (protected by dashboard API key)
    let dashboard_routes = Router::new()
        .route("/api/tasks", get(list_tasks))
        .route("/api/tasks", post(create_task))
        .route("/api/tasks/{id}", get(get_task))
        .route("/api/tasks/{id}", delete(delete_task))
        .route("/api/tasks/{id}/logs", get(get_task_logs))
        .route("/api/agents", get(list_agents))
        .route("/api/agents", post(create_agent))
        .route("/api/agents/{id}", delete(delete_agent))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            dashboard_auth_middleware,
        ));

    // SSE endpoint — uses query param auth (EventSource doesn't support custom headers)
    let sse_routes = Router::new()
        .route("/api/tasks/{id}/logs/stream", get(stream_task_logs));

    let app = Router::new()
        .merge(agent_routes)
        .merge(dashboard_routes)
        .merge(sse_routes)
        .route("/api/health", get(health_check))
        .layer(cors)
        .layer(axum::extract::DefaultBodyLimit::max(1024 * 1024)) // 1MB max body
        .with_state(state);

    let bind_addr = if bind_all { "0.0.0.0" } else { "127.0.0.1" };
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", bind_addr, port))
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

    tracing::info!("API server listening on {}:{}", bind_addr, port);
    axum::serve(listener, app)
        .await
        .map_err(|e| format!("API server error: {}", e))
}

// === Auth helpers ===

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(String::from)
}

fn authenticate_agent(db: &Database, headers: &HeaderMap) -> Result<Agent, StatusCode> {
    let token = extract_bearer_token(headers).ok_or(StatusCode::UNAUTHORIZED)?;
    db.get_agent_by_token(&token)
        .map_err(|_| StatusCode::UNAUTHORIZED)
}

/// Middleware: verify dashboard API key for internal endpoints
async fn dashboard_auth_middleware(
    State(state): State<ApiState>,
    headers: HeaderMap,
    request: axum::extract::Request,
    next: Next,
) -> Result<axum::response::Response, StatusCode> {
    let token = extract_bearer_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    if token != state.dashboard_key {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(next.run(request).await)
}

// === Health ===

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "version": "0.1.0" }))
}

// === Agent daemon endpoints ===

async fn agent_poll(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Option<Task>>, StatusCode> {
    let agent = authenticate_agent(&state.db, &headers)?;

    state
        .db
        .update_agent_heartbeat(&agent.id, "online")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tasks = state
        .db
        .get_pending_tasks()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Find a task explicitly assigned to this agent, or an unassigned one
    let task = tasks
        .iter()
        .find(|t| t.assigned_agent_id.as_deref() == Some(&*agent.id))
        .or_else(|| tasks.iter().find(|t| t.assigned_agent_id.is_none()));

    if let Some(t) = task {
        let assigned = state
            .db
            .try_assign_task(&t.id, &agent.id)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if assigned {
            state
                .db
                .update_task_status(&t.id, "running", None, None)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            state
                .db
                .add_task_log(&t.id, Some(&agent.id), "info", "Task picked up by agent", None)
                .ok();
            let updated = state
                .db
                .get_task(&t.id)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            return Ok(Json(Some(updated)));
        }
    }

    Ok(Json(None))
}

async fn agent_heartbeat(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<AgentHeartbeat>,
) -> Result<StatusCode, StatusCode> {
    let agent = authenticate_agent(&state.db, &headers)?;

    let valid_statuses = ["online", "busy", "idle"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    state
        .db
        .update_agent_heartbeat(&agent.id, &body.status)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

async fn agent_report(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<TaskResultReport>,
) -> Result<StatusCode, StatusCode> {
    let agent = authenticate_agent(&state.db, &headers)?;

    let owns = state
        .db
        .is_task_owned_by_agent(&body.task_id, &agent.id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !owns {
        return Err(StatusCode::FORBIDDEN);
    }

    let valid_statuses = ["completed", "failed"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    state
        .db
        .update_task_status(
            &body.task_id,
            &body.status,
            body.result.as_deref(),
            body.error.as_deref(),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let valid_log_types = ["info", "warn", "error", "debug", "assistant", "result", "stderr"];
    if let Some(logs) = &body.logs {
        for log in logs {
            if !valid_log_types.contains(&log.log_type.as_str()) {
                continue; // Skip invalid log types
            }
            state
                .db
                .add_task_log(
                    &body.task_id,
                    Some(&agent.id),
                    &log.log_type,
                    &log.message,
                    log.metadata.as_deref(),
                )
                .ok();
        }
    }

    state
        .db
        .update_agent_heartbeat(&agent.id, "online")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// Agent sends progress logs while running a task (real-time streaming)
async fn agent_log(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<AgentLogEntry>,
) -> Result<StatusCode, StatusCode> {
    let agent = authenticate_agent(&state.db, &headers)?;

    let owns = state
        .db
        .is_task_owned_by_agent(&body.task_id, &agent.id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !owns {
        return Err(StatusCode::FORBIDDEN);
    }

    let valid_log_types = ["info", "warn", "error", "debug", "assistant", "result", "stderr"];
    if !valid_log_types.contains(&body.log_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    state
        .db
        .add_task_log(
            &body.task_id,
            Some(&agent.id),
            &body.log_type,
            &body.message,
            body.metadata.as_deref(),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// === Dashboard endpoints ===

async fn list_tasks(State(state): State<ApiState>) -> Result<Json<Vec<Task>>, StatusCode> {
    state
        .db
        .list_tasks()
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_task(
    State(state): State<ApiState>,
    Json(body): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), StatusCode> {
    state
        .db
        .create_task(&body)
        .map(|t| (StatusCode::CREATED, Json(t)))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_task(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<Json<Task>, StatusCode> {
    state
        .db
        .get_task(&id)
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

async fn delete_task(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state
        .db
        .delete_task(&id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_task_logs(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<TaskLog>>, StatusCode> {
    state
        .db
        .get_task_logs(&id)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn list_agents(State(state): State<ApiState>) -> Result<Json<Vec<Agent>>, StatusCode> {
    state
        .db
        .list_agents()
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_agent(
    State(state): State<ApiState>,
    Json(body): Json<CreateAgentRequest>,
) -> Result<(StatusCode, Json<Agent>), StatusCode> {
    state
        .db
        .create_agent(&body)
        .map(|a| (StatusCode::CREATED, Json(a)))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn delete_agent(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    state
        .db
        .delete_agent(&id)
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// === SSE Log Streaming ===

#[derive(serde::Deserialize)]
struct StreamQuery {
    #[serde(default)]
    after: Option<String>,
    /// Dashboard API key passed as query param (EventSource can't send headers)
    #[serde(default)]
    key: Option<String>,
}

async fn stream_task_logs(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Query(query): Query<StreamQuery>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode>
{
    // Verify dashboard key from query param
    let key = query.key.as_deref().ok_or(StatusCode::UNAUTHORIZED)?;
    if key != state.dashboard_key {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let db = state.db.clone();
    db.get_task(&id).map_err(|_| StatusCode::NOT_FOUND)?;

    let stream = async_stream::stream! {
        let mut last_id = query.after.clone();
        loop {
            let logs = match db.get_task_logs_after(&id, last_id.as_deref()) {
                Ok(l) => l,
                Err(_) => break,
            };

            for log in &logs {
                let json = serde_json::to_string(log).unwrap_or_default();
                yield Ok(Event::default().event("log").data(json).id(log.id.clone()));
                last_id = Some(log.id.clone());
            }

            if let Ok(task) = db.get_task(&id) {
                if matches!(task.status.as_str(), "completed" | "failed" | "cancelled") {
                    let status_json = serde_json::json!({ "status": task.status }).to_string();
                    yield Ok(Event::default().event("done").data(status_json));
                    break;
                }
            }

            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
