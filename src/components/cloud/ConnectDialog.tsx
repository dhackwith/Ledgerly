"use client";

import { useState } from "react";
import { DESTINATIONS, type IntegrationId } from "@/lib/cloud/destinations";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WalletIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/providers/ToastProvider";
import { DestinationLogo } from "./bits";
import { useCloud } from "./CloudProvider";

/** A stand-in for an OAuth consent screen: same steps, no network. */
export function ConnectDialog({ id, onClose, onConnected }: { id: IntegrationId; onClose: () => void; onConnected?: () => void }) {
  const def = DESTINATIONS[id];
  const { connect } = useCloud();
  const { notify } = useToast();
  const [phase, setPhase] = useState<"consent" | "connecting">("consent");

  const allow = async () => {
    setPhase("connecting");
    await new Promise((r) => setTimeout(r, 1100));
    connect(id);
    notify(`${def.name} connected`);
    onConnected?.();
    onClose();
  };

  return (
    <Modal open onClose={phase === "connecting" ? () => {} : onClose} title={`Connect ${def.name}`} size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3 py-2" aria-hidden>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
            <WalletIcon className="h-6 w-6" />
          </span>
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full bg-slate-300 ${phase === "connecting" ? "animate-pulse" : ""}`}
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <DestinationLogo id={id} size="lg" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Ledgerly would like to:</p>
          <ul className="mt-2 space-y-2">
            {(def.scopes ?? []).map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-slate-600">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.58l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Ledgerly can&apos;t see anything else in your account. You can disconnect at any time.</p>
        </div>

        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
          <span className="font-semibold">Simulated connection.</span> A production build would open {def.name}&apos;s own sign-in page here. In this
          demo, nothing is sent to {def.name} and no account is accessed.
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={phase === "connecting"}>
            Cancel
          </Button>
          <Button onClick={allow} loading={phase === "connecting"} data-autofocus>
            {phase === "connecting" ? "Connecting…" : "Allow access"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
