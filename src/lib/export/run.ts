import type { Expense } from "@/lib/types";
import { buildDataset, validateOptions } from "./dataset";
import { FORMATS } from "./formats";
import type { ExportOptions, ExportResult } from "./types";

/** Hands a file to the browser's download manager. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke later: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Yields to the browser so a loading state can paint before heavy work starts. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * Builds the file for the given options and starts the download.
 * Throws with a readable message when the options are invalid or nothing matches.
 */
export async function runExport(expenses: Expense[], options: ExportOptions): Promise<ExportResult> {
  const problems = validateOptions(options);
  if (problems.length) throw new Error(problems[0]);

  const format = FORMATS[options.format];
  await nextFrame();
  const write = await format.load();
  const dataset = buildDataset(expenses, options);
  if (dataset.rows.length === 0) throw new Error("No expenses match these filters.");

  const blob = write(dataset);
  const filename = `${options.filename.trim()}.${format.extension}`;
  saveBlob(blob, filename);
  return { blob, filename, format: options.format, count: dataset.rows.length, bytes: blob.size, total: dataset.summary.total };
}
