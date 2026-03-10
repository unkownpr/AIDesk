import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskStatus, AgentStatus, Priority } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  try {
    const now = Date.now();
    const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  } catch {
    return "unknown";
  }
}

export const statusColors: Record<TaskStatus | AgentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  running: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  online: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  offline: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  busy: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  idle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export const priorityColors: Record<Priority, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  medium: "text-blue-400",
  low: "text-gray-400",
};
