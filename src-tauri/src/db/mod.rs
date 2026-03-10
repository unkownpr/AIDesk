use rusqlite::{Connection, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;

pub mod models;
pub mod queries;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(data_dir: &Path) -> SqlResult<Self> {
        std::fs::create_dir_all(data_dir)
            .map_err(|e| rusqlite::Error::InvalidPath(data_dir.join(e.to_string())))?;

        let db_path = data_dir.join("aidesk.db");
        let conn = Connection::open(db_path)?;

        // Performance & correctness pragmas
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA busy_timeout=5000;
             PRAGMA foreign_keys=ON;
             PRAGMA synchronous=NORMAL;",
        )?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        db.run_schema_upgrades()?;
        Ok(db)
    }

    fn run_migrations(&self) -> SqlResult<()> {
        let conn = self.conn();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                agent_type TEXT NOT NULL DEFAULT 'local' CHECK(agent_type IN ('local', 'remote')),
                status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'busy', 'idle')),
                token TEXT UNIQUE NOT NULL,
                working_directory TEXT,
                model TEXT DEFAULT 'sonnet' CHECK(model IN ('sonnet', 'opus', 'haiku')),
                max_turns INTEGER DEFAULT 50 CHECK(max_turns > 0),
                max_concurrent_tasks INTEGER DEFAULT 1 CHECK(max_concurrent_tasks > 0),
                allowed_tools TEXT,
                last_heartbeat TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL CHECK(length(title) > 0),
                description TEXT NOT NULL CHECK(length(description) > 0),
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
                priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
                assigned_agent_id TEXT,
                parent_task_id TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                max_retries INTEGER NOT NULL DEFAULT 0,
                git_repo TEXT,
                git_branch TEXT,
                mcp_servers TEXT,
                result TEXT,
                error TEXT,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
                FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS task_logs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                agent_id TEXT,
                log_type TEXT NOT NULL DEFAULT 'info' CHECK(log_type IN ('info', 'warn', 'error', 'debug', 'assistant', 'result', 'stderr')),
                message TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS secrets (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                encrypted_value TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS mcp_configs (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                transport TEXT NOT NULL CHECK(transport IN ('stdio', 'http', 'sse')),
                url TEXT,
                command TEXT,
                args TEXT,
                env_vars TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS git_configs (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                repo_url TEXT NOT NULL,
                default_branch TEXT DEFAULT 'main',
                credentials_secret_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (credentials_secret_id) REFERENCES secrets(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL CHECK(length(name) > 0),
                path TEXT NOT NULL,
                description TEXT,
                git_repo TEXT,
                git_branch TEXT DEFAULT 'main',
                analysis TEXT,
                analysis_updated_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS activity_logs (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'agent', 'secret', 'mcp', 'git', 'project', 'system')),
                entity_id TEXT,
                entity_name TEXT,
                details TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
            CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
            CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type);
            ",
        )?;
        Ok(())
    }

    /// Incremental schema upgrades for existing databases
    fn run_schema_upgrades(&self) -> SqlResult<()> {
        let conn = self.conn();

        // v0.2: Expand task_logs log_type constraint to include agent output types
        // SQLite doesn't support ALTER CHECK, so recreate the table if needed
        let has_old_constraint: bool = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='task_logs'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|sql| sql.contains("'info', 'warn', 'error', 'debug')") && !sql.contains("'assistant'"))
            .unwrap_or(false);

        // v0.3: Add project_id column to tasks table
        let has_project_col: bool = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|sql| sql.contains("project_id"))
            .unwrap_or(false);

        if !has_project_col {
            conn.execute_batch(
                "ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
                 CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);",
            )?;
            tracing::info!("Schema upgrade: added project_id to tasks");
        }

        // v0.4: Add queue/retry columns to tasks, max_concurrent_tasks to agents
        let has_retry_col: bool = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|sql| sql.contains("retry_count"))
            .unwrap_or(false);

        if !has_retry_col {
            conn.execute_batch(
                "ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
                 ALTER TABLE tasks ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 0;",
            )?;
            tracing::info!("Schema upgrade: added retry columns to tasks");
        }

        let has_concurrent_col: bool = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|sql| sql.contains("max_concurrent_tasks"))
            .unwrap_or(false);

        if !has_concurrent_col {
            conn.execute_batch(
                "ALTER TABLE agents ADD COLUMN max_concurrent_tasks INTEGER NOT NULL DEFAULT 1;",
            )?;
            tracing::info!("Schema upgrade: added max_concurrent_tasks to agents");
        }

        // v0.5: Add analysis columns to projects
        let has_analysis_col: bool = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'",
                [],
                |row| row.get::<_, String>(0),
            )
            .map(|sql| sql.contains("analysis"))
            .unwrap_or(false);

        if !has_analysis_col {
            conn.execute_batch(
                "ALTER TABLE projects ADD COLUMN analysis TEXT;
                 ALTER TABLE projects ADD COLUMN analysis_updated_at TEXT;",
            )?;
            tracing::info!("Schema upgrade: added analysis columns to projects");
        }

        if has_old_constraint {
            conn.execute_batch(
                "
                CREATE TABLE task_logs_new (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    agent_id TEXT,
                    log_type TEXT NOT NULL DEFAULT 'info' CHECK(log_type IN ('info', 'warn', 'error', 'debug', 'assistant', 'result', 'stderr')),
                    message TEXT NOT NULL,
                    metadata TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
                );
                INSERT INTO task_logs_new SELECT * FROM task_logs;
                DROP TABLE task_logs;
                ALTER TABLE task_logs_new RENAME TO task_logs;
                CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
                ",
            )?;
            tracing::info!("Schema upgrade: expanded task_logs log_type constraint");
        }

        Ok(())
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
