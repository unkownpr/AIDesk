import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

interface TaskNotification {
  task_id: string;
  title: string;
  status: "completed" | "failed" | "agent_offline";
  message: string;
}

export function useNotifications() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      // Request notification permission
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (!granted) return;

      // Listen for task completion and agent offline events from backend
      unlisten = await listen<TaskNotification>("task-notification", (event) => {
        const { title, status, message } = event.payload;
        const notifTitle =
          status === "completed" ? "Task Completed" :
          status === "agent_offline" ? "Agent Offline" :
          "Task Failed";
        sendNotification({
          title: notifTitle,
          body: `${title}: ${message}`,
        });
      });
    }

    setup();
    return () => unlisten?.();
  }, []);
}
