// Builds Ledgerly as a static site and packages it with a Linux launcher.
// Output: dist/ledgerly-linux.tar.gz (extracts to a "ledgerly" folder).
//
// The tarball is written here rather than with the `tar` command so that start.sh
// keeps its executable bit even when packaging on Windows.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");
const distDir = join(root, "dist");
const stageName = "ledgerly";
const stageDir = join(distDir, stageName);
const launcherDir = join(root, "packaging", "linux");
const archivePath = join(distDir, "ledgerly-linux.tar.gz");

function step(msg) {
  console.log(`\n> ${msg}`);
}

// 1. Static build
step("Building static site");
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
rmSync(outDir, { recursive: true, force: true });
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(join(outDir, "index.html"))) {
  console.error("Static export did not produce out/index.html");
  process.exit(1);
}

// 2. Stage the folder
step("Assembling package");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync(outDir, join(stageDir, "app"), { recursive: true });
// Marker that start.sh uses to recognise an already-running copy of Ledgerly.
writeFileSync(join(stageDir, "app", "ledgerly.txt"), "ledgerly-app\n");
for (const file of ["start.sh", "server.js", "README.txt"]) {
  // Force Unix line endings: a CRLF in start.sh would break it on Linux.
  const text = readFileSync(join(launcherDir, file), "utf8").replace(/\r\n/g, "\n");
  writeFileSync(join(stageDir, file), text);
}

// 3. Write the tar.gz
step("Writing archive");
const EXECUTABLE = new Set([`${stageName}/start.sh`]);
const mtime = Math.floor(Date.now() / 1000);

function octal(value, width) {
  return value.toString(8).padStart(width - 1, "0") + "\0";
}

function header(name, { size = 0, mode, type }) {
  const buf = Buffer.alloc(512);
  let prefix = "";
  let base = name;
  if (Buffer.byteLength(name) > 100) {
    // ustar splits long paths into prefix (155 bytes) + name (100 bytes) at a slash.
    const cut = name.lastIndexOf("/", name.length - 1 - (type === "5" ? 1 : 0));
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
    if (Buffer.byteLength(base) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`Path too long for tar: ${name}`);
  }
  buf.write(base, 0, 100, "utf8");
  buf.write(octal(mode, 8), 100, 8, "ascii");
  buf.write(octal(0, 8), 108, 8, "ascii");
  buf.write(octal(0, 8), 116, 8, "ascii");
  buf.write(octal(size, 12), 124, 12, "ascii");
  buf.write(octal(mtime, 12), 136, 12, "ascii");
  buf.write("        ", 148, 8, "ascii");
  buf.write(type, 156, 1, "ascii");
  buf.write("ustar\0", 257, 6, "ascii");
  buf.write("00", 263, 2, "ascii");
  buf.write(prefix, 345, 155, "utf8");
  let sum = 0;
  for (const byte of buf) sum += byte;
  buf.write(octal(sum, 7) + " ", 148, 8, "ascii");
  return buf;
}

const chunks = [];
function addDir(absDir) {
  const rel = relative(distDir, absDir).split(sep).join("/");
  chunks.push(header(`${rel}/`, { mode: 0o755, type: "5" }));
  for (const entry of readdirSync(absDir).sort()) {
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) {
      addDir(abs);
    } else {
      const name = relative(distDir, abs).split(sep).join("/");
      const data = readFileSync(abs);
      chunks.push(header(name, { size: data.length, mode: EXECUTABLE.has(name) ? 0o755 : 0o644, type: "0" }));
      chunks.push(data);
      const pad = (512 - (data.length % 512)) % 512;
      if (pad) chunks.push(Buffer.alloc(pad));
    }
  }
}
addDir(stageDir);
chunks.push(Buffer.alloc(1024));
writeFileSync(archivePath, gzipSync(Buffer.concat(chunks), { level: 9 }));

const sizeKb = Math.round(statSync(archivePath).size / 1024);
console.log(`\nDone: ${relative(root, archivePath)} (${sizeKb} KB)`);
console.log(`Unpacked folder for testing: ${relative(root, stageDir)}`);
