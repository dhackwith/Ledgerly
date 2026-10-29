# Ledgerly — Expense Tracker

A personal expense tracker built with Next.js 14 (App Router), TypeScript, Tailwind CSS and Recharts. Data is stored in your browser's `localStorage`, so nothing leaves your machine.

## Features

- **Add, edit and delete expenses** with date, amount, category and description.
- **Form validation**: required fields, positive amounts up to 2 decimals, no future dates, 120-character descriptions. Errors appear on blur and update as you type. Input like `1,250` or `$12` is accepted and normalized.
- **Undo** after deleting, from the notification toast.
- **Expense list** with search, category filter, date range (plus quick presets), sorting, a running total of the filtered results, and "Show more" paging.
- **CSV export** of whatever the list currently shows (filters and sort applied). Cells that start with `=`, `+`, `-` or `@` are escaped so spreadsheets don't run them as formulas.
- **Dashboard**: this month's spending versus last month, all-time total, daily average, top category, a 6-month bar chart, a category donut with a labeled breakdown, a 30-day daily chart, and recent expenses.
- **Loading skeletons, empty states and error handling**, including a recovery screen if saved data is corrupted or storage is blocked.
- **Responsive**: a top nav on desktop; a bottom tab bar with a floating add button on mobile, where dialogs open as bottom sheets.
- **Multi-tab sync**: changes in one tab show up in other open tabs.
- **Sample data** button on the empty dashboard so you can explore right away.

### Share & sync

A cloud-style hub at **Share & sync** (also **Share report** on the dashboard) for getting data out of Ledgerly and to the people and apps that need it.

- **Templates** shape the same data for different jobs: Monthly Summary, Category Analysis, Tax Report (quarterly totals plus an itemized ledger) and Full Backup.
- **A three-step composer** (content, destination, details) slides in from the side and previews what each destination will receive: a spreadsheet grid, an email, a Slack message.
- **Share links with QR codes.** The report is compressed into the link itself, after the `#`, so it never touches a server. Add a password and it is encrypted with AES-256 (key derived with PBKDF2) before it goes into the link. Links can expire, can carry totals only, and open on a read-only report page where the recipient can download the data or import it into their own Ledgerly.
- **Copy as table** puts every table on the clipboard so it pastes into Google Sheets, Excel or Numbers as cells.
- **Connected apps:** Google Sheets, Google Drive, Dropbox, OneDrive and Slack, with a consent screen, per-app status, and **live sync** that pushes changes in the background after you edit an expense.
- **Automations** run recurring exports daily, weekly or monthly. Missed runs catch up once the next time the app is open.
- **Activity tray** follows background jobs across pages with live progress, like a cloud drive's upload panel. The header shows backup and sync status.
- **History** of every export, share and sync, filterable, with one-click re-runs and retries.
- **Version history:** Ledgerly saves a version after you make changes (the last 12) and restores any of them with undo. Backup files can be downloaded and restored on another device, merging without duplicates.
- **Suggestions** on the overview react to the date and your data, such as sharing last month's summary early in the month, tax reports in tax season, or a category that's climbing.

**What's real and what's simulated.** Email delivery and the five connected apps are simulated: you see the complete flow and a realistic background job, but nothing is sent to those services, and the UI labels them. Everything else is fully working: downloads, copy as table, share links, encryption, QR codes, the shared report page and its import, automations' scheduling, version history, and backup files. The email step also offers a real "open in your email app" link.

### Smart category suggestions

Ledgerly can suggest a category from the description as you add an expense, and learns from every category you save.

- **Runs on your device.** The suggestions are computed in the browser from your own expenses. Nothing is sent anywhere.
- **What's stored**, all in this browser's `localStorage`: provenance on each expense (where it came from, and the suggestion that was on screen when you saved it), a log of the last 500 suggestion outcomes for the accuracy figure (the suggested and final category, confidence, and how it was shown, with no description text), and your settings. The suggestion keys start with `ledgerly:ml:`.
- **Off by default for now**, while the feature is in development.
- **Turn it on or off** under **Settings** (the gear in the header). The same card shows how often suggestions were accepted over the last 100, and **Reset learning** clears the outcome log and stops past suggestions from counting. Your expenses and their categories are never deleted.
- **Never shared or exported.** Share links, reports, CSV, email, connected apps and backups carry only date, amount, category and description.

## Running it

Requires Node.js 26 or newer. The version is pinned in `.nvmrc`, so with nvm, fnm or a similar version manager you can just run `nvm use` in the project folder. `.npmrc` turns on `engine-strict`, so `npm install` stops with a clear error on an older Node instead of half-working.

The npm that ships with Node 26 may warn that `unrs-resolver` has an install script that isn't approved. That's expected and harmless. The script only downloads a fallback when the native module for your platform is missing, and linting works without it.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

For an optimized production build:

```bash
npm run build
```

```bash
npm start
```

## Sharing it with someone on Linux

This builds a self-contained package that needs only Python 3 on the other machine, or Node.js as a fallback. No `npm install` is needed there.

```bash
npm run package:linux
```

That creates `dist/ledgerly-linux.tar.gz`. Send that one file. The recipient runs:

```bash
tar -xzf ledgerly-linux.tar.gz
```

```bash
cd ledgerly && ./start.sh
```

The launcher serves the app at http://127.0.0.1:8765/ on their machine only and opens their browser. `./start.sh --install-shortcut` adds it to their applications menu. A `README.txt` inside the package explains all of this for them.

How it works:
- `STATIC_EXPORT=1` switches `next build` to a plain static site in `out/`. Every page is client-rendered, so no server code is needed.
- `packaging/linux/start.sh` is the launcher, and `packaging/linux/server.js` is a dependency-free Node server it uses when Python is missing.
- `scripts/package-linux.mjs` builds, assembles the folder, and writes the tarball itself so `start.sh` stays executable even when packaged on Windows.
- The port is fixed on purpose. Browsers store data per address, so a different port would show an empty tracker.

## Testing every feature

1. **Empty state.** Open the app. The dashboard shows "No expenses yet" with buttons to add an expense or load sample data.
2. **Validation.** Click **Add expense** and submit the empty form. Each field shows an error. Type `12.345` in Amount and tab away to see the decimal error. Pick a future date to see "Date can't be in the future."
3. **Add.** Enter `42.50`, pick **Food**, type a description and press **Add expense**. A toast confirms it, and the dashboard cards update.
4. **Persistence.** Reload the page. The expense is still there.
5. **Edit.** Go to **Expenses**, click the pencil icon, change the amount, category or description, and save.
6. **Delete and undo.** Click the trash icon, confirm, then click **Undo** in the toast. The expense comes back.
7. **Sample data.** Delete everything (or use a private window), then click **Load sample data** on the dashboard. About six months of realistic expenses are added.
8. **Dashboard.** Hover the bars and the donut to see tooltips. Check that the category list beside the donut matches the chart.
9. **Search and filters.** On **Expenses**, type `gas` in search, choose a category, click a preset such as **Last month**, or pick custom dates. The count and total update. **Clear filters** resets them.
10. **Sort.** Switch between newest, oldest, highest and lowest amount.
11. **Export.** Click **Export CSV**. The downloaded file contains exactly the rows currently shown.
12. **Share & sync.** Open **Share & sync** from the header.
    - Click **New export**, keep Monthly Summary, choose **Download** and download the CSV. It lands in **History**.
    - Use **Share a link**, set a password and create the link. Open it with **Open preview**: a wrong password is rejected and the right one shows the report. Scan the QR code with a phone on the same network if the app is reachable there.
    - Use **Email a report**, add two addresses and send. Watch the activity tray in the corner finish the job.
    - Under **Apps**, connect Google Sheets and turn on live sync. Add an expense: a "Live sync" job appears a couple of seconds later.
    - Under **Automations**, create one from a recipe and click **Run now**. Disconnect its app and run it again to see a failure in the tray and in History.
    - Under **Backups**, restore an older version, then click **Undo** in the notification. Download a full backup and restore it from the file.
13. **Mobile.** Narrow the browser or use device mode in dev tools. Use the bottom bar and the round **+** button.
14. **Keyboard.** Dialogs open with focus on the first field, trap Tab inside, and close with Escape.

To reset all data, run this in the browser console:

```js
localStorage.removeItem("expense-tracker:expenses:v1");
```

## Project structure

```
src/
  app/
    layout.tsx            Root layout, font, app shell
    page.tsx              Dashboard
    expenses/page.tsx     Expense list with filters and export
    share/page.tsx        Share & sync hub
    settings/page.tsx     Settings, including smart suggestions
    r/page.tsx            Read-only page that opens shared report links
    not-found.tsx
  components/
    layout/AppShell.tsx   Header, mobile nav, providers, storage error banner
    providers/            Expense state, toast notifications, add/edit/delete dialogs
    expenses/             Form, list, filter bar
    dashboard/            Summary cards and charts
    cloud/                Share & sync: provider (jobs, sync, automations, versions), composer, tray, hub tabs
    settings/             Smart suggestions settings card
    ui/                   Button, Card, Modal, Drawer, Skeleton, icons, badges
  lib/
    types.ts              Expense types and categories
    storage.ts            localStorage load/save with validation
    validation.ts         Form validation rules
    analytics.ts          Filtering, sorting, totals, stats, sample data
    csv.ts                CSV generation and download
    format.ts             Currency and date formatting
    cloud/                Report templates, CSV/JSON/TSV output, share-link encoding and encryption, schedules, destinations
    ml/                   Smart category suggestions: shared contract, settings store, feedback log
packaging/linux/        Launcher, fallback server and README for the Linux package
scripts/package-linux.mjs  Builds dist/ledgerly-linux.tar.gz
```

## Notes

- Amounts are summed in whole cents to avoid floating-point rounding errors.
- Dates are stored as local calendar dates (`YYYY-MM-DD`), so an expense never shifts a day because of time zones.
- Chart category colors come from a palette checked for color-blind separation, and every chart color is paired with a text label.
- Currency is USD. To change it, edit the formatters in `src/lib/format.ts`.
- Next.js is pinned to 14.2.35, the final 14.x release. `npm audit` still reports advisories against it that are only fixed in Next 15 and later. They concern server features this app does not use, such as middleware, server actions, rewrites and image optimization. Upgrade to a newer major version before adding any of those.
