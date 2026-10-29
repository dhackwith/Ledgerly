"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { parseBackup } from "@/lib/cloud/importing";
import { plural, type PortableExpense } from "@/lib/cloud/report";
import { formatDateTime, relativeTime } from "@/lib/cloud/schedule";
import { MAX_SNAPSHOTS, type Snapshot } from "@/lib/cloud/state";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useCloud } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { Panel, Switch } from "./shared";

const REASON: Record<Snapshot["reason"], string> = {
  auto: "Automatic",
  manual: "Saved by you",
  "before-restore": "Before a restore",
  "before-import": "Before an import",
};

export function Backups() {
  const { snapshots, takeSnapshot, restoreSnapshot, deleteSnapshot, setAutoSnapshots, runExport, importExpenses } = useCloud();
  const { expenses } = useExpenses();
  const { notify } = useToast();
  const now = useNow();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState<Snapshot | null>(null);
  const [incoming, setIncoming] = useState<{ name: string; list: PortableExpense[] } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("That file is larger than 5 MB, which is more than a Ledgerly backup should be.");
      setIncoming({ name: file.name, list: parseBackup(await file.text()) });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't read that file.", { variant: "error" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doImport = (mode: "merge" | "replace") => {
    if (!incoming) return;
    const { added, skipped } = importExpenses(incoming.list, mode, "import");
    notify(mode === "replace" ? `Replaced your data with ${plural(added, "expense")}` : `Imported ${plural(added, "expense")}${skipped ? `, skipped ${plural(skipped, "duplicate")}` : ""}`);
    setIncoming(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Panel
        className="lg:col-span-3"
        title="Version history"
        description={`Ledgerly saves a version of your data after you make changes, and keeps the last ${MAX_SNAPSHOTS}. Versions live in this browser.`}
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Automatic</span>
            <Switch checked={snapshots.auto} onChange={setAutoSnapshots} label="Automatic versions" />
          </div>
        }
      >
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => takeSnapshot("manual")} disabled={expenses.length === 0}>
            Save a version now
          </Button>
        </div>
        {snapshots.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No versions yet. One is saved shortly after your next change.</p>
        ) : (
          <ol className="relative space-y-1 border-l border-slate-200 pl-5">
            {snapshots.items.map((s, i) => (
              <li key={s.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                <span className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full ring-4 ring-white ${i === 0 ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    <time dateTime={s.at} title={formatDateTime(s.at)}>{relativeTime(s.at, now)}</time>
                    {i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Latest</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {REASON[s.reason]} · {s.count} expenses · {formatCurrency(s.total)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setRestoring(s)}>
                    Restore
                  </Button>
                  <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => deleteSnapshot(s.id)} aria-label={`Delete version from ${formatDateTime(s.at)}`}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <div className="space-y-6 lg:col-span-2">
        <Panel title="Backup files" description="Move your data to another browser or device.">
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => runExport({ template: "full-backup", params: {}, includeDetail: true, destination: "download", format: "json" })}
              disabled={expenses.length === 0}
            >
              Download a full backup
            </Button>
            <Button className="w-full" variant="secondary" onClick={() => fileRef.current?.click()}>
              Restore from a file…
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="text-xs text-slate-500">Accepts JSON exported from Ledgerly. Before anything changes, the current data is saved as a version.</p>
          </div>
        </Panel>
      </div>

      {restoring && (
        <Modal open onClose={() => setRestoring(null)} title="Restore this version?" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Your expenses will be replaced with the {restoring.count} saved {formatDateTime(restoring.at)}. Your current data is saved as a version first, so you
              can switch back.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setRestoring(null)}>
                Cancel
              </Button>
              <Button
                data-autofocus
                onClick={() => {
                  restoreSnapshot(restoring.id);
                  setRestoring(null);
                }}
              >
                Restore
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {incoming && (
        <Modal open onClose={() => setIncoming(null)} title="Import backup" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-mono text-slate-800">{incoming.name}</span> has {plural(incoming.list.length, "expense")} totaling{" "}
              {formatCurrency(incoming.list.reduce((a, e) => a + Math.round(e.amount * 100), 0) / 100)}.
            </p>
            <div className="grid gap-2">
              <Button data-autofocus onClick={() => doImport("merge")}>
                Add to my expenses (skip duplicates)
              </Button>
              <Button variant="secondary" onClick={() => doImport("replace")}>
                Replace all my expenses
              </Button>
              <Button variant="ghost" onClick={() => setIncoming(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
