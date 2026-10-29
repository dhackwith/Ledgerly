// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SuggestionResult } from "@/lib/ml/contract";
import { todayISO } from "@/lib/format";
import { ExpenseForm } from "../ExpenseForm";
import { suggestion } from "./fixtures";

const h = vi.hoisted(() => ({
  suggest: vi.fn(),
  recordFeedback: vi.fn(),
  settings: { enabled: true, resetAt: null },
}));

vi.mock("@/lib/ml", () => ({
  MODEL_VERSION: "test-1",
  createSuggester: () => ({ suggest: h.suggest }),
}));
vi.mock("@/lib/ml/settings", () => ({
  DEFAULT_ML_SETTINGS: { enabled: false, resetAt: null },
  getMlSettings: () => h.settings,
  subscribeMlSettings: () => () => {},
}));
vi.mock("@/lib/ml/feedback", () => ({
  recordFeedback: (...args: unknown[]) => h.recordFeedback(...args),
}));
vi.mock("@/components/providers/ExpenseProvider", () => ({
  useExpenses: () => ({ expenses: [] }),
}));
// The real boundary, around a suggestion UI that fails as soon as it has something to show.
vi.mock("../CategorySuggestions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../CategorySuggestions")>();
  return {
    ...actual,
    CategorySuggestions: (props: Parameters<typeof actual.CategorySuggestions>[0]) => {
      if (props.display !== "none") throw new Error("render failed");
      return actual.CategorySuggestions(props);
    },
  };
});

beforeEach(() => {
  h.suggest.mockReset().mockReturnValue(suggestion("preselected", [["Transportation", 0.92]]) as SuggestionResult);
  h.recordFeedback.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExpenseForm suggestion error boundary", () => {
  it("falls back to the plain form when the suggestion UI throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseForm onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Amount"), "12");
    await user.type(screen.getByLabelText("Description"), "uber");
    await waitFor(() => expect(error).toHaveBeenCalledWith("Category suggestions failed to render", expect.any(Error)));

    // No pre-selection and no tag survive the failure.
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((r) => r.checked)).toBe(false);
    expect(screen.queryByText("Suggested")).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Food/ }));
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ date: todayISO(), amount: 12, category: "Food", description: "uber" });
    expect(h.recordFeedback).toHaveBeenCalledWith(expect.objectContaining({ predicted: null, shown: "none", final: "Food" }));
  });
});
