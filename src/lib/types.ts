export const CATEGORIES = [
  "Food",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Bills",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: string;
  /** Local calendar date, YYYY-MM-DD (no time component). */
  date: string;
  /** Amount in dollars, e.g. 12.5 for $12.50. */
  amount: number;
  category: Category;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** Provenance and suggestion details used by smart category suggestions. Never exported or shared. */
  meta?: ExpenseMeta;
}

/** Where an expense came from. Sample data is never used for learning. */
export type ExpenseSource = "manual" | "import" | "shared-import" | "sample";

/** How a category suggestion was shown in the form. */
export type SuggestionDisplay = "preselected" | "chips" | "none";

/** The suggestion that was on screen when an expense was saved. */
export interface SuggestionRecord {
  category: Category;
  /** Calibrated confidence, 0..1. */
  confidence: number;
  shown: SuggestionDisplay;
  /** True when the saved category equals the suggested one. */
  accepted: boolean;
  modelVersion: string;
}

export interface ExpenseMeta {
  source: ExpenseSource;
  suggestion?: SuggestionRecord;
  /** Set when an edit changed the category. */
  recategorizedAt?: string;
}

export type ExpenseInput = Pick<Expense, "date" | "amount" | "category" | "description">;

export interface ExpenseFilters {
  search: string;
  category: Category | "All";
  from: string;
  to: string;
}

export type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export const EMPTY_FILTERS: ExpenseFilters = { search: "", category: "All", from: "", to: "" };
