import { describe, expect, it } from "vitest";
import { CHIPS_THRESHOLD, ML_KEY_PREFIX, ML_FEEDBACK_KEY, ML_SETTINGS_KEY, PRESELECT_THRESHOLD, noSuggestion } from "../contract";
import { createSuggester, MODEL_VERSION } from "../index";

describe("ml contract", () => {
  it("keeps ML storage keys out of the prefix that triggers expense reloads", () => {
    for (const key of [ML_SETTINGS_KEY, ML_FEEDBACK_KEY]) {
      expect(key.startsWith(ML_KEY_PREFIX)).toBe(true);
      expect(key.startsWith("expense-tracker:")).toBe(false);
    }
  });

  it("orders thresholds so pre-selection is stricter than chips", () => {
    expect(PRESELECT_THRESHOLD).toBeGreaterThan(CHIPS_THRESHOLD);
  });

  it("builds an empty suggestion", () => {
    expect(noSuggestion("v")).toEqual({ ranked: [], confidence: 0, display: "none", reason: null, modelVersion: "v" });
  });

  it("returns a well-formed result from createSuggester", () => {
    const result = createSuggester([]).suggest({ description: "uber", mode: "create" });
    expect(result.modelVersion).toBe(MODEL_VERSION);
    expect(result.ranked.length).toBeLessThanOrEqual(3);
    expect(["preselected", "chips", "none"]).toContain(result.display);
  });
});
