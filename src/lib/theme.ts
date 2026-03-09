// Centralized theme-aware style tokens
// Used by all pages to ensure consistent dark/light appearance

export function themeStyles(isDark: boolean) {
  return {
    // Backgrounds
    card: isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm",
    input: isDark
      ? "bg-zinc-950 border-zinc-800 text-zinc-200 placeholder-zinc-600"
      : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400",
    row: isDark
      ? "bg-zinc-950 border-zinc-800/60"
      : "bg-zinc-50 border-zinc-200",

    // Text
    heading: isDark ? "text-zinc-100" : "text-zinc-900",
    text: isDark ? "text-zinc-200" : "text-zinc-800",
    textSecondary: isDark ? "text-zinc-300" : "text-zinc-700",
    label: isDark ? "text-zinc-400" : "text-zinc-500",
    muted: isDark ? "text-zinc-600" : "text-zinc-400",
    placeholder: isDark ? "text-zinc-600" : "text-zinc-400",

    // Accent (emerald) — dark vs light appropriate tones
    accent: isDark ? "text-emerald-400" : "text-emerald-700",
    accentHover: isDark ? "hover:text-emerald-300" : "hover:text-emerald-600",
    accentBg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
    accentBorder: isDark ? "border-emerald-500/20" : "border-emerald-200",
    accentBtn: "bg-emerald-600 hover:bg-emerald-500 text-white",
    accentBtnOutline: isDark
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : "border-emerald-300 bg-emerald-50 text-emerald-700",

    // Borders
    border: isDark ? "border-zinc-800/80" : "border-zinc-200",
    borderLight: isDark ? "border-zinc-800/60" : "border-zinc-200",

    // Badges
    badge: isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-100 text-zinc-500",

    // Interactive
    hover: isDark ? "hover:bg-zinc-800/40" : "hover:bg-zinc-50",
    hoverDelete: `${isDark ? "text-zinc-700" : "text-zinc-400"} hover:text-red-500`,
    focus: "focus:outline-none focus:border-emerald-500/50",

    // Spinner
    spinner: isDark ? "text-zinc-600" : "text-zinc-400",
  };
}
