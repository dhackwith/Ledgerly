// Self-contained share links. The report is compressed and, when a password is
// set, encrypted with AES-GCM using a key derived from the password (PBKDF2).
// Everything lives in the URL fragment (after #), which browsers never send to
// a server, so opening a link doesn't upload the data anywhere.

import type { Report } from "./report";

export interface SharePayload {
  v: 1;
  report: Report;
  sharedAt: string;
  /** ISO time after which Ledgerly refuses to show the report. */
  expiresAt?: string;
  from?: string;
  message?: string;
}

const PBKDF2_ITERATIONS = 310_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Returns the fragment token: "p1.<data>" for plain links, "e1.<salt+iv+ciphertext>" for protected ones. */
export async function encodeShare(payload: SharePayload, password?: string): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  if (!password) return `p1.${toBase64Url(packed)}`;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed));
  const all = new Uint8Array(salt.length + iv.length + sealed.length);
  all.set(salt, 0);
  all.set(iv, salt.length);
  all.set(sealed, salt.length + iv.length);
  return `e1.${toBase64Url(all)}`;
}

export type DecodeResult =
  | { kind: "ok"; payload: SharePayload }
  | { kind: "needs-password" }
  | { kind: "wrong-password" }
  | { kind: "invalid"; reason: string };

export function isProtectedToken(token: string): boolean {
  return token.startsWith("e1.");
}

export async function decodeShare(token: string, password?: string): Promise<DecodeResult> {
  try {
    const [version, data] = [token.slice(0, 2), token.slice(3)];
    if (!data || token[2] !== ".") return { kind: "invalid", reason: "This link is incomplete." };
    let packed: Uint8Array;
    if (version === "p1") {
      packed = fromBase64Url(data);
    } else if (version === "e1") {
      if (!password) return { kind: "needs-password" };
      const all = fromBase64Url(data);
      const key = await deriveKey(password, all.subarray(0, 16));
      try {
        packed = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.subarray(16, 28) }, key, all.subarray(28)));
      } catch {
        return { kind: "wrong-password" };
      }
    } else {
      return { kind: "invalid", reason: "This link was made by a newer version of Ledgerly." };
    }
    const json = new TextDecoder().decode(await pipe(packed, new DecompressionStream("deflate-raw")));
    const payload = JSON.parse(json) as SharePayload;
    if (payload?.v !== 1 || !payload.report?.tables) return { kind: "invalid", reason: "This link doesn't contain a Ledgerly report." };
    return { kind: "ok", payload };
  } catch {
    return { kind: "invalid", reason: "This link is damaged. Ask the sender to copy it again." };
  }
}

/** Builds the full link for the current site, e.g. https://example.com/r#p1.xxxx */
export function shareUrl(token: string): string {
  return `${window.location.origin}/r#${token}`;
}

export function isExpired(payload: SharePayload, now = new Date()): boolean {
  return Boolean(payload.expiresAt && new Date(payload.expiresAt) < now);
}

/** Rough password strength, 0-4, for the hint under the password field. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
