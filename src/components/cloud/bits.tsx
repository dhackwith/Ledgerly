"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { DESTINATIONS, type DestinationId, type Glyph } from "@/lib/cloud/destinations";

const GLYPHS: Record<Glyph, JSX.Element> = {
  download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  clipboard: (
    <>
      <rect x="6" y="5" width="12" height="15" rx="2" />
      <path d="M9.5 5V4a1 1 0 011-1h3a1 1 0 011 1v1M9 11h6M9 15h4" />
    </>
  ),
  link: <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  grid: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M5 9h14M5 14h14M11 9v11.5" />
    </>
  ),
  triangle: <path d="M9 4h6l6 10.5-3 5.5H6l-3-5.5L9 4zM3 14.5h18M9 4l6 10.5M15 4L9 14.5" />,
  box: <path d="M7 4l5 3.2L7 10.4 2 7.2 7 4zm10 0l5 3.2-5 3.2-5-3.2L17 4zM2 13.6l5-3.2 5 3.2-5 3.2-5-3.2zm15-3.2l5 3.2-5 3.2-5-3.2 5-3.2zM7 18.1l5 3.2 5-3.2" />,
  cloud: <path d="M7 18.5h10.5a4 4 0 00.6-7.95A5.5 5.5 0 007.4 9.1 4.75 4.75 0 007 18.5z" />,
  hash: <path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />,
};

export function DestinationLogo({ id, size = "md" }: { id: DestinationId; size?: "sm" | "md" | "lg" }) {
  const def = DESTINATIONS[id];
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-white shadow-sm ${box}`} style={{ backgroundColor: def.color }} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={icon}>
        {GLYPHS[def.glyph]}
      </svg>
    </span>
  );
}

export function SimulatedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-600/20 ${className}`}
      title="This integration is a simulation. Nothing is sent to the service."
    >
      Simulated
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: "green" | "blue" | "slate" | "red" | "amber"; pulse?: boolean }) {
  const color = { green: "bg-emerald-500", blue: "bg-brand-500", slate: "bg-slate-300", red: "bg-red-500", amber: "bg-amber-500" }[tone];
  return (
    <span className="relative inline-flex h-2 w-2" aria-hidden>
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

/** Byte-mode QR capacity at error correction level L, version 40. */
const QR_MAX_BYTES = 2953;

/**
 * Renders a QR code as crisp SVG. Returns a note instead when the text is too long
 * to fit, which happens for links that carry many transactions.
 */
export function QrCode({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const result = useMemo(() => {
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > QR_MAX_BYTES) return { tooLong: true as const, bytes };
    // Medium error correction when it fits, so a smudged print still scans.
    const level = bytes <= 2331 ? "M" : "L";
    const qr = qrcode(0, level);
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { tooLong: false as const, n, d };
  }, [text]);

  if (result.tooLong) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-4 text-center ring-1 ring-slate-200" style={{ width: size, height: size }}>
        <p className="text-xs font-semibold text-slate-700">Too much data for a QR code</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">Share totals only, or send the link instead.</p>
      </div>
    );
  }
  const quiet = 4;
  const view = result.n + quiet * 2;
  return (
    <svg viewBox={`${-quiet} ${-quiet} ${view} ${view}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges" className="rounded-xl bg-white ring-1 ring-slate-200">
      <rect x={-quiet} y={-quiet} width={view} height={view} fill="#fff" />
      <path d={result.d} fill="#0f172a" />
    </svg>
  );
}
