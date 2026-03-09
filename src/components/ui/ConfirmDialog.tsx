import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isWarning = variant === "warning";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className={`relative w-full max-w-sm rounded-xl border p-5 shadow-2xl ${
        isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
      }`}>
        <button
          onClick={onCancel}
          className={`absolute right-3 top-3 transition-colors ${isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600"}`}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isWarning ? "bg-amber-500/10" : "bg-red-500/10"
          }`}>
            <AlertTriangle size={16} className={isWarning ? "text-amber-400" : "text-red-400"} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{title}</h3>
            <p className={`mt-1 text-[13px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors ${
              isWarning
                ? "bg-amber-600 hover:bg-amber-500"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
