// PLACEHOLDER: owned by the ml-engine feature, which replaces this file with the real engine.
// The signatures must stay as they are; see contract.ts.
import { noSuggestion, type CreateSuggester } from "./contract";

export const MODEL_VERSION = "0-stub";

export const createSuggester: CreateSuggester = () => ({
  suggest: () => noSuggestion(MODEL_VERSION),
});
