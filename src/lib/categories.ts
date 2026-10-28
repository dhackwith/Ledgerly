import type { Category } from "./types";

interface CategoryMeta {
  /** Chart color. Assigned in fixed order from a colorblind-validated categorical palette. */
  color: string;
  badge: string;
  icon: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  Food: { color: "#2a78d6", badge: "bg-blue-50 text-blue-700 ring-blue-600/20", icon: "🍔" },
  Transportation: { color: "#eb6834", badge: "bg-orange-50 text-orange-700 ring-orange-600/20", icon: "🚗" },
  Entertainment: { color: "#1baf7a", badge: "bg-teal-50 text-teal-700 ring-teal-600/20", icon: "🎬" },
  Shopping: { color: "#eda100", badge: "bg-amber-50 text-amber-800 ring-amber-600/20", icon: "🛍️" },
  Bills: { color: "#e87ba4", badge: "bg-pink-50 text-pink-700 ring-pink-600/20", icon: "🧾" },
  Other: { color: "#008300", badge: "bg-green-50 text-green-800 ring-green-600/20", icon: "📦" },
};
