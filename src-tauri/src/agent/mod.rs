use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::time::{timeout, Duration};

const DEFAULT_TIMEOUT_SECS: u64 = 600; // 10 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    pub output_type: String,
    pub content: String,
    pub is_final: bool,
}

/// JSON command sent to the agent-runner sidecar via stdin
#[derive(Serialize)]
struct RunCommand {
    #[serde(rename = "type")]
    cmd_type: String,
    #[serde(rename = "taskId")]
    task_id: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(rename = "maxTurns")]
    #[serde(skip_serializing_if = "Option::is_none")]
    max_turns: Option<i32>,
    #[serde(rename = "allowedTools")]
    #[serde(skip_serializing_if = "Option::is_none")]
    allowed_tools: Option<Vec<String>>,
    #[serde(rename = "systemPrompt")]
    #[serde(skip_serializing_if = "Option::is_none")]
    system_prompt: Option<String>,
    #[serde(rename = "timeoutMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    timeout_ms: Option<u64>,
}

/// JSON message received from the agent-runner sidecar via stdout
#[derive(Deserialize)]
#[allow(dead_code)]
struct RunnerMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "taskId")]
    task_id: String,
    content: Option<String>,
    #[serde(rename = "outputType")]
    output_type: Option<String>,
    success: Option<bool>,
}

/// Run a task using the Claude Agent SDK via Node.js sidecar.
/// Streams output via channel. Returns final result or error.
pub async fn run_claude_task(
    task_id: &str,
    prompt: &str,
    working_dir: Option<&str>,
    model: Option<&str>,
    max_turns: Option<i32>,
    allowed_tools: Option<&[String]>,
    system_prompt: Option<&str>,
    timeout_secs: Option<u64>,
    tx: mpsc::Sender<AgentOutput>,
) -> Result<String, String> {
    // Validate working directory exists before starting
    if let Some(dir) = working_dir {
        if !std::path::Path::new(dir).is_dir() {
            return Err(format!("Working directory does not exist: {}", dir));
        }
    }

    let runner_path = find_runner_path()?;
    let timeout_duration = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));

    tracing::info!(
        "Starting agent task {} with runner: {}, cwd: {:?}",
        task_id,
        runner_path,
        working_dir
    );

    let mut cmd = Command::new("node");
    cmd.arg(&runner_path);

    // Set the working directory for the sidecar process
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Remove env vars that prevent nested Claude Code sessions
    cmd.env_remove("CLAUDECODE");
    cmd.env_remove("CLAUDE_CODE_SESSION");
    cmd.env_remove("CLAUDE_CODE_PARENT");

    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn agent-runner: {}", e))?;

    let mut stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Drain stderr in background
    let tx_err = tx.clone();
    let task_id_for_stderr = task_id.to_string();
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut stderr_output = String::new();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                tracing::warn!("Agent runner stderr [{}]: {}", task_id_for_stderr, line);
                stderr_output.push_str(&line);
                stderr_output.push('\n');
                tx_err
                    .send(AgentOutput {
                        output_type: "stderr".to_string(),
                        content: line,
                        is_final: false,
                    })
                    .await
                    .ok();
            }
        }
        stderr_output
    });

    // Wait for runner to signal readiness, then send command
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    // Read the initial "ready" message
    let ready_result = timeout(Duration::from_secs(30), lines.next_line()).await;
    match ready_result {
        Ok(Ok(Some(line))) => {
            if let Ok(msg) = serde_json::from_str::<RunnerMessage>(&line) {
                if msg.task_id != "__runner__" {
                    return Err(format!(
                        "Unexpected initial message from runner: {}",
                        line
                    ));
                }
                tracing::info!("Agent runner ready");
            } else {
                return Err(format!("Invalid runner ready message: {}", line));
            }
        }
        Ok(Ok(None)) => {
            // Runner exited - check stderr for details
            let stderr_output = stderr_handle.await.unwrap_or_default();
            return Err(format!(
                "Runner exited before ready. stderr: {}",
                stderr_output.trim()
            ));
        }
        Ok(Err(e)) => return Err(format!("Runner IO error: {}", e)),
        Err(_) => return Err("Runner startup timed out (30s)".to_string()),
    }

    // Send the run command
    let run_cmd = RunCommand {
        cmd_type: "run".to_string(),
        task_id: task_id.to_string(),
        prompt: prompt.to_string(),
        cwd: working_dir.map(String::from),
        model: model.map(String::from),
        max_turns,
        allowed_tools: allowed_tools.map(|t| t.to_vec()),
        system_prompt: system_prompt.map(String::from),
        timeout_ms: Some(timeout_duration.as_millis() as u64),
    };

    let cmd_json = serde_json::to_string(&run_cmd)
        .map_err(|e| format!("Failed to serialize command: {}", e))?;

    tracing::info!("Sending command to runner: {}", cmd_json);

    stdin
        .write_all(cmd_json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to runner: {}", e))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|e| format!("Failed to write newline: {}", e))?;
    stdin.flush().await.ok();

    // Process output messages
    let mut final_result = String::new();
    let mut task_error: Option<String> = None;

    let process_result = timeout(timeout_duration, async {
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let msg: RunnerMessage = match serde_json::from_str(trimmed) {
                Ok(m) => m,
                Err(_) => {
                    tracing::warn!("Non-JSON output from runner: {}", trimmed);
                    continue;
                }
            };

            // Only process messages for our task
            if msg.task_id != task_id {
                continue;
            }

            match msg.msg_type.as_str() {
                "progress" => {
                    if let Some(content) = &msg.content {
                        let out_type = msg.output_type.as_deref().unwrap_or("info");
                        tx.send(AgentOutput {
                            output_type: out_type.to_string(),
                            content: content.clone(),
                            is_final: false,
                        })
                        .await
                        .ok();
                    }
                }
                "result" => {
                    final_result = msg.content.unwrap_or_default();
                    tx.send(AgentOutput {
                        output_type: "result".to_string(),
                        content: final_result.clone(),
                        is_final: true,
                    })
                    .await
                    .ok();
                    break;
                }
                "error" => {
                    task_error = msg.content.clone();
                    tracing::error!("Agent runner error: {:?}", task_error);
                    break;
                }
                "started" => {
                    tx.send(AgentOutput {
                        output_type: "info".to_string(),
                        content: "Agent SDK task started".to_string(),
                        is_final: false,
                    })
                    .await
                    .ok();
                }
                _ => {}
            }
        }
    })
    .await;

    // Close stdin to signal the runner to exit
    drop(stdin);

    if process_result.is_err() {
        child.kill().await.ok();
        return Err("Task timed out".to_string());
    }

    // Wait for process to finish
    child.wait().await.ok();
    stderr_handle.await.ok();

    if let Some(err) = task_error {
        Err(err)
    } else {
        Ok(final_result)
    }
}

/// Locate the agent-runner dist/index.js using multiple strategies
fn find_runner_path() -> Result<String, String> {
    // Strategy 1: Use CARGO_MANIFEST_DIR (available during cargo build/run)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let p = PathBuf::from(&manifest_dir)
            .parent()
            .map(|root| root.join("agent-runner").join("dist").join("index.js"));
        if let Some(path) = p {
            if path.exists() {
                tracing::info!("Found runner via CARGO_MANIFEST_DIR: {:?}", path);
                return Ok(path.to_string_lossy().to_string());
            }
        }
    }

    // Strategy 2: Relative to current working directory
    let cwd_paths = [
        "agent-runner/dist/index.js",
        "../agent-runner/dist/index.js",
    ];

    for path in &cwd_paths {
        let p = std::path::Path::new(path);
        if p.exists() {
            return p
                .canonicalize()
                .map(|p| p.to_string_lossy().to_string())
                .map_err(|e| format!("Failed to resolve runner path: {}", e));
        }
    }

    // Strategy 3: Relative to the executable (production builds)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // macOS: executable is inside AppName.app/Contents/MacOS/
            let candidates = [
                exe_dir.join("agent-runner").join("dist").join("index.js"),
                exe_dir
                    .join("..")
                    .join("Resources")
                    .join("agent-runner")
                    .join("dist")
                    .join("index.js"),
            ];
            for path in &candidates {
                if path.exists() {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Strategy 4: Check known project location as last resort
    let home = std::env::var("HOME").unwrap_or_default();
    let fallback = PathBuf::from(&home)
        .join("Desktop")
        .join("Project")
        .join("aidesk")
        .join("agent-runner")
        .join("dist")
        .join("index.js");
    if fallback.exists() {
        return Ok(fallback.to_string_lossy().to_string());
    }

    Err(
        "Agent runner not found. Make sure agent-runner is built. \
         Run: cd agent-runner && npm install && npm run build"
            .to_string(),
    )
}
