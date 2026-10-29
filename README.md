# Ledgerly — Expense Tracker

A personal expense tracker built with Next.js 14 (App Router), TypeScript, Tailwind CSS and Recharts. Data is stored in your browser's `localStorage`, so nothing leaves your machine.

## Features

- **Add, edit and delete expenses** with date, amount, category and description.
- **Form validation**: required fields, positive amounts up to 2 decimals, no future dates, 120-character descriptions. Errors appear on blur and update as you type. Input like `1,250` or `$12` is accepted and normalized.
- **Undo** after deleting, from the notification toast.
- **Expense list** with search, category filter, date range (plus quick presets), sorting, a running total of the filtered results, and "Show more" paging.
- **CSV export** of whatever the list currently shows (filters and sort applied). Cells that start with `=`, `+`, `-` or `@` are escaped so spreadsheets don't run them as formulas.
- **Dashboard**: this month's spending versus last month, all-time total, daily average, top category, a 6-month bar chart, a category donut with a labeled breakdown, a 30-day daily chart, and recent expenses.
- **Analytics**: a period selector (3, 6 or 12 months), plain-English insights (category rising or falling versus last month, projected month-end spend, priciest day, biggest weekday, no-spend streaks), a stacked monthly chart by category, a daily spending line with a 7-day rolling average, weekday averages, a category month-over-month comparison, and your most frequent expenses.
- **Loading skeletons, empty states and error handling**, including a recovery screen if saved data is corrupted or storage is blocked.
- **Responsive**: a top nav on desktop; a bottom tab bar with a floating add button on mobile, where dialogs open as bottom sheets.
- **Multi-tab sync**: changes in one tab show up in other open tabs.
- **Sample data** button on the empty dashboard so you can explore right away.

## Running it

Requires Node.js 18.17 or newer.

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
12. **Mobile.** Narrow the browser or use device mode in dev tools. Use the bottom bar and the round **+** button.
13. **Keyboard.** Dialogs open with focus on the first field, trap Tab inside, and close with Escape.

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
    analytics/page.tsx    Analytics: insights, trends and comparisons
    expenses/page.tsx     Expense list with filters and export
    not-found.tsx
  components/
    layout/AppShell.tsx   Header, mobile nav, providers, storage error banner
    providers/            Expense state, toast notifications, add/edit/delete dialogs
    expenses/             Form, list, filter bar
    dashboard/            Summary cards and charts
    analytics/            Insight list, trend charts, comparison table
    ui/                   Button, Card, Modal, Skeleton, icons, badges
  lib/
    types.ts              Expense types and categories
    storage.ts            localStorage load/save with validation
    validation.ts         Form validation rules
    analytics.ts          Filtering, sorting, totals, stats, sample data
    insights.ts           Trend breakdowns and plain-English insights
    csv.ts                CSV generation and download
    format.ts             Currency and date formatting
packaging/linux/        Launcher, fallback server and README for the Linux package
scripts/package-linux.mjs  Builds dist/ledgerly-linux.tar.gz
```

## Notes

- Amounts are summed in whole cents to avoid floating-point rounding errors.
- Dates are stored as local calendar dates (`YYYY-MM-DD`), so an expense never shifts a day because of time zones.
- Chart category colors come from a palette checked for color-blind separation, and every chart color is paired with a text label.
- Currency is USD. To change it, edit the formatters in `src/lib/format.ts`.
- Next.js is pinned to 14.2.35, the final 14.x release. `npm audit` still reports advisories against it that are only fixed in Next 15 and later. They concern server features this app does not use, such as middleware, server actions, rewrites and image optimization. Upgrade to a newer major version before adding any of those.
