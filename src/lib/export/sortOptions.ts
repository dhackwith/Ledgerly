import type { SortKey } from "@/lib/types";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

export const SORT_KEYS: SortKey[] = SORT_OPTIONS.map((o) => o.value);
