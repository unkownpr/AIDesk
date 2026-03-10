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
      <div className={`relative w-full max-w-sm rounded-2xl border p-6 ${
        isDark ? "border-[#2d2d3c]/60 bg-[#14141b] shadow-2xl" : "border-gray-200 bg-white shadow-xl"
      }`}>
        <button
          onClick={onCancel}
          className={`absolute right-4 top-4 rounded-lg p-1 transition-colors ${isDark ? "text-gray-500 hover:text-gray-300 hover:bg-white/5" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isWarning ? "bg-amber-500/10" : "bg-red-500/10"
          }`}>
            <AlertTriangle size={18} className={isWarning ? "text-amber-400" : "text-red-400"} />
          </div>
          <div className="flex-1">
            <h3 className={`text-[15px] font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>{title}</h3>
            <p className={`mt-1.5 text-[14px] leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className={`rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors ${
              isDark
                ? "border-[#2d2d3c]/60 bg-[#1e1e28] text-gray-300 hover:bg-[#2d2d3c]"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-[14px] font-medium text-white shadow-sm transition-colors ${
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
