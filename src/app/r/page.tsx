"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatCurrency } from "@/lib/format";
import { displayCell, plural, reportFilename, serialize, toTsv, type FileFormat } from "@/lib/cloud/report";
import { decodeShare, isExpired, isProtectedToken, type SharePayload } from "@/lib/cloud/share";
import { cleanPortable, saveFile, splitNew } from "@/lib/cloud/importing";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useCloud } from "@/components/cloud/CloudProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

type ViewState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "password"; token: string; error?: string; busy?: boolean }
  | { kind: "invalid"; reason: string }
  | { kind: "expired"; payload: SharePayload }
  | { kind: "ok"; payload: SharePayload };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-slate-200/70">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export default function SharedReportPage() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const { expenses, status } = useExpenses();
  const { importExpenses } = useCloud();
  const { notify } = useToast();

  useEffect(() => {
    const read = async () => {
      const token = decodeURIComponent(window.location.hash.slice(1));
      if (!token) return setView({ kind: "empty" });
      if (isProtectedToken(token)) return setView({ kind: "password", token });
      const r = await decodeShare(token);
      if (r.kind === "ok") setView(isExpired(r.payload) ? { kind: "expired", payload: r.payload } : { kind: "ok", payload: r.payload });
      else setView({ kind: "invalid", reason: r.kind === "invalid" ? r.reason : "This link can't be opened." });
    };
    void read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    if (view.kind !== "password" || !password) return;
    setView({ ...view, busy: true, error: undefined });
    const r = await decodeShare(view.token, password);
    if (r.kind === "ok") setView(isExpired(r.payload) ? { kind: "expired", payload: r.payload } : { kind: "ok", payload: r.payload });
    else if (r.kind === "wrong-password") setView({ kind: "password", token: view.token, error: "That password isn't right." });
    else setView({ kind: "invalid", reason: r.kind === "invalid" ? r.reason : "This link can't be opened." });
  };

  if (view.kind === "loading") return <Skeleton className="mx-auto h-64 max-w-3xl" />;
  if (view.kind === "empty")
    return (
      <Centered title="Nothing to show">
        This page opens reports shared from Ledgerly. The link you followed doesn&apos;t include one.{" "}
        <Link href="/share" className="font-semibold text-brand-600">
          Share a report
        </Link>
      </Centered>
    );
  if (view.kind === "invalid") return <Centered title="This link can't be opened">{view.reason}</Centered>;
  if (view.kind === "expired")
    return (
      <Centered title="This link has expired">
        {view.payload.from ? `${view.payload.from}` : "The sender"} set it to expire on{" "}
        {new Date(view.payload.expiresAt!).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Ask for a new link.
      </Centered>
    );
  if (view.kind === "password")
    return (
      <form onSubmit={unlock} className="mx-auto max-w-sm rounded-3xl bg-white p-8 shadow-card ring-1 ring-slate-200/70">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
        </span>
        <h1 className="mt-4 text-center text-lg font-semibold text-slate-900">This report is protected</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Enter the password the sender gave you. It&apos;s decrypted here, in your browser.</p>
        <label htmlFor="unlock-password" className="sr-only">
          Password
        </label>
        <input
          id="unlock-password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(view.error)}
          className={`mt-5 block w-full rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-brand-600 ${view.error ? "ring-red-400" : "ring-slate-300"}`}
        />
        {view.error && (
          <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            {view.error}
          </p>
        )}
        <Button type="submit" className="mt-4 w-full" loading={view.busy} disabled={!password}>
          {view.busy ? "Decrypting…" : "Open report"}
        </Button>
      </form>
    );

  const { payload } = view;
  const r = payload.report;
  const portable = cleanPortable(r.expenses ?? []);
  const { fresh, duplicates } = splitNew(portable, expenses);

  const download = (format: FileFormat) => {
    const file = serialize(r, format);
    saveFile(file.text, file.mime, reportFilename(r, file.extension));
  };

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">Shared report{payload.from ? ` from ${payload.from}` : ""}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{r.title}</h1>
        <p className="mt-1 text-brand-100">{r.period}</p>
        {payload.message && <blockquote className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90 ring-1 ring-white/15">“{payload.message}”</blockquote>}
        <p className="mt-4 text-xs text-slate-300">
          Shared {new Date(payload.sharedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          {payload.expiresAt ? ` · Expires ${new Date(payload.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => download("csv")}>
            Download CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => download("json")}>
            Download JSON
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(toTsv(r));
              notify("Copied. Paste into any spreadsheet.");
            }}
          >
            Copy as table
          </Button>
          {portable.length > 0 && (
            <Button size="sm" onClick={() => setImporting(true)} disabled={status !== "ready"}>
              Import into my Ledgerly
            </Button>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {r.metrics.map((m) => (
          <div key={m.label} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
            <dt className="text-xs font-medium text-slate-500">{m.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">{m.value}</dd>
            {m.hint && <dd className="text-xs text-slate-400">{m.hint}</dd>}
          </div>
        ))}
      </dl>

      {r.tables.map((t) => (
        <section key={t.title} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-semibold text-slate-900">{t.title}</h2>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {t.columns.map((c, i) => (
                    <th key={c} scope="col" className={`whitespace-nowrap px-4 py-2 font-semibold ${t.kinds[i] !== "text" && t.kinds[i] !== "date" ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {t.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2 ${typeof cell === "number" ? "whitespace-nowrap text-right tabular-nums" : ""} ${ci === 0 ? "font-medium text-slate-900" : "text-slate-700"}`}>
                        {displayCell(cell, t.kinds[ci])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {t.total && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <tr>
                    {t.total.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2 ${typeof cell === "number" ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                        {cell === "" ? "" : displayCell(cell, t.kinds[ci])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      ))}

      {r.notes.length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-slate-100/70 p-4 text-sm text-slate-600">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-slate-400">
        This report was decoded from the link in your browser. Nothing was loaded from a server. Made with{" "}
        <Link href="/" className="font-semibold text-slate-500 hover:text-slate-700">
          Ledgerly
        </Link>
        .
      </p>

      {importing && (
        <Modal open onClose={() => setImporting(false)} title="Import these expenses?" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {fresh.length > 0 ? (
                <>
                  {plural(fresh.length, "expense")} totaling {formatCurrency(fresh.reduce((a, e) => a + Math.round(e.amount * 100), 0) / 100)} will be added to the tracker in this
                  browser.
                  {duplicates > 0 && ` ${duplicates} you already have will be skipped.`}
                </>
              ) : (
                "You already have every expense in this report."
              )}
            </p>
            <p className="text-xs text-slate-500">Your current data is saved as a version first, so you can undo this from Share & sync → Backups.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setImporting(false)}>
                Cancel
              </Button>
              <Button
                data-autofocus
                disabled={fresh.length === 0}
                onClick={() => {
                  // Someone else's spending habits, so learning down-weights it.
                  const { added } = importExpenses(portable, "merge", "shared-import");
                  notify(`Imported ${plural(added, "expense")}`);
                  setImporting(false);
                }}
              >
                Import {fresh.length > 0 ? fresh.length : ""}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
