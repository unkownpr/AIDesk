/**
 * AIDesk HTTP Client - communicates with AIDesk server API
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  project_id: string | null;
  git_repo: string | null;
  git_branch: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
}

export interface TaskReport {
  task_id: string;
  status: "completed" | "failed";
  result?: string;
  error?: string;
  logs?: { log_type: string; message: string; metadata?: string }[];
}

export interface LogEntry {
  task_id: string;
  log_type: string;
  message: string;
  metadata?: string;
}

export class AideskClient {
  private baseUrl: string;
  private token: string;

  constructor(serverUrl: string, token: string) {
    this.baseUrl = serverUrl.replace(/\/$/, "");
    this.token = token;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  /** Poll for a pending task */
  async poll(): Promise<Task | null> {
    const res = await fetch(`${this.baseUrl}/api/agent/poll`, {
      headers: this.headers,
    });

    if (res.status === 401) {
      throw new Error("Authentication failed - check your token");
    }
    if (!res.ok) {
      throw new Error(`Poll failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data as Task | null;
  }

  /** Send heartbeat to server */
  async heartbeat(status: "online" | "busy" | "idle"): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/agent/heartbeat`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ status }),
    });

    if (!res.ok && res.status !== 401) {
      // Heartbeat failures are non-fatal, just log
      console.error(`Heartbeat failed: ${res.status}`);
    }
  }

  /** Send a progress log during task execution */
  async sendLog(entry: LogEntry): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/agent/log`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(entry),
      });
    } catch {
      // Log sending failures are non-fatal
    }
  }

  /** Report task completion/failure */
  async report(report: TaskReport): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/agent/report`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(report),
    });

    if (!res.ok) {
      throw new Error(`Report failed: ${res.status} ${res.statusText}`);
    }
  }

  /** Check server connectivity */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
