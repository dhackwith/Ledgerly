import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Plan 4.1: the ML code must never talk to the network, whoever edits it next. */
const ML_DIR = fileURLToPath(new URL("..", import.meta.url));
const SELF = basename(fileURLToPath(import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : tsFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = tsFiles(ML_DIR);

describe("ML privacy boundary", () => {
  it("finds the ML sources", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith("suggester.ts"))).toBe(true);
    expect(files.some((f) => f.includes("benchmark"))).toBe(true);
  });

  it("contains no network APIs in any file under src/lib/ml", () => {
    const banned = ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource"];
    const hits: string[] = [];
    for (const file of files) {
      if (basename(file) === SELF) continue; // this file has to name them
      const text = readFileSync(file, "utf8");
      for (const word of banned) if (text.includes(word)) hits.push(`${relative(ML_DIR, file)}: ${word}`);
    }
    expect(hits).toEqual([]);
  });

  it("keeps the engine free of browser globals and timers, so it is safe during server rendering", () => {
    // settings.ts and feedback.ts are storage-backed stores owned by another feature.
    const engine = files.filter((f) => !f.includes("__tests__") && !["settings.ts", "feedback.ts"].includes(basename(f)));
    const banned = [/\bwindow\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bdocument\./, /\bnavigator\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/];
    const hits: string[] = [];
    for (const file of engine) {
      // Comments may mention these words ("no localStorage"); only code counts.
      const text = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const re of banned) if (re.test(text)) hits.push(`${relative(ML_DIR, file)}: ${re.source}`);
    }
    expect(hits).toEqual([]);
  });
});
