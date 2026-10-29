/**
 * On-device smart category suggestions. See development_plan.txt section 3
 * and contract.ts. Everything here is pure TypeScript: no DOM, storage,
 * timers or network, so it is safe to import during server rendering.
 */
import { noSuggestion, type CreateSuggester } from "./contract";
import { buildModel } from "./suggester";
import { MODEL_VERSION } from "./version";

export { MODEL_VERSION };

export const createSuggester: CreateSuggester = (expenses, options) => {
  try {
    return buildModel(expenses, options);
  } catch (error) {
    // A broken build must never break the form: fall back to "no suggestion" (plan 6.3).
    console.warn("Category suggestions are unavailable:", error);
    return { suggest: () => noSuggestion(MODEL_VERSION) };
  }
};
