// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ML_SETTINGS_KEY, type FeedbackEvent } from "@/lib/ml/contract";
import { readFeedback, recordFeedback } from "@/lib/ml/feedback";
import { clearMlStorage, getMlSettings, setMlSettings } from "@/lib/ml/settings";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SmartSuggestionsCard } from "../SmartSuggestionsCard";

// Node 26 has its own localStorage (unusable without --localstorage-file) that shadows jsdom's. Use jsdom's.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
Object.defineProperty(globalThis, "localStorage", { value: jsdomWindow.localStorage, configurable: true, writable: true });

function event(overrides: Partial<FeedbackEvent> = {}): FeedbackEvent {
  return { t: "2026-10-28T10:00:00.000Z", predicted: "Food", confidence: 0.9, final: "Food", shown: "preselected", modelVersion: "1", ...overrides };
}

function renderCard() {
  return render(
    <ToastProvider>
      <SmartSuggestionsCard />
    </ToastProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  clearMlStorage(); // also resets the in-memory settings between tests
});

afterEach(() => {
  cleanup();
});

describe("SmartSuggestionsCard", () => {
  it("toggles suggestions with an accessible switch and persists the choice", async () => {
    const user = userEvent.setup();
    renderCard();
    const toggle = screen.getByRole("switch", { name: "Suggest categories" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(JSON.parse(localStorage.getItem(ML_SETTINGS_KEY)!).enabled).toBe(true);
    expect(getMlSettings().enabled).toBe(true);

    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("follows changes made outside the card", () => {
    renderCard();
    act(() => setMlSettings({ enabled: true }));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("shows an empty state when no suggestions have been shown", () => {
    recordFeedback(event({ shown: "none" }));
    renderCard();
    expect(screen.getByText(/No suggestions yet/)).toBeTruthy();
    expect(screen.queryByText(/accepted over the last/)).toBeNull();
  });

  it("shows accuracy overall and split by how the suggestion was shown", () => {
    // Recorded oldest first; the log keeps the most recent first.
    recordFeedback(event());
    recordFeedback(event({ final: "Bills" }));
    recordFeedback(event());
    recordFeedback(event({ shown: "chips", predicted: "Shopping", final: "Shopping" }));
    recordFeedback(event({ shown: "none" }));
    renderCard();

    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("accepted over the last 4 suggestions")).toBeTruthy();
    const pre = screen.getByText("Pre-selected").parentElement!;
    expect(pre.textContent).toContain("67% (2 of 3)");
    const chips = screen.getByText("Chips").parentElement!;
    expect(chips.textContent).toContain("100% (1 of 1)");
  });

  it("updates when feedback is recorded while the card is open", () => {
    renderCard();
    expect(screen.getByText(/No suggestions yet/)).toBeTruthy();
    act(() => recordFeedback(event({ final: "Bills" })));
    expect(screen.getByText("Pre-selected").parentElement!.textContent).toContain("0% (0 of 1)");
    expect(screen.getByText("accepted over the last 1 suggestion")).toBeTruthy();
  });

  it("says everything stays on the device", () => {
    renderCard();
    expect(screen.getByText("Everything runs on this device. Nothing is sent anywhere.")).toBeTruthy();
  });

  it("asks before resetting, and cancel keeps the history", async () => {
    const user = userEvent.setup();
    recordFeedback(event());
    renderCard();

    await user.click(screen.getByRole("button", { name: "Reset learning" }));
    const dialog = screen.getByRole("dialog", { name: "Reset learning?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readFeedback()).toHaveLength(1);
    expect(getMlSettings().resetAt).toBeNull();
    expect(screen.getByText("accepted over the last 1 suggestion")).toBeTruthy();
  });

  it("resets learning on confirm and confirms with a toast", async () => {
    const user = userEvent.setup();
    localStorage.setItem("expense-tracker:expenses:v1", "[]");
    recordFeedback(event());
    renderCard();

    await user.click(screen.getByRole("button", { name: "Reset learning" }));
    const dialog = screen.getByRole("dialog", { name: "Reset learning?" });
    await user.click(within(dialog).getByRole("button", { name: "Reset learning" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readFeedback()).toEqual([]);
    expect(getMlSettings().resetAt).not.toBeNull();
    expect(localStorage.getItem("expense-tracker:expenses:v1")).toBe("[]");
    expect(screen.getByText(/No suggestions yet/)).toBeTruthy();
    expect(screen.getByText(/Last reset/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Learning reset");
  });
});
