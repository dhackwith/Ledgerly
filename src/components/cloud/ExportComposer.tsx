"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatCurrency, formatMonthKey } from "@/lib/format";
import { DESTINATIONS, INTEGRATIONS, type DestinationId, type IntegrationId } from "@/lib/cloud/destinations";
import { byteSize, reportFilename, serialize, type FileFormat } from "@/lib/cloud/report";
import { describeFrequency, type Frequency } from "@/lib/cloud/schedule";
import { passwordStrength } from "@/lib/cloud/share";
import type { ShareLinkRecord } from "@/lib/cloud/state";
import { availablePeriods, TEMPLATE_ORDER, TEMPLATES, type TemplateParams } from "@/lib/cloud/templates";
import type { TemplateId } from "@/lib/cloud/report";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useExpenses } from "@/components/providers/ExpenseProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { DestinationLogo, SimulatedBadge, StatusDot } from "./bits";
import { ConnectDialog } from "./ConnectDialog";
import { useCloud, type ComposerPreset } from "./CloudProvider";
import { EmailPreview, LinkResult, SheetPreview, SlackPreview } from "./Previews";

const control =
  "block w-full rounded-lg border-0 bg-white py-2 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

const STEPS = ["Content", "Destination", "Details"] as const;

const EXPIRY_OPTIONS = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Never" },
];

const REPEAT_PRESETS: { id: string; label: string; frequency: Frequency; weekday: number; monthDay: number }[] = [
  { id: "weekly", label: "Every Monday", frequency: "weekly", weekday: 1, monthDay: 1 },
  { id: "monthly", label: "On the 1st of each month", frequency: "monthly", weekday: 1, monthDay: 1 },
  { id: "daily", label: "Every day", frequency: "daily", weekday: 1, monthDay: 1 },
];

function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="mb-2 flex items-center gap-2 text-xs font-semibold" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
              i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < step ? "✓" : i + 1}
          </span>
          <span className={i === step ? "text-slate-900" : "text-slate-400"}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-slate-200" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function RecipientInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commit = (text: string) => {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return;
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p) && !value.includes(p.toLowerCase())).map((p) => p.toLowerCase());
    if (good.length) onChange([...value, ...good]);
    setDraft(bad.join(" "));
    setError(bad.length ? `“${bad[0]}” isn't a valid email address.` : null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
      if (e.key !== "Tab") e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-inset focus-within:ring-2 focus-within:ring-brand-600 ${error ? "ring-red-400" : "ring-slate-300"}`}>
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
            {email}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== email))} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={`Remove ${email}`}>
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id="email-to"
          type="email"
          multiple
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length ? "Add another" : "name@example.com"}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-1 text-sm focus:ring-0"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ExportComposer({ preset, onClose }: { preset?: ComposerPreset; onClose: () => void }) {
  const { expenses } = useExpenses();
  const { notify } = useToast();
  const cloud = useCloud();
  const now = useMemo(() => new Date(), []);
  const periods = useMemo(() => availablePeriods(expenses, now), [expenses, now]);

  const initialTemplate: TemplateId = preset?.template ?? "monthly-summary";
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [params, setParams] = useState<TemplateParams>({ ...TEMPLATES[initialTemplate].defaultParams(expenses, now), ...preset?.params });
  const [includeDetail, setIncludeDetail] = useState(true);
  // A quick action may point at an app that isn't connected yet: start on the destination step and ask to connect.
  const presetNeedsConnect =
    preset?.destination && DESTINATIONS[preset.destination].integration && !cloud.state.connections[preset.destination as IntegrationId];
  const [destination, setDestination] = useState<DestinationId | null>(presetNeedsConnect ? null : (preset?.destination ?? null));
  const [step, setStep] = useState(preset?.destination ? (presetNeedsConnect ? 1 : 2) : preset?.template ? 1 : 0);
  const [format, setFormat] = useState<FileFormat>(initialTemplate === "full-backup" ? "json" : "csv");
  const [connecting, setConnecting] = useState<IntegrationId | null>(presetNeedsConnect ? (preset!.destination as IntegrationId) : null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<ShareLinkRecord | null>(null);

  // Destination details
  const [recipients, setRecipients] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [fromName, setFromName] = useState("");
  const [sheetMode, setSheetMode] = useState<"new" | "existing">("new");
  const [sheetName, setSheetName] = useState("Ledgerly exports");
  const [existingSheet, setExistingSheet] = useState("Household budget 2026");
  // null until the user touches the box, so it starts from the connection's current setting.
  const [liveSync, setLiveSync] = useState<boolean | null>(null);
  const [folder, setFolder] = useState("");
  const [channel, setChannel] = useState("#finance");
  const [repeat, setRepeat] = useState<string>("");

  const report = useMemo(() => cloud.prepareReport({ template, params, includeDetail }), [cloud, template, params, includeDetail]);
  const def = destination ? DESTINATIONS[destination] : null;
  const connection = destination && def?.integration ? cloud.state.connections[destination as IntegrationId] : undefined;
  const file = useMemo(() => serialize(report, format), [report, format]);
  const filename = reportFilename(report, file.extension);
  const subject = `${report.title} · ${report.period}`;
  const effectiveFolder = folder || connection?.folder || "";

  const pickTemplate = (id: TemplateId) => {
    setTemplate(id);
    setParams(TEMPLATES[id].defaultParams(expenses, now));
    if (id === "full-backup") setFormat("json");
  };

  const pickDestination = (id: DestinationId) => {
    const d = DESTINATIONS[id];
    if (d.integration && !cloud.state.connections[id as IntegrationId]) {
      setConnecting(id as IntegrationId);
      return;
    }
    setDestination(id);
    setFolder("");
    setStep(2);
  };

  const problems: string[] = [];
  if (report.recordCount === 0 && template !== "full-backup") problems.push("There are no expenses in this period.");
  if (report.recordCount === 0 && template === "full-backup") problems.push("There are no expenses to back up yet.");
  if (destination === "email" && recipients.length === 0) problems.push("Add at least one recipient.");
  if (destination === "slack" && !/^#[\w-]{1,80}$/.test(channel)) problems.push("Channel names start with # and use letters, numbers, - or _.");
  if (destination === "google-sheets" && sheetMode === "new" && !sheetName.trim()) problems.push("Name the new spreadsheet.");
  if (destination === "link" && password && password.length < 6) problems.push("Use at least 6 characters for the password.");

  const target = (): string | undefined => {
    switch (destination) {
      case "email":
        return recipients.join(", ");
      case "google-sheets":
        return sheetMode === "new" ? sheetName.trim() : existingSheet;
      case "slack":
        return channel;
      default:
        return effectiveFolder || undefined;
    }
  };

  const submit = async () => {
    if (!destination || problems.length || busy) return;
    setBusy(true);
    try {
      if (destination === "link") {
        const record = await cloud.createLink({ template, params, includeDetail }, { password, expiresInDays: expiryDays || undefined, from: fromName, message });
        setLink(record);
        return;
      }
      if (destination === "google-sheets" && liveSync !== null) cloud.setLiveSync("google-sheets", liveSync);
      await cloud.runExport({ template, params, includeDetail, destination, format, target: target(), message });
      if (repeat && def?.schedulable) {
        const r = REPEAT_PRESETS.find((p) => p.id === repeat)!;
        const s = cloud.addSchedule({
          name: `${TEMPLATES[template].name} to ${def.name}`,
          template,
          destination,
          format,
          target: target() ?? "",
          frequency: r.frequency,
          weekday: r.weekday,
          monthDay: r.monthDay,
          time: "09:00",
          enabled: true,
        });
        notify(`Automation created: ${describeFrequency(s)}`, { variant: "info" });
      }
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Export failed.", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = (() => {
    switch (destination) {
      case "download":
        return `Download ${format.toUpperCase()}`;
      case "clipboard":
        return "Copy table";
      case "link":
        return password ? "Encrypt and create link" : "Create link";
      case "email":
        return "Send email";
      case "slack":
        return "Post to Slack";
      case "google-sheets":
        return "Send to Google Sheets";
      default:
        return `Upload to ${def?.name ?? ""}`;
    }
  })();

  // --- Step bodies ---------------------------------------------------------

  const contentStep = (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Template" className="grid gap-3 sm:grid-cols-2">
        {TEMPLATE_ORDER.map((id) => {
          const t = TEMPLATES[id];
          const selected = template === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pickTemplate(id)}
              data-autofocus={selected ? true : undefined}
              className={`group relative overflow-hidden rounded-2xl p-4 text-left ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                selected ? "bg-white shadow-md ring-2 ring-brand-600" : "bg-white ring-slate-200 hover:shadow-sm hover:ring-slate-300"
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: t.accent }} aria-hidden />
              <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-500">{t.tagline}</span>
              <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{t.audience}</span>
            </button>
          );
        })}
      </div>

      {template === "monthly-summary" && (
        <Field label="Month" htmlFor="param-month">
          <select id="param-month" value={params.month} onChange={(e) => setParams({ month: e.target.value })} className={`${control} pr-8`}>
            {periods.months.map((m) => (
              <option key={m} value={m}>
                {formatMonthKey(m, "long")}
              </option>
            ))}
          </select>
        </Field>
      )}
      {template === "category-analysis" && (
        <Field label="Look back">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Look back">
            {([3, 6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={params.months === m}
                onClick={() => setParams({ months: m })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${params.months === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {m} months
              </button>
            ))}
          </div>
        </Field>
      )}
      {template === "tax-report" && (
        <Field label="Tax year" htmlFor="param-year">
          <select id="param-year" value={params.year} onChange={(e) => setParams({ year: Number(e.target.value) })} className={`${control} pr-8`}>
            {periods.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
      )}

      {template !== "full-backup" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="checkbox" checked={includeDetail} onChange={(e) => setIncludeDetail(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: "#2648e0" }} />
          <span>
            <span className="block text-sm font-medium text-slate-900">Include individual transactions</span>
            <span className="block text-xs text-slate-500">Turn off to share totals only. Descriptions and dates of single expenses stay private.</span>
          </span>
        </label>
      )}

      <section aria-label="What you'll export" className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
        <p className="text-xs font-medium text-slate-300">
          {report.title} · {report.period}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {report.metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{m.label}</dt>
              <dd className="truncate text-base font-semibold">{m.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-400">
          {report.tables.length} {report.tables.length === 1 ? "table" : "tables"} · {report.recordCount.toLocaleString("en-US")} expenses · {formatCurrency(report.total)}
        </p>
      </section>
    </div>
  );

  const group = (title: string, ids: DestinationId[], note?: ReactNode) => (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} {note}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {ids.map((id) => {
          const d = DESTINATIONS[id];
          const c = d.integration ? cloud.state.connections[id as IntegrationId] : undefined;
          const selected = destination === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => pickDestination(id)}
              className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                selected ? "bg-brand-50/60 ring-2 ring-brand-600" : "bg-white ring-slate-200 hover:ring-slate-300"
              }`}
            >
              <DestinationLogo id={id} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{d.name}</span>
                <span className="block truncate text-xs text-slate-500">{d.description}</span>
              </span>
              {d.integration &&
                (c ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <StatusDot tone="green" /> On
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Connect</span>
                ))}
            </button>
          );
        })}
      </div>
    </section>
  );

  const destinationStep = (
    <div className="space-y-6">
      {group("On this device", ["download", "clipboard"])}
      {group("Share", ["link", "email"])}
      {group("Connected apps", INTEGRATIONS, <SimulatedBadge />)}
    </div>
  );

  const formatPicker = (
    <Field label="File format">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="File format">
        {(["csv", "json"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={format === f}
            onClick={() => setFormat(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${format === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {f === "csv" ? "CSV · spreadsheets" : "JSON · apps & backups"}
          </button>
        ))}
      </div>
    </Field>
  );

  const repeatPicker = def?.schedulable && (
    <Field label="Repeat" hint={repeat ? "Runs at 9:00 AM while Ledgerly is open. Missed runs catch up the next time you open it." : undefined}>
      <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={`${control} pr-8`} aria-label="Repeat">
        <option value="">Just this once</option>
        {REPEAT_PRESETS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </Field>
  );

  const strength = passwordStrength(password);

  const detailsBody = (() => {
    switch (destination) {
      case "download":
        return (
          <>
            {formatPicker}
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-600 ring-1 ring-slate-200">
              {filename} · {(byteSize(file.text) / 1024).toFixed(1)} KB
            </p>
          </>
        );
      case "clipboard":
        return (
          <>
            <p className="text-sm text-slate-600">
              Copies every table as cells. Click cell A1 in Google Sheets, Excel or Numbers and paste. Each table lands under the one before it.
            </p>
            <SheetPreview report={report} name="Your spreadsheet" />
          </>
        );
      case "link":
        return (
          <>
            <Field label="Link expires after">
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Expiry">
                {EXPIRY_OPTIONS.map((o) => (
                  <button
                    key={o.days}
                    type="button"
                    role="radio"
                    aria-checked={expiryDays === o.days}
                    onClick={() => setExpiryDays(o.days)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${expiryDays === o.days ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="Password (optional)"
              htmlFor="link-password"
              hint={
                password ? (
                  <span className="flex items-center gap-2">
                    <span className="flex gap-0.5" aria-hidden>
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={`h-1 w-6 rounded-full ${i <= strength ? (strength >= 3 ? "bg-emerald-500" : "bg-amber-400") : "bg-slate-200"}`} />
                      ))}
                    </span>
                    {strength >= 3 ? "Strong. The report is encrypted with this password." : "Longer passwords with mixed characters are safer."}
                  </span>
                ) : (
                  "With a password, the report is encrypted (AES-256) before it goes into the link."
                )
              }
            >
              <div className="flex rounded-lg bg-white shadow-sm ring-1 ring-inset ring-slate-300 focus-within:ring-2 focus-within:ring-brand-600">
                <input
                  id="link-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="min-w-0 flex-1 rounded-l-lg border-0 bg-transparent px-3 py-2 text-sm focus:ring-0"
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="px-3 text-xs font-semibold text-slate-500 hover:text-slate-700">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name (optional)" htmlFor="link-from">
                <input id="link-from" value={fromName} onChange={(e) => setFromName(e.target.value)} maxLength={60} className={control} placeholder="Shown to the recipient" />
              </Field>
              <Field label="Note (optional)" htmlFor="link-note">
                <input id="link-note" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} className={control} placeholder="e.g. Here's October" />
              </Field>
            </div>
          </>
        );
      case "email":
        return (
          <>
            <Field label="To" htmlFor="email-to" hint="Press Enter or comma after each address.">
              <RecipientInput value={recipients} onChange={setRecipients} />
            </Field>
            <Field label="Message (optional)" htmlFor="email-message">
              <textarea id="email-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={control} placeholder="Add a note above the summary" />
            </Field>
            {formatPicker}
            <EmailPreview report={report} to={recipients} subject={subject} message={message} attachment={filename} />
            {repeatPicker}
          </>
        );
      case "google-sheets":
        return (
          <>
            <Field label="Spreadsheet">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="sheet-mode" checked={sheetMode === "new"} onChange={() => setSheetMode("new")} style={{ accentColor: "#2648e0" }} />
                  Create a new spreadsheet
                </label>
                {sheetMode === "new" && <input aria-label="Spreadsheet name" value={sheetName} onChange={(e) => setSheetName(e.target.value)} className={control} />}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="sheet-mode" checked={sheetMode === "existing"} onChange={() => setSheetMode("existing")} style={{ accentColor: "#2648e0" }} />
                  Add tabs to an existing spreadsheet
                </label>
                {sheetMode === "existing" && (
                  <select aria-label="Existing spreadsheet" value={existingSheet} onChange={(e) => setExistingSheet(e.target.value)} className={`${control} pr-8`}>
                    <option>Household budget 2026</option>
                    <option>Ledgerly exports</option>
                    <option>Shared expenses</option>
                  </select>
                )}
              </div>
            </Field>
            <SheetPreview report={report} name={sheetMode === "new" ? sheetName : existingSheet} />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200">
              <input type="checkbox" checked={liveSync ?? Boolean(connection?.liveSync)} onChange={(e) => setLiveSync(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: "#188038" }} />
              <span>
                <span className="block text-sm font-medium text-slate-900">Keep this spreadsheet in sync</span>
                <span className="block text-xs text-slate-600">Every time you add, edit or delete an expense, Ledgerly pushes the change in the background.</span>
              </span>
            </label>
            {repeatPicker}
          </>
        );
      case "slack":
        return (
          <>
            <Field label="Channel" htmlFor="slack-channel">
              <input id="slack-channel" value={channel} onChange={(e) => setChannel(e.target.value.trim())} className={control} />
            </Field>
            <SlackPreview report={report} channel={channel} />
            {repeatPicker}
          </>
        );
      default:
        return (
          <>
            <Field label="Folder" htmlFor="cloud-folder" hint={<span className="font-mono">{`${effectiveFolder.replace(/\/$/, "")}/${filename}`}</span>}>
              <input id="cloud-folder" value={effectiveFolder} onChange={(e) => setFolder(e.target.value)} className={`${control} font-mono`} />
            </Field>
            {formatPicker}
            {repeatPicker}
          </>
        );
    }
  })();

  const detailsStep = def && (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-2 font-medium text-slate-700 hover:bg-slate-200">
          {report.title} · {report.period}
          <span className="text-brand-600">Change</span>
        </button>
        <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 font-medium text-slate-700 hover:bg-slate-200">
          <DestinationLogo id={def.id} size="sm" />
          {def.name}
          {connection && <span className="text-slate-400">· {connection.account}</span>}
          <span className="text-brand-600">Change</span>
        </button>
        {def.simulated && <SimulatedBadge className="self-center" />}
      </div>
      {detailsBody}
      {def.id === "email" && (
        <p className="text-xs text-slate-500">
          Sending is simulated in this build.{" "}
          <a
            className="font-semibold text-brand-600 hover:underline"
            href={`mailto:${recipients.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message ? `${message}\n\n` : ""}${report.metrics.map((m) => `${m.label}: ${m.value}`).join("\n")}\n\nMade with Ledgerly`)}`}
          >
            Open it in your email app instead
          </a>{" "}
          to send a real message with the summary (attach the file yourself).
        </p>
      )}
    </div>
  );

  // --- Layout --------------------------------------------------------------

  if (link) {
    return (
      <Drawer onClose={onClose} title="Share link created" description="Send it however you like. The recipient doesn't need an account.">
        <LinkResult link={link} />
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </Drawer>
    );
  }

  const detailsTitle =
    destination === "download"
      ? "Download a file"
      : destination === "clipboard"
        ? "Copy into a spreadsheet"
        : destination === "link"
          ? "Create a share link"
          : destination === "email"
            ? "Send by email"
            : `Send to ${def?.name ?? ""}`;

  const canNext = step === 0 ? report.recordCount > 0 : step === 1 ? Boolean(destination) : false;

  return (
    <>
      <Drawer
        onClose={onClose}
        eyebrow={<StepIndicator step={step} />}
        title={step === 0 ? "What do you want to export?" : step === 1 ? "Where should it go?" : detailsTitle}
        description={step === 0 ? "Pick a template. Each one shapes your data for a different job." : step === 1 ? "Files, links and apps. Connected apps run in the background." : undefined}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-xs" aria-live="polite">
              {step === 2 && problems.length > 0 ? (
                <span className="font-medium text-amber-700">{problems[0]}</span>
              ) : step === 0 && report.recordCount === 0 ? (
                <span className="font-medium text-amber-700">No expenses in this period. Pick another one.</span>
              ) : (
                <span className="text-slate-500">
                  {report.recordCount.toLocaleString("en-US")} expenses · {formatCurrency(report.total)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                  Continue
                </Button>
              ) : (
                <Button onClick={submit} disabled={problems.length > 0} loading={busy}>
                  {busy && destination === "link" ? (password ? "Encrypting…" : "Creating…") : primaryLabel}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {step === 0 ? contentStep : step === 1 ? destinationStep : detailsStep}
      </Drawer>
      {connecting && (
        <ConnectDialog
          id={connecting}
          onClose={() => setConnecting(null)}
          onConnected={() => {
            setDestination(connecting);
            setFolder("");
            setStep(2);
          }}
        />
      )}
    </>
  );
}

