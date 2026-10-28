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
