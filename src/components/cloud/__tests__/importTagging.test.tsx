// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/types";
import type { Report } from "@/lib/cloud/report";
import { FULL_META, expense } from "@/lib/__tests__/metaFixtures";
import { installLocalStorage } from "@/lib/__tests__/localStorage";
import { ExpenseProvider, useExpenses } from "@/components/providers/ExpenseProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { CloudProvider, useCloud } from "../CloudProvider";
import { Backups } from "../hub/Backups";
import SharedReportPage from "@/app/r/page";

installLocalStorage();

// Shared reports are decoded from the URL; this skips the compression and crypto, which have their own tests.
const decodeShare = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cloud/share", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/cloud/share")>()), decodeShare }));

const KEY = "expense-tracker:expenses:v1";
const SNAPSHOT_KEY = "ledgerly:snapshots:v1";

// Incoming records carry forged meta, which must never survive an import.
const INCOMING = [
  { date: "2026-10-01", category: "Food", amount: 7, description: "Sandwich", meta: { source: "manual" } },
  { date: "2026-10-02", category: "Bills", amount: 50, description: "Internet", meta: { source: "manual", suggestion: FULL_META.suggestion } },
];

let api: { expenses: Expense[]; cloud: ReturnType<typeof useCloud> };
function Probe() {
  const { expenses } = useExpenses();
  const cloud = useCloud();
  api = { expenses, cloud };
  return null;
}

async function setup(children: ReactNode = null, stored: Expense[] = []) {
  window.localStorage.setItem(KEY, JSON.stringify(stored));
  render(
    <ToastProvider>
      <ExpenseProvider>
        <CloudProvider>
          <Probe />
          {children}
        </CloudProvider>
      </ExpenseProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(api.cloud.hydrated).toBe(true));
  await waitFor(() => expect(api.expenses).toHaveLength(stored.length));
}

const sources = () => api.expenses.map((e) => e.meta);

describe("import provenance", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = "";
    decodeShare.mockReset();
  });
  afterEach(cleanup);

  it("tags importExpenses as import by default, in both modes", async () => {
    await setup(null, [expense({ meta: FULL_META })]);
    act(() => {
      api.cloud.importExpenses([{ date: "2026-10-01", category: "Food", amount: 7, description: "Sandwich" }], "merge");
    });
    expect(api.expenses[0].meta).toEqual({ source: "import" });
    expect(api.expenses[1].meta).toEqual(FULL_META);

    act(() => {
      api.cloud.importExpenses([{ date: "2026-10-01", category: "Food", amount: 7, description: "Sandwich" }], "replace");
    });
    expect(sources()).toEqual([{ source: "import" }]);
  });

  it("tags shared-import when asked, in both modes", async () => {
    await setup();
    const list = [{ date: "2026-10-01", category: "Food" as const, amount: 7, description: "Sandwich" }];
    act(() => {
      api.cloud.importExpenses(list, "merge", "shared-import");
    });
    expect(sources()).toEqual([{ source: "shared-import" }]);
    act(() => {
      api.cloud.importExpenses(list, "replace", "shared-import");
    });
    expect(sources()).toEqual([{ source: "shared-import" }]);
  });

  it.each([
    ["Add to my expenses (skip duplicates)", "merge"],
    ["Replace all my expenses", "replace"],
  ])("tags a backup file restore (%s) as import", async (button) => {
    await setup(<Backups />, [expense({ meta: FULL_META })]);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const text = JSON.stringify({ app: "Ledgerly", expenses: INCOMING });
    const file = new File([text], "backup.json", { type: "application/json" });
    // jsdom's File has no text().
    Object.defineProperty(file, "text", { value: async () => text });
    await userEvent.upload(input, file);
    await userEvent.click(await screen.findByRole("button", { name: button }));
    const added = api.expenses.filter((e) => e.id !== "e1");
    expect(added).toHaveLength(2);
    for (const e of added) expect(e.meta).toEqual({ source: "import" });
  });

  it("tags an import from someone else's shared report as shared-import", async () => {
    const report = {
      template: "monthly-summary",
      title: "Monthly Summary",
      period: "October 2026",
      generatedAt: "2026-10-15T00:00:00.000Z",
      metrics: [],
      tables: [],
      notes: [],
      recordCount: 2,
      total: 57,
      expenses: INCOMING,
    } as unknown as Report;
    decodeShare.mockResolvedValue({ kind: "ok", payload: { v: 1, report, sharedAt: "2026-10-15T00:00:00.000Z" } });
    window.location.hash = "#p1.test";
    await setup(<SharedReportPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Import into my Ledgerly" }));
    await userEvent.click(await screen.findByRole("button", { name: "Import 2" }));
    expect(api.expenses).toHaveLength(2);
    for (const e of api.expenses) expect(e.meta).toEqual({ source: "shared-import" });
  });

  it("keeps meta as it was when a version snapshot is restored", async () => {
    const data = [expense({ id: "s1", meta: FULL_META }), expense({ id: "s2", meta: { source: "sample" } }), expense({ id: "s3" })];
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ auto: false, items: [{ id: "snap", at: "2026-10-01T00:00:00.000Z", reason: "manual", count: 3, total: 37.5, signature: "x", data }] }));
    await setup(null, [expense({ id: "now", meta: { source: "import" } })]);
    await waitFor(() => expect(api.cloud.snapshots.items.some((s) => s.id === "snap")).toBe(true));
    act(() => api.cloud.restoreSnapshot("snap"));
    expect(api.expenses).toEqual(data);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(data));
  });
});
