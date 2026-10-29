/**
 * Merchant memory (plan 3.2 [A]): exact and near-exact recall of how the user
 * filed a description before. Lookups try, in order: the exact normalized
 * text, its first significant tokens ("starbucks reserve" -> "starbucks"), a
 * prefix of known descriptions (typing in progress), then trigram-Jaccard
 * fuzzy matching for typos.
 *
 * Entries must be added oldest first. Each new label multiplies the entry's
 * older weights by `ordinalDecay`, so a habit change wins after a couple of
 * consistent new labels even when the old habit has many.
 */
import { CATEGORIES } from "@/lib/types";
import { significantTokens } from "./features";

const K = CATEGORIES.length;

export type MemoryKind = "exact" | "token" | "prefix" | "fuzzy";

export interface MemoryParams {
  ordinalDecay: number;
  /** Minimum trigram Jaccard similarity for a fuzzy hit. */
  fuzzyMin: number;
  /** Plan 4.3: max exact keys kept; least-recently-seen are dropped. */
  keyCap: number;
}

export interface MemoryEntry {
  /** Decayed label weights per category. */
  weights: Float64Array;
  /** Raw number of times each category was used. */
  counts: Int32Array;
  /** Category and summed weight of the most recent run of identical labels. */
  streakCategory: number;
  streakWeight: number;
  /** Latest original description, for reasons. */
  label: string;
  lastSeen: number;
}

export interface MemoryHit {
  kind: MemoryKind;
  entry: MemoryEntry;
  /** 1 for exact/token hits; Jaccard similarity for fuzzy; coverage for prefix. */
  similarity: number;
}

function newEntry(): MemoryEntry {
  return { weights: new Float64Array(K), counts: new Int32Array(K), streakCategory: -1, streakWeight: 0, label: "", lastSeen: -1 };
}

function update(entry: MemoryEntry, c: number, w: number, label: string, tick: number, decay: number): void {
  for (let k = 0; k < K; k++) entry.weights[k] *= decay;
  entry.weights[c] += w;
  entry.counts[c]++;
  if (entry.streakCategory === c) entry.streakWeight += w;
  else {
    entry.streakCategory = c;
    entry.streakWeight = w;
  }
  entry.label = label;
  entry.lastSeen = tick;
}

/** Character trigrams with word-boundary padding, by code point. */
export function trigrams(text: string): Set<string> {
  const cps = Array.from(` ${text} `);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= cps.length; i++) out.add(cps[i] + cps[i + 1] + cps[i + 2]);
  return out;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let inter = 0;
  a.forEach((g) => {
    if (b.has(g)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Token keys: the first one and first two significant tokens. */
function tokenKeys(tokens: readonly string[]): string[] {
  const sig = significantTokens(tokens);
  const keys: string[] = [];
  if (sig.length >= 2) keys.push(`2:${sig[0]} ${sig[1]}`);
  if (sig.length >= 1 && sig[0].length >= 3) keys.push(`1:${sig[0]}`);
  return keys;
}

const MAX_PREFIX_KEYS = 30;
const MIN_PREFIX_CHARS = 3;
const MAX_FUZZY_CANDIDATES = 2000;

export class MerchantMemory {
  private readonly exact = new Map<string, MemoryEntry>();
  private readonly byToken = new Map<string, MemoryEntry>();
  private sortedKeys: string[] | null = null;
  private trigramIndex: Map<string, number[]> | null = null;
  private keyTrigrams: Set<string>[] = [];

  constructor(private readonly params: MemoryParams) {}

  get size(): number {
    return this.exact.size;
  }

  add(normalized: string, tokens: readonly string[], label: string, c: number, w: number, tick: number): void {
    if (!normalized || w <= 0) return;
    const decay = this.params.ordinalDecay;
    let entry = this.exact.get(normalized);
    if (!entry) this.exact.set(normalized, (entry = newEntry()));
    update(entry, c, w, label, tick, decay);
    for (const key of tokenKeys(tokens)) {
      let te = this.byToken.get(key);
      if (!te) this.byToken.set(key, (te = newEntry()));
      update(te, c, w, label, tick, decay);
    }
    this.sortedKeys = null;
    this.trigramIndex = null;
  }

  /** Enforces the key cap. Call once after building. */
  prune(): void {
    const excess = this.exact.size - this.params.keyCap;
    if (excess <= 0) return;
    const keys = Array.from(this.exact.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen || (a[0] < b[0] ? -1 : 1));
    for (let i = 0; i < excess; i++) this.exact.delete(keys[i][0]);
    // Token keys are bounded by exact keys; drop those not seen since the oldest kept key.
    const cutoff = keys[excess][1].lastSeen;
    this.byToken.forEach((e, k) => {
      if (e.lastSeen < cutoff) this.byToken.delete(k);
    });
  }

  /**
   * Best evidence for a description, strongest first. An exact hit comes with
   * the broader first-token entry when other spellings of the same merchant
   * ("uber ride" vs "uber") have added labels, so a habit change made under one
   * spelling reaches the others.
   */
  lookup(normalized: string, tokens: readonly string[]): MemoryHit[] {
    if (!normalized) return [];
    const keys = tokenKeys(tokens);
    const exact = this.exact.get(normalized);
    if (exact) {
      const hits: MemoryHit[] = [{ kind: "exact", entry: exact, similarity: 1 }];
      const broadKey = keys.find((k) => k.startsWith("1:"));
      const broad = broadKey ? this.byToken.get(broadKey) : undefined;
      if (broad && total(broad.counts) > total(exact.counts)) hits.push({ kind: "token", entry: broad, similarity: 1 });
      return hits;
    }
    for (const key of keys) {
      const te = this.byToken.get(key);
      if (te) return [{ kind: "token", entry: te, similarity: 1 }];
    }
    const loose = this.prefixLookup(normalized) ?? this.fuzzyLookup(normalized);
    return loose ? [loose] : [];
  }

  private prefixLookup(normalized: string): MemoryHit | null {
    if (normalized.length < MIN_PREFIX_CHARS) return null;
    if (!this.sortedKeys) this.sortedKeys = Array.from(this.exact.keys()).sort();
    const keys = this.sortedKeys;
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] < normalized) lo = mid + 1;
      else hi = mid;
    }
    const matches: MemoryEntry[] = [];
    let shortest = Infinity;
    for (let i = lo; i < keys.length && matches.length < MAX_PREFIX_KEYS && keys[i].startsWith(normalized); i++) {
      matches.push(this.exact.get(keys[i]) as MemoryEntry);
      shortest = Math.min(shortest, keys[i].length);
    }
    if (matches.length === 0) return null;
    return { kind: "prefix", entry: merge(matches), similarity: normalized.length / shortest };
  }

  private fuzzyLookup(normalized: string): MemoryHit | null {
    if (normalized.length < MIN_PREFIX_CHARS) return null;
    if (!this.trigramIndex) this.buildTrigramIndex();
    const index = this.trigramIndex as Map<string, number[]>;
    const query = trigrams(normalized);
    const overlap = new Map<number, number>();
    query.forEach((g) => {
      const ids = index.get(g);
      if (!ids) return;
      for (const id of ids) {
        if (overlap.size >= MAX_FUZZY_CANDIDATES && !overlap.has(id)) continue;
        overlap.set(id, (overlap.get(id) ?? 0) + 1);
      }
    });
    const keys = this.sortedKeys as string[];
    let bestId = -1;
    let best = 0;
    overlap.forEach((inter, id) => {
      const sim = inter / (query.size + this.keyTrigrams[id].size - inter);
      // Ties go to the alphabetically first key (ids are in sorted order), so results are deterministic.
      if (sim > best || (sim === best && id < bestId)) {
        best = sim;
        bestId = id;
      }
    });
    if (bestId < 0 || best < this.params.fuzzyMin) return null;
    return { kind: "fuzzy", entry: this.exact.get(keys[bestId]) as MemoryEntry, similarity: best };
  }

  private buildTrigramIndex(): void {
    if (!this.sortedKeys) this.sortedKeys = Array.from(this.exact.keys()).sort();
    const index = new Map<string, number[]>();
    this.keyTrigrams = this.sortedKeys.map((key, id) => {
      const grams = trigrams(key);
      grams.forEach((g) => {
        let ids = index.get(g);
        if (!ids) index.set(g, (ids = []));
        ids.push(id);
      });
      return grams;
    });
    this.trigramIndex = index;
  }
}

function total(counts: Int32Array): number {
  let n = 0;
  for (let k = 0; k < K; k++) n += counts[k];
  return n;
}

/** Sums several entries; the streak comes from the most recently seen one. */
function merge(entries: readonly MemoryEntry[]): MemoryEntry {
  if (entries.length === 1) return entries[0];
  const out = newEntry();
  for (const e of entries) {
    for (let k = 0; k < K; k++) {
      out.weights[k] += e.weights[k];
      out.counts[k] += e.counts[k];
    }
    if (e.lastSeen > out.lastSeen) {
      out.lastSeen = e.lastSeen;
      out.streakCategory = e.streakCategory;
      out.streakWeight = e.streakWeight;
      out.label = e.label;
    }
  }
  return out;
}
