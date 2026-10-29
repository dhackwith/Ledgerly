// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategorySuggestions, SUGGESTION_REASON_ID, SuggestionErrorBoundary, toPercent } from "../CategorySuggestions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CategorySuggestions", () => {
  it("labels chips with the category and percentage", async () => {
    const onChoose = vi.fn();
    render(
      <CategorySuggestions
        display="chips"
        ranked={[
          { category: "Food", p: 0.624 },
          { category: "Shopping", p: 0.25 },
        ]}
        reason={null}
        autoSelected={false}
        onChoose={onChoose}
      />,
    );
    const chip = screen.getByRole("button", { name: "Use Food, 62 percent" });
    expect(chip.textContent).toContain("62%");
    await userEvent.setup().click(screen.getByRole("button", { name: "Use Shopping, 25 percent" }));
    expect(onChoose).toHaveBeenCalledWith("Shopping");
  });

  it("explains a pre-selection in text, with a hint while it's automatic", () => {
    const { rerender } = render(
      <CategorySuggestions
        display="preselected"
        ranked={[{ category: "Bills", p: 0.9 }]}
        reason="You filed 'Comcast' as Bills 3 times."
        autoSelected
        onChoose={() => {}}
      />,
    );
    const line = document.getElementById(SUGGESTION_REASON_ID)!;
    expect(line.textContent).toBe("Suggested: You filed 'Comcast' as Bills 3 times. Choose another category to change it.");

    rerender(
      <CategorySuggestions display="preselected" ranked={[{ category: "Bills", p: 0.9 }]} reason={null} autoSelected={false} onChoose={() => {}} />,
    );
    expect(document.getElementById(SUGGESTION_REASON_ID)!.textContent).toBe("Suggested: Bills.");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders only an empty live region when there's nothing to show", () => {
    const { container } = render(
      <CategorySuggestions display="none" ranked={[{ category: "Food", p: 0.3 }]} reason="x" autoSelected={false} onChoose={() => {}} />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("rounds percentages", () => {
    expect(toPercent(0.625)).toBe(63);
    expect(toPercent(0.004)).toBe(0);
  });
});

describe("SuggestionErrorBoundary", () => {
  it("renders nothing and reports once when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    function Broken(): never {
      throw new Error("boom");
    }
    const { container } = render(
      <div>
        <SuggestionErrorBoundary onError={onError}>
          <Broken />
        </SuggestionErrorBoundary>
        <span>still here</span>
      </div>,
    );
    expect(container.textContent).toBe("still here");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("renders its children when nothing fails", () => {
    render(
      <SuggestionErrorBoundary onError={() => {}}>
        <span>chips</span>
      </SuggestionErrorBoundary>,
    );
    expect(screen.getByText("chips")).not.toBeNull();
  });
});
