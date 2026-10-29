"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { ExpenseProvider, useExpenses } from "@/components/providers/ExpenseProvider";
import { ExpenseDialogProvider, useExpenseDialogs } from "@/components/providers/ExpenseDialogProvider";
import { BudgetProvider } from "@/components/providers/BudgetProvider";
import { Button } from "@/components/ui/Button";
import { ChartIcon, ListIcon, PlusIcon, TargetIcon, WalletIcon } from "@/components/ui/Icons";

const NAV = [
  { href: "/", label: "Dashboard", icon: ChartIcon },
  { href: "/expenses", label: "Expenses", icon: ListIcon },
  { href: "/budgets", label: "Budgets", icon: TargetIcon },
];

function Header() {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialogs();
  const { status } = useExpenses();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <WalletIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px]">Ledgerly</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden sm:block">
          <Button onClick={openAdd} disabled={status !== "ready"}>
            <PlusIcon className="h-4 w-4" />
            Add expense
          </Button>
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { openAdd } = useExpenseDialogs();
  const { status } = useExpenses();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      aria-label="Main"
    >
      <div className="grid h-16 grid-cols-4 items-center">
        {NAV.slice(0, 2).map(({ href, label, icon: Icon }) => (
          <MobileLink
            key={href}
            href={href}
            label={label}
            active={href === "/" ? pathname === "/" : pathname.startsWith(href)}
            icon={<Icon className="h-5 w-5" />}
          />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openAdd}
            disabled={status !== "ready"}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95 disabled:bg-brand-300"
            aria-label="Add expense"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
        {NAV.slice(2).map(({ href, label, icon: Icon }) => (
          <MobileLink key={href} href={href} label={label} active={pathname.startsWith(href)} icon={<Icon className="h-5 w-5" />} />
        ))}
      </div>
    </nav>
  );
}

function MobileLink({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-1 text-xs font-medium ${active ? "text-brand-600" : "text-slate-500"}`}
    >
      {icon}
      {label}
    </Link>
  );
}

function StorageError() {
  const { status, loadError, retryLoad, replaceAll } = useExpenses();
  if (status !== "error") return null;
  return (
    <div className="mb-6 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200" role="alert">
      <h2 className="text-sm font-semibold text-red-800">We couldn&apos;t load your expenses</h2>
      <p className="mt-1 text-sm text-red-700">{loadError}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={retryLoad}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (!window.confirm("This permanently erases the saved expense data in this browser. Continue?")) return;
            try {
              window.localStorage.removeItem("expense-tracker:expenses:v1");
            } catch {
              /* storage blocked: retry below will show the error again */
            }
            retryLoad();
            replaceAll([]);
          }}
        >
          Reset saved data
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ExpenseProvider>
        <BudgetProvider>
          <ExpenseDialogProvider>
            <div className="min-h-screen pb-24 sm:pb-12">
              <Header />
              <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                <StorageError />
                {children}
              </main>
            </div>
            <MobileNav />
          </ExpenseDialogProvider>
        </BudgetProvider>
      </ExpenseProvider>
    </ToastProvider>
  );
}
