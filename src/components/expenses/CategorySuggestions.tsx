"use client";

import { Component, type ReactNode } from "react";
import type { Category, SuggestionDisplay } from "@/lib/types";
import type { RankedCategory } from "@/lib/ml/contract";
import { CATEGORY_META } from "@/lib/categories";

/** Id of the line explaining a pre-selected suggestion; the suggested radio points at it. */
export const SUGGESTION_REASON_ID = "expense-category-suggestion";

export function toPercent(p: number): number {
  return Math.round(p * 100);
}

interface CategorySuggestionsProps {
  /** What the form is showing. "preselected" here means the tag is on a tile; the form owns the selection. */
  display: SuggestionDisplay;
  ranked: readonly RankedCategory[];
  reason: string | null;
  /** True while the suggested category is selected for the user rather than by them. */
  autoSelected: boolean;
  onChoose: (category: Category) => void;
}

/** Suggestion chips, the reason line and the screen reader announcement. Sits above the category tiles. */
export function CategorySuggestions({ display, ranked, reason, autoSelected, onChoose }: CategorySuggestionsProps) {
  const top = display === "none" ? undefined : ranked[0];
  const reasonText = reason?.trim().replace(/[.\s]+$/, "");

  return (
    <>
      {/* Always rendered so screen readers pick up changes. The text only changes when the top category does. */}
      <p aria-live="polite" className="sr-only">
        {top ? `Suggested category: ${top.category}` : ""}
      </p>

      {top && display === "chips" && (
        <div role="group" aria-label="Suggested categories" className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500" aria-hidden>
            Suggested:
          </span>
          {ranked.map(({ category, p }) => (
            <button
              key={category}
              type="button"
              onClick={() => onChoose(category)}
              aria-label={`Use ${category}, ${toPercent(p)} percent`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span aria-hidden>{CATEGORY_META[category].icon}</span>
              {category}
              <span className="tabular-nums text-slate-500">{toPercent(p)}%</span>
            </button>
          ))}
        </div>
      )}

      {top && display === "chips" && reasonText && <p className="mt-1.5 text-xs text-slate-500">{reasonText}.</p>}

      {top && display === "preselected" && (
        <p id={SUGGESTION_REASON_ID} className="mt-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Suggested:</span> {reasonText || top.category}.
          {autoSelected && " Choose another category to change it."}
        </p>
      )}
    </>
  );
}

interface SuggestionErrorBoundaryProps {
  children: ReactNode;
  /** Called once when rendering the suggestion UI fails, so the form can drop the suggestion. */
  onError: () => void;
}

/** If the suggestion UI throws, render nothing and let the form carry on without suggestions. */
export class SuggestionErrorBoundary extends Component<SuggestionErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Category suggestions failed to render", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
