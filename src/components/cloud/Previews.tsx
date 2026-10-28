"use client";

import { useState } from "react";
import { displayCell, toDigest, type Report } from "@/lib/cloud/report";
import { relativeTime } from "@/lib/cloud/schedule";
import type { ShareLinkRecord } from "@/lib/cloud/state";
import { Button } from "@/components/ui/Button";
import { WalletIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/providers/ToastProvider";
import { QrCode } from "./bits";

const COLUMN_LETTERS = "ABCDEFGHIJKLMNOP";

/** What the first table looks like once it lands in a spreadsheet. */
export function SheetPreview({ report, name }: { report: Report; name: string }) {
  const table = report.tables[0];
  if (!table) return null;
  const rows = table.rows.slice(0, 6);
  const cols = Math.min(table.columns.length, 6);
  return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div className="flex items-center gap-2 bg-[#188038] px-3 py-2 text-xs font-medium text-white">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M5 9h14M5 14h14M11 9v11.5" />
        </svg>
        <span className="truncate">{name || "Untitled spreadsheet"}</span>
      </div>
      <div className="overflow-x-auto bg-white">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="bg-slate-50 text-slate-400">
              <th className="w-7 border border-slate-200 font-normal" />
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="border border-slate-200 px-2 py-0.5 font-normal">
                  {COLUMN_LETTERS[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[table.columns, ...rows].map((row, r) => (
              <tr key={r}>
                <td className="border border-slate-200 bg-slate-50 px-1 text-center text-slate-400">{r + 1}</td>
                {row.slice(0, cols).map((cell, c) => (
                  <td
                    key={c}
                    className={`max-w-[9rem] truncate whitespace-nowrap border border-slate-200 px-2 py-1 ${r === 0 ? "font-semibold text-slate-800" : "text-slate-700"} ${
                      r > 0 && typeof cell === "number" ? "text-right" : ""
                    }`}
                  >
                    {r === 0 ? String(cell) : displayCell(cell, table.kinds[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50 px-2 py-1.5">
        {report.tables.map((t, i) => (
          <span key={t.title} className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] ${i === 0 ? "bg-white font-medium text-[#188038] shadow-sm" : "text-slate-500"}`}>
            {t.title}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function EmailPreview({ report, to, subject, message, attachment }: { report: Report; to: string[]; subject: string; message: string; attachment: string }) {
  return (
    <figure className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <dl className="space-y-1 border-b border-slate-100 px-4 py-3 text-xs">
        <div className="flex gap-2">
          <dt className="w-14 text-slate-400">From</dt>
          <dd className="text-slate-700">Ledgerly Reports</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 text-slate-400">To</dt>
          <dd className="min-w-0 truncate text-slate-700">{to.length ? to.join(", ") : <span className="text-slate-400">Add a recipient</span>}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 text-slate-400">Subject</dt>
          <dd className="min-w-0 truncate font-medium text-slate-900">{subject}</dd>
        </div>
      </dl>
      <div className="max-h-56 overflow-y-auto px-4 py-3">
        {message.trim() && <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{message.trim()}</p>}
        <div className="grid grid-cols-2 gap-2">
          {report.metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</p>
              <p className="text-sm font-semibold text-slate-900">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M8 12.5l5.5-5.5a3 3 0 114.24 4.24L10.6 18.4a5 5 0 01-7.07-7.07L10 4.85" strokeLinecap="round" />
        </svg>
        <span className="font-mono">{attachment}</span>
      </figcaption>
    </figure>
  );
}

export function SlackPreview({ report, channel }: { report: Report; channel: string }) {
  return (
    <figure className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <figcaption className="mb-3 text-xs font-semibold text-slate-500">{channel || "#channel"}</figcaption>
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <WalletIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 text-sm">
          <p>
            <span className="font-bold text-slate-900">Ledgerly</span>{" "}
            <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">APP</span>{" "}
            <span className="text-xs text-slate-400">now</span>
          </p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-700">{toDigest(report)}</pre>
        </div>
      </div>
    </figure>
  );
}

/** The finished share link: copy it, scan it, open it, or hand it to the mail app. */
export function LinkResult({ link }: { link: ShareLinkRecord }) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Couldn't copy automatically. Select the link and copy it.", { variant: "error" });
    }
  };

  const downloadQr = () => {
    const svg = document.getElementById(`qr-${link.id}`)?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "ledgerly-share-qr.svg" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const mailto = `mailto:?subject=${encodeURIComponent(`${link.title} · ${link.period}`)}&body=${encodeURIComponent(
    `Here's my ${link.title.toLowerCase()} for ${link.period}:\n\n${link.url}${link.protected ? "\n\nI'll send you the password separately." : ""}`,
  )}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-5 rounded-2xl bg-gradient-to-br from-brand-50 via-white to-emerald-50 p-5 ring-1 ring-brand-100 sm:flex-row sm:items-start">
        <div id={`qr-${link.id}`} className="shrink-0">
          <QrCode text={link.url} size={168} label={`QR code for ${link.title}`} />
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <p className="text-base font-semibold text-slate-900">Your link is ready</p>
            <p className="text-sm text-slate-500">
              {link.title} · {link.period}
            </p>
          </div>
          <ul className="flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold sm:justify-start">
            <li className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${link.protected ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
              {link.protected ? "Password protected" : "Anyone with the link"}
            </li>
            <li className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-inset ring-slate-200">
              {link.scope === "full" ? `${link.records} transactions` : "Totals only"}
            </li>
            <li className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-inset ring-slate-200">
              {link.expiresAt ? `Expires ${relativeTime(link.expiresAt)}` : "Never expires"}
            </li>
          </ul>
          <div className="flex rounded-lg bg-white shadow-sm ring-1 ring-slate-300">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Share link" className="min-w-0 flex-1 rounded-l-lg border-0 bg-transparent px-3 py-2 font-mono text-xs text-slate-600 focus:ring-0" />
            <button type="button" onClick={copy} className="rounded-r-lg border-l border-slate-200 px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50" data-autofocus>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => window.open(link.url, "_blank", "noopener")}>
          Open preview
        </Button>
        <a href={mailto} className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
          Email the link
        </a>
        <Button variant="secondary" size="sm" onClick={downloadQr}>
          Download QR code
        </Button>
      </div>

      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
        The report travels inside the link itself, after the <span className="font-mono">#</span>, so it never touches a server.
        That also means a link can&apos;t be revoked once sent: use a password and an expiry date for anything sensitive.
      </p>
    </div>
  );
}
