import { CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/lib/types";

export function CategoryBadge({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}>
      <span aria-hidden>{meta.icon}</span>
      {category}
    </span>
  );
}

export function CategoryDot({ category, className = "" }: { category: Category; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: CATEGORY_META[category].color }}
      aria-hidden
    />
  );
}
