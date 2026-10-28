import { CATEGORIES, type ExpenseInput } from "./types";
import { todayISO } from "./format";

export interface ExpenseFormValues {
  date: string;
  amount: string;
  category: string;
  description: string;
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export const MAX_AMOUNT = 1_000_000;
export const MAX_DESCRIPTION = 120;

export function validateExpense(values: ExpenseFormValues): {
  errors: ExpenseFormErrors;
  data: ExpenseInput | null;
} {
  const errors: ExpenseFormErrors = {};

  if (!values.date) {
    errors.date = "Please choose a date.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(Date.parse(values.date))) {
    errors.date = "Enter a valid date.";
  } else if (values.date > todayISO()) {
    errors.date = "Date can't be in the future.";
  } else if (values.date < "1900-01-01") {
    errors.date = "Date is too far in the past.";
  }

  const cleanedAmount = values.amount.trim().replace(/[$,\s]/g, "");
  const amount = Number(cleanedAmount);
  if (!cleanedAmount) {
    errors.amount = "Please enter an amount.";
  } else if (!/^\d+(\.\d{0,2})?$/.test(cleanedAmount) || !Number.isFinite(amount)) {
    errors.amount = "Enter a number with up to 2 decimal places.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  } else if (amount >= MAX_AMOUNT) {
    errors.amount = "Amount must be under $1,000,000.";
  }

  if (!(CATEGORIES as readonly string[]).includes(values.category)) {
    errors.category = "Please choose a category.";
  }

  const description = values.description.trim();
  if (!description) {
    errors.description = "Please add a short description.";
  } else if (description.length > MAX_DESCRIPTION) {
    errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
  }

  if (Object.keys(errors).length > 0) return { errors, data: null };

  return {
    errors,
    data: {
      date: values.date,
      amount: Math.round(amount * 100) / 100,
      category: values.category as ExpenseInput["category"],
      description,
    },
  };
}
