import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "installing" | "upToDate" | "error";

interface UpdateState {
  status: UpdateStatus;
  version?: string;
  error?: string;
  progress?: number;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  const checkForUpdate = useCallback(async () => {
    setState({ status: "checking" });
    try {
      const update = await check();
      if (update) {
        setState({ status: "available", version: update.version });
      } else {
        setState({ status: "upToDate" });
      }
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setState((s) => ({ ...s, status: "downloading", progress: 0 }));
    try {
      const update = await check();
      if (!update) return;

      let totalLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalLength = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalLength > 0) {
            setState((s) => ({ ...s, progress: Math.round((downloaded / totalLength) * 100) }));
          }
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, status: "installing" }));
        }
      });

      await relaunch();
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  return { ...state, checkForUpdate, downloadAndInstall };
}
