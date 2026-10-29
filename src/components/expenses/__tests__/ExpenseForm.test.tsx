// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Expense } from "@/lib/types";
import type { MlSettings, SuggestionQuery, SuggestionResult } from "@/lib/ml/contract";
import { todayISO } from "@/lib/format";
import { ExpenseForm } from "../ExpenseForm";
import { SUGGEST_DEBOUNCE_MS } from "../useCategorySuggestions";
import { expense, suggestion, TEST_MODEL_VERSION } from "./fixtures";

const h = vi.hoisted(() => ({
  respond: (() => null) as (q: SuggestionQuery) => SuggestionResult | null,
  suggest: vi.fn(),
  createSuggester: vi.fn(),
  recordFeedback: vi.fn(),
  settings: { enabled: true, resetAt: null } as MlSettings,
  expenses: [] as Expense[],
}));

vi.mock("@/lib/ml", () => ({
  MODEL_VERSION: "test-1",
  createSuggester: (...args: unknown[]) => h.createSuggester(...args),
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
  useExpenses: () => ({ expenses: h.expenses }),
}));

const NONE = suggestion("none", []);

/** Engine answers keyed by the trimmed, lower-cased description. Anything else gets no suggestion. */
function engine(answers: Record<string, SuggestionResult>) {
  h.respond = (q) => answers[q.description.toLowerCase()] ?? NONE;
}

const radio = (c: Category) => screen.getByRole("radio", { name: new RegExp(`^${c}`) }) as HTMLInputElement;
const checkedCategory = () =>
  (screen.getAllByRole("radio") as HTMLInputElement[]).find((r) => r.checked)?.value ?? null;
const tagOf = (c: Category) => radio(c).closest("label")!.textContent!.includes("Suggested");
const liveRegion = () => document.querySelector('[aria-live="polite"]')!;
/** Waits past the debounce, for asserting that nothing appears. */
const settle = () => act(() => new Promise((r) => setTimeout(r, SUGGEST_DEBOUNCE_MS * 2)));

function renderForm(initial?: Expense) {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<ExpenseForm initial={initial} onSubmit={onSubmit} onCancel={() => {}} />);
  const amount = screen.getByLabelText("Amount");
  const description = screen.getByLabelText("Description");
  return { onSubmit, user, amount, description };
}

beforeEach(() => {
  h.settings = { enabled: true, resetAt: null };
  h.respond = () => NONE;
  h.suggest.mockReset().mockImplementation((q: SuggestionQuery) => h.respond(q));
  h.createSuggester.mockReset().mockImplementation(() => ({ suggest: h.suggest }));
  h.recordFeedback.mockReset();
  h.expenses = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExpenseForm field order", () => {
  it("puts Amount, Description, Category, Date in that order", () => {
    renderForm();
    const fields = [
      screen.getByLabelText("Amount"),
      screen.getByLabelText("Description"),
      screen.getByRole("radiogroup"),
      screen.getByLabelText("Date"),
    ];
    for (let i = 1; i < fields.length; i++) {
      expect(fields[i - 1].compareDocumentPosition(fields[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe("ExpenseForm pre-selection", () => {
  it("pre-selects a confident suggestion with a text tag and the reason", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]], "You filed 'Uber' as Transportation 6 times.") });
    const { user, description } = renderForm();
    await user.type(description, "uber");

    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    expect(tagOf("Transportation")).toBe(true);
    expect(tagOf("Food")).toBe(false);
    const reason = screen.getByText(/You filed 'Uber' as Transportation 6 times/);
    expect(radio("Transportation").getAttribute("aria-describedby")).toBe(reason.closest("p")!.id);
  });

  it("keeps the tag out of the tile's layout, so tiles don't grow when a suggestion appears", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, description } = renderForm();
    await user.type(description, "uber");

    const tag = await screen.findByTestId("suggested-tag");
    expect(tag.classList).toContain("absolute");
    const tile = radio("Transportation").closest("label")!;
    expect(tile.classList).toContain("relative");
    expect(tile.classList).not.toContain("flex-wrap");
  });

  it("follows the prediction while the user hasn't chosen", async () => {
    engine({
      uber: suggestion("preselected", [["Transportation", 0.92]]),
      "uber eats": suggestion("preselected", [["Food", 0.9]]),
      "uber eats gift": suggestion("chips", [["Food", 0.6], ["Shopping", 0.3]]),
    });
    const { user, description } = renderForm();
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));

    await user.type(description, " eats");
    await waitFor(() => expect(checkedCategory()).toBe("Food"));
    expect(tagOf("Transportation")).toBe(false);

    await user.type(description, " gift");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Use Food, 60 percent" })).not.toBeNull());
    expect(checkedCategory()).toBeNull();
  });

  it("clears the auto-selection when the description gets too short", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, description } = renderForm();
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.clear(description);
    expect(checkedCategory()).toBeNull();
  });

  it("never overwrites a category the user picked first", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, description } = renderForm();
    await user.click(radio("Food"));
    await user.type(description, "uber");

    await waitFor(() => expect(tagOf("Transportation")).toBe(true));
    expect(checkedCategory()).toBe("Food");
  });

  it("never overwrites a category the user picked after a pre-selection", async () => {
    engine({
      uber: suggestion("preselected", [["Transportation", 0.92]]),
      "uber eats": suggestion("preselected", [["Shopping", 0.88]]),
    });
    const { user, description } = renderForm();
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.click(radio("Food"));
    expect(checkedCategory()).toBe("Food");

    await user.type(description, " eats");
    await waitFor(() => expect(tagOf("Shopping")).toBe(true));
    expect(checkedCategory()).toBe("Food");
  });

  it("keeps a pre-selection the user confirmed by clicking it", async () => {
    engine({
      uber: suggestion("preselected", [["Transportation", 0.92]]),
      "uber eats": suggestion("chips", [["Food", 0.6]]),
    });
    const { user, description } = renderForm();
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.click(radio("Transportation"));

    await user.type(description, " eats");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Use Food, 60 percent" })).not.toBeNull());
    expect(checkedCategory()).toBe("Transportation");
  });
});

describe("ExpenseForm chips", () => {
  it("shows up to three chips at medium confidence and selects on click", async () => {
    engine({
      coffee: suggestion("chips", [["Food", 0.62], ["Shopping", 0.25], ["Other", 0.08]], "Similar to 'Starbucks'"),
    });
    const { user, description } = renderForm();
    await user.type(description, "coffee");

    const chip = await screen.findByRole("button", { name: "Use Food, 62 percent" });
    expect(screen.getByRole("button", { name: "Use Shopping, 25 percent" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Use Other, 8 percent" })).not.toBeNull();
    expect(screen.getByText("Similar to 'Starbucks'.")).not.toBeNull();
    expect(checkedCategory()).toBeNull();

    await user.click(chip);
    expect(checkedCategory()).toBe("Food");
  });
});

describe("ExpenseForm with nothing to suggest", () => {
  it("shows nothing when the engine says none", async () => {
    engine({ stuff: suggestion("none", [["Other", 0.3]]) });
    const { user, description } = renderForm();
    await user.type(description, "stuff");
    await waitFor(() => expect(h.suggest).toHaveBeenCalled());
    await settle();

    expect(screen.queryByRole("group", { name: "Suggested categories" })).toBeNull();
    expect(screen.queryByText("Suggested")).toBeNull();
    expect(checkedCategory()).toBeNull();
    expect(liveRegion().textContent).toBe("");
  });

  it("doesn't ask the engine about text shorter than 2 characters", async () => {
    h.respond = () => suggestion("preselected", [["Food", 0.95]]);
    const { user, description } = renderForm();
    await user.type(description, "u");
    await settle();

    expect(h.suggest).not.toHaveBeenCalled();
    expect(checkedCategory()).toBeNull();
  });

  it("shows nothing and records nothing when suggestions are turned off", async () => {
    h.settings = { enabled: false, resetAt: null };
    h.respond = () => suggestion("preselected", [["Transportation", 0.95]]);
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "12");
    await user.type(description, "uber");
    await settle();

    expect(h.createSuggester).not.toHaveBeenCalled();
    expect(checkedCategory()).toBeNull();

    await user.click(radio("Transportation"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]).toHaveLength(1);
    expect(h.recordFeedback).not.toHaveBeenCalled();
  });
});

describe("ExpenseForm in edit mode", () => {
  it("never changes the saved category, even for a confident suggestion", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.97]]) });
    renderForm(expense({ category: "Food", description: "uber" }));
    await waitFor(() => expect(h.suggest).toHaveBeenCalled());
    await settle();

    expect(h.suggest).toHaveBeenCalledWith(expect.objectContaining({ mode: "edit", currentCategory: "Food" }));
    expect(checkedCategory()).toBe("Food");
    expect(screen.queryByText("Suggested")).toBeNull();
  });

  it("leaves the expense being edited out of the training data", async () => {
    const editing = expense({ id: "editing", category: "Food", description: "uber" });
    const other = expense({ id: "other", category: "Transportation", description: "uber" });
    h.expenses = [editing, other];
    renderForm(editing);
    await waitFor(() => expect(h.createSuggester).toHaveBeenCalled());

    const training = h.createSuggester.mock.calls.at(-1)![0] as Expense[];
    expect(training.map((e) => e.id)).toEqual(["other"]);
  });

  it("shows chips when the engine returns them, and a chip selects", async () => {
    engine({ "uber ride": suggestion("chips", [["Transportation", 0.93]]) });
    const { user, description } = renderForm(expense({ category: "Food", description: "uber" }));
    await user.type(description, " ride");

    const chip = await screen.findByRole("button", { name: "Use Transportation, 93 percent" });
    expect(checkedCategory()).toBe("Food");
    await user.click(chip);
    expect(checkedCategory()).toBe("Transportation");
  });
});

describe("ExpenseForm announcements", () => {
  it("announces each new suggestion once, not on every keystroke", async () => {
    // Prefix-based so a slow keystroke can't produce an in-between "no suggestion".
    h.respond = (q) =>
      q.description.endsWith("eats")
        ? suggestion("chips", [["Food", 0.7]])
        : suggestion("preselected", [["Transportation", 0.92]]);
    const { user, description } = renderForm();
    const region = liveRegion();
    const changes: string[] = [];
    const observer = new MutationObserver(() => changes.push(region.textContent ?? ""));
    observer.observe(region, { childList: true, characterData: true, subtree: true });

    await user.type(description, "uber");
    await waitFor(() => expect(region.textContent).toBe("Suggested category: Transportation"));
    await user.type(description, " ride");
    await waitFor(() => expect(h.suggest).toHaveBeenLastCalledWith(expect.objectContaining({ description: "uber ride" })));
    await settle();
    expect(changes).toEqual(["Suggested category: Transportation"]);

    await user.type(description, " eats");
    await waitFor(() => expect(region.textContent).toBe("Suggested category: Food"));
    observer.disconnect();
    expect(changes).toEqual(["Suggested category: Transportation", "Suggested category: Food"]);
  });
});

describe("ExpenseForm submit", () => {
  const today = todayISO();

  it("passes the record and feedback for an accepted pre-selection", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "12.50");
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(h.recordFeedback).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      { date: today, amount: 12.5, category: "Transportation", description: "uber" },
      { category: "Transportation", confidence: 0.92, shown: "preselected", accepted: true, modelVersion: TEST_MODEL_VERSION },
    );
    expect(h.recordFeedback).toHaveBeenCalledWith({
      t: expect.any(String),
      predicted: "Transportation",
      confidence: 0.92,
      final: "Transportation",
      shown: "preselected",
      modelVersion: TEST_MODEL_VERSION,
    });
    expect(Number.isNaN(Date.parse(h.recordFeedback.mock.calls[0][0].t))).toBe(false);
  });

  it("marks an overridden pre-selection as not accepted", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "30");
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.click(radio("Food"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(h.recordFeedback).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      { date: today, amount: 30, category: "Food", description: "uber" },
      { category: "Transportation", confidence: 0.92, shown: "preselected", accepted: false, modelVersion: TEST_MODEL_VERSION },
    );
    expect(h.recordFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ predicted: "Transportation", final: "Food", shown: "preselected" }),
    );
  });

  it("records chips as shown, accepted or not", async () => {
    engine({ coffee: suggestion("chips", [["Food", 0.62], ["Shopping", 0.25]]) });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "4");
    await user.type(description, "coffee");
    await user.click(await screen.findByRole("button", { name: "Use Shopping, 25 percent" }));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(h.recordFeedback).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({
      category: "Food",
      confidence: 0.62,
      shown: "chips",
      accepted: false,
      modelVersion: TEST_MODEL_VERSION,
    });
    expect(h.recordFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ predicted: "Food", confidence: 0.62, final: "Shopping", shown: "chips" }),
    );
  });

  it("records a 'none' outcome without a suggestion record when nothing was shown", async () => {
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "9");
    await user.type(description, "stuff");
    await user.click(radio("Other"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(h.recordFeedback).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]).toHaveLength(1);
    expect(h.recordFeedback).toHaveBeenCalledWith({
      t: expect.any(String),
      predicted: null,
      confidence: 0,
      final: "Other",
      shown: "none",
      modelVersion: TEST_MODEL_VERSION,
    });
  });

  it("still saves when recording feedback throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.recordFeedback.mockImplementation(() => {
      throw new Error("quota");
    });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "9");
    await user.type(description, "stuff");
    await user.click(radio("Other"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(h.recordFeedback).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("records no feedback when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, amount, description, onSubmit } = renderForm();
    onSubmit.mockRejectedValue(new Error("storage"));
    await user.type(amount, "12");
    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(h.recordFeedback).not.toHaveBeenCalled();
  });
});

describe("ExpenseForm validation", () => {
  it("still requires a category when nothing is suggested", async () => {
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "9");
    await user.type(description, "stuff");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(screen.getByText("Please choose a category.")).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(h.recordFeedback).not.toHaveBeenCalled();
  });

  it("doesn't submit a chip suggestion the user didn't pick", async () => {
    engine({ coffee: suggestion("chips", [["Food", 0.62]]) });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "4");
    await user.type(description, "coffee");
    await screen.findByRole("button", { name: "Use Food, 62 percent" });
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(screen.getByText("Please choose a category.")).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the category error once a suggestion is pre-selected", async () => {
    engine({ uber: suggestion("preselected", [["Transportation", 0.92]]) });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "12");
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(screen.getByText("Please choose a category.")).not.toBeNull();

    await user.type(description, "uber");
    await waitFor(() => expect(checkedCategory()).toBe("Transportation"));
    expect(screen.queryByText("Please choose a category.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("focuses the first invalid field in visual order", async () => {
    const { user, amount, description } = renderForm();
    await user.type(amount, "9");
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(document.activeElement).toBe(description);
  });
});

describe("ExpenseForm with a failing engine", () => {
  it("behaves like the plain form and logs once", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    h.suggest.mockImplementation(() => {
      throw new Error("engine broke");
    });
    const { user, amount, description, onSubmit } = renderForm();
    await user.type(amount, "12");
    await user.type(description, "uber");
    await waitFor(() => expect(h.suggest).toHaveBeenCalled());
    await user.type(description, " ride");
    await waitFor(() => expect(h.suggest).toHaveBeenLastCalledWith(expect.objectContaining({ description: "uber ride" })));

    expect(error).toHaveBeenCalledTimes(1);
    expect(checkedCategory()).toBeNull();

    await user.click(radio("Transportation"));
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ date: todayISO(), amount: 12, category: "Transportation", description: "uber ride" });
  });
});
