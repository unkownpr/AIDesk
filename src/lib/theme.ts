// Centralized theme-aware style tokens
// Used by all pages to ensure consistent dark/light appearance

export function themeStyles(isDark: boolean) {
  return {
    // Backgrounds
    card: isDark
      ? "bg-[#14141b] border-[#2d2d3c]/60 shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      : "bg-white border-gray-200 shadow-sm",
    cardHover: isDark
      ? "bg-[#14141b] border-[#2d2d3c]/60 shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:border-emerald-500/30 hover:shadow-[0_2px_8px_rgba(16,185,129,0.08)]"
      : "bg-white border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md",
    input: isDark
      ? "bg-[#0a0a0f] border-[#2d2d3c]/60 text-gray-200 placeholder-gray-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20",
    row: isDark
      ? "bg-[#0a0a0f] border-[#2d2d3c]/40"
      : "bg-gray-50 border-gray-200",

    // Text — increased sizes throughout
    heading: isDark ? "text-gray-100" : "text-gray-900",
    text: isDark ? "text-gray-200" : "text-gray-800",
    textSecondary: isDark ? "text-gray-300" : "text-gray-600",
    label: isDark ? "text-gray-400" : "text-gray-500",
    muted: isDark ? "text-gray-500" : "text-gray-400",
    placeholder: isDark ? "text-gray-600" : "text-gray-400",

    // Accent (emerald) — vibrant and clear
    accent: isDark ? "text-emerald-400" : "text-emerald-600",
    accentHover: isDark ? "hover:text-emerald-300" : "hover:text-emerald-500",
    accentBg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
    accentBorder: isDark ? "border-emerald-500/20" : "border-emerald-200",
    accentBtn:
      "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm hover:shadow-md",
    accentBtnOutline: isDark
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
      : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",

    // Borders
    border: isDark ? "border-[#2d2d3c]/60" : "border-gray-200",
    borderLight: isDark ? "border-[#2d2d3c]/40" : "border-gray-200",

    // Badges
    badge: isDark ? "bg-[#1e1e28] text-gray-400" : "bg-gray-100 text-gray-500",

    // Interactive — smooth transitions
    hover: isDark ? "hover:bg-white/[0.04]" : "hover:bg-gray-50",
    hoverDelete: `${isDark ? "text-gray-600" : "text-gray-400"} hover:text-red-500`,
    focus: "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20",

    // Spinner
    spinner: isDark ? "text-gray-500" : "text-gray-400",

    // Section headers
    sectionTitle: isDark
      ? "text-xs font-semibold uppercase tracking-wider text-gray-500"
      : "text-xs font-semibold uppercase tracking-wider text-gray-400",
  };
}
