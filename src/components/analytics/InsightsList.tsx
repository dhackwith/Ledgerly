import type { Insight, InsightTone } from "@/lib/insights";

// Each tone has a glyph and a word, so the meaning survives without colour.
const TONES: Record<InsightTone, { glyph: string; label: string; className: string }> = {
  up: { glyph: "▲", label: "Up", className: "bg-red-50 text-red-700 ring-red-600/20" },
  down: { glyph: "▼", label: "Down", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  neutral: { glyph: "•", label: "Note", className: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

export function InsightsList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-slate-500">Add a few expenses and insights will appear here.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map((insight) => {
        const tone = TONES[insight.tone];
        return (
          <li key={insight.id} className="flex gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/60">
            <span
              className={`mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold ring-1 ring-inset ${tone.className}`}
            >
              <span aria-hidden>{tone.glyph}</span>
              {tone.label}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
              <p className="mt-1 text-sm text-slate-500">{insight.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
