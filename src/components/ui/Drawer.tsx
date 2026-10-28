"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DrawerProps {
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** Shown above the title, e.g. a step indicator. */
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** A panel that slides in from the right. Full screen on phones. Always open while mounted. */
export function Drawer({ onClose, title, description, eyebrow, children, footer }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>("[data-drawer-body] :is(input, select, textarea, button)");
      (first ?? panel)?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Let an open dialog on top handle its own Escape.
        if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])')) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      if (!panelRef.current.contains(document.activeElement)) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-drawer
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full animate-slide-in flex-col bg-white shadow-2xl outline-none sm:max-w-2xl sm:rounded-l-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-7">
          <div className="min-w-0">
            {eyebrow}
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div data-drawer-body className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
