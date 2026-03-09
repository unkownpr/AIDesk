import { useState, useEffect, useRef, useCallback } from "react";
import { getTaskLogs, getDashboardKey } from "@/lib/tauri";
import type { TaskLog } from "@/lib/types";

/**
 * Stream task logs using SSE (Server-Sent Events) for active tasks,
 * fallback to one-time fetch for completed tasks.
 */
export function useTaskLogStream(taskId: string | null, isActive: boolean) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset state on task change
    lastIdRef.current = null;

    if (!taskId) {
      setLogs([]);
      cleanup();
      return;
    }

    // Always fetch initial logs
    getTaskLogs(taskId)
      .then((initialLogs) => {
        setLogs(initialLogs);
        if (initialLogs.length > 0) {
          lastIdRef.current = initialLogs[initialLogs.length - 1].id;
        }
      })
      .catch(() => {});

    if (!isActive) return;

    // For active tasks, connect SSE with dashboard key auth
    let cancelled = false;
    getDashboardKey().then((key) => {
      if (cancelled) return;

      const params = new URLSearchParams({ key });
      if (lastIdRef.current) {
        params.set("after", lastIdRef.current);
      }
      const url = `http://127.0.0.1:3939/api/tasks/${encodeURIComponent(taskId)}/logs/stream?${params}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("log", (e: MessageEvent) => {
        try {
          const log: TaskLog = JSON.parse(e.data);
          lastIdRef.current = log.id;
          setLogs((prev) => {
            if (prev.some((l) => l.id === log.id)) return prev;
            return [...prev, log];
          });
        } catch { /* ignore malformed */ }
      });

      es.addEventListener("done", () => {
        cleanup();
      });

      es.onerror = () => {
        cleanup();
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [taskId, isActive, cleanup]);

  return logs;
}
