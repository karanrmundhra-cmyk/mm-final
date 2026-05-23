import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatAmount(n) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n || 0);
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function isOverdue(dateStr, status) {
  if (!dateStr) return false;
  if (["Completed","Done"].includes(status)) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

export function confidenceColor(level) {
  if (level === "high") return "#52C77A";
  if (level === "medium") return "#E0A052";
  return "#E05252";
}

export function confidenceIcon(level) {
  if (level === "high") return "✓";
  if (level === "medium") return "●";
  return "!";
}
