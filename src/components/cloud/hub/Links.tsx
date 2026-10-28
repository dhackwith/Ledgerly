"use client";

import { useState } from "react";
import { formatDateTime, relativeTime } from "@/lib/cloud/schedule";
import type { ShareLinkRecord } from "@/lib/cloud/state";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { useCloud } from "../CloudProvider";
import { useNow } from "../ActivityTray";
import { LinkResult } from "../Previews";
import { Panel } from "./shared";

export function Links() {
  const { state, removeLink, openComposer } = useCloud();
  const { notify } = useToast();
  const now = useNow();
  const [showing, setShowing] = useState<ShareLinkRecord | null>(null);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copied");
    } catch {
      notify("Couldn't copy the link.", { variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Share links"
        description="Links you've created on this device. Recipients don't need an account."
        action={<Button onClick={() => openComposer({ destination: "link" })}>New link</Button>}
      >
        {state.links.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No links yet. Share a report and it shows up here with its QR code.</p>
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {state.links.map((l) => {
              const expired = Boolean(l.expiresAt && new Date(l.expiresAt) <= now);
              return (
                <li key={l.id} className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center ${expired ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {l.protected && (
                        <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-label="Password protected">
                          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                      )}
                      {l.title} · {l.period}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Created <time title={formatDateTime(l.createdAt)}>{relativeTime(l.createdAt, now)}</time> · {l.scope === "full" ? `${l.records} transactions` : "Totals only"} ·{" "}
                      {expired ? (
                        <span className="font-medium text-red-600">Expired</span>
                      ) : l.expiresAt ? (
                        `Expires ${relativeTime(l.expiresAt, now)}`
                      ) : (
                        "No expiry"
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => copy(l.url)} disabled={expired}>
                      Copy
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowing(l)} disabled={expired}>
                      QR code
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.open(l.url, "_blank", "noopener")}>
                      Open
                    </Button>
                    <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => removeLink(l.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Links carry the report inside them, so removing one here only removes it from this list. Anyone who already has the link can still open it until it expires.
      </p>
      {showing && (
        <Modal open onClose={() => setShowing(null)} title="Share link" size="xl">
          <LinkResult link={showing} />
        </Modal>
      )}
    </div>
  );
}
