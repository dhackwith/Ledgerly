/**
 * Deterministic synthetic users for replay evaluation (plan 2.7). Development
 * only: never shipped as training data, and nothing in the app imports it.
 *
 * Each user gets a personal set of merchants (about a quarter of the catalog's
 * names are deliberately absent from the lexicon), monthly bills on a fixed
 * day, Zipf-like visit frequencies with Food dominating, a typing style
 * (casual with typos, or bank-statement strings with store numbers and
 * processor prefixes), occasional one-off descriptions, personal relabels of
 * ambiguous merchants, and sometimes a habit change partway through.
 */
import type { Category, Expense } from "@/lib/types";

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function sample<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export interface MerchantSpec {
  name: string;
  category: Category;
  /** Median amount and log-normal spread. */
  median: number;
  spread: number;
  /** Relative visit frequency (regular merchants only). */
  freq: number;
  /** Bank-statement form, e.g. "SQ *BLUE BOTTLE COFFEE". */
  bank?: string;
  /** Other ways people type it. */
  variants?: string[];
  /** Plausible personal categories for relabels and habit changes. */
  alt?: Category[];
  /** Monthly bill: fixed amount (or jittered) on a fixed day. */
  monthly?: { jitter: number };
}

const m = (name: string, category: Category, median: number, spread: number, freq: number, extra: Partial<MerchantSpec> = {}): MerchantSpec => ({
  name,
  category,
  median,
  spread,
  freq,
  ...extra,
});

/** Regular (non-monthly) merchants. Names marked "unknown" have no lexicon keyword. */
export const REGULAR_MERCHANTS: Readonly<Record<Category, MerchantSpec[]>> = {
  Food: [
    m("Starbucks", "Food", 5.8, 0.3, 10, { bank: "STARBUCKS STORE", variants: ["starbucks coffee", "sbux"], alt: ["Other", "Entertainment"] }),
    m("Blue Bottle Coffee", "Food", 5.5, 0.25, 5, { bank: "SQ *BLUE BOTTLE COFFEE", variants: ["blue bottle"], alt: ["Other"] }),
    m("Whole Foods Market", "Food", 62, 0.5, 6, { bank: "WHOLEFDS MKT", variants: ["whole foods"] }),
    m("Trader Joe's", "Food", 48, 0.45, 6, { bank: "TRADER JOE S", variants: ["trader joes", "tj"] }),
    m("Safeway", "Food", 55, 0.5, 4, { bank: "SAFEWAY STORE" }),
    m("Kroger", "Food", 58, 0.5, 4, { bank: "KROGER" }),
    m("Chipotle", "Food", 13, 0.2, 4, { bank: "CHIPOTLE ONLINE" }),
    m("McDonald's", "Food", 9, 0.3, 3, { bank: "MCDONALD'S F", variants: ["mcdonalds", "mcd"] }),
    m("Subway", "Food", 10, 0.2, 2, { bank: "SUBWAY" }),
    m("Domino's Pizza", "Food", 23, 0.2, 2, { bank: "DOMINO'S", variants: ["dominos"] }),
    m("DoorDash", "Food", 32, 0.3, 3, { bank: "DD *DOORDASH", variants: ["doordash dinner"] }),
    m("Uber Eats", "Food", 29, 0.3, 3, { bank: "UBER *EATS", variants: ["ubereats"] }),
    m("Panera Bread", "Food", 14, 0.2, 2, { bank: "PANERA BREAD", variants: ["panera"] }),
    m("Sweetgreen", "Food", 15, 0.15, 2, { bank: "SWEETGREEN" }),
    m("Golden Dragon", "Food", 26, 0.3, 2, { bank: "GOLDEN DRAGON" }), // unknown
    m("Lucky Star", "Food", 19, 0.3, 2, { bank: "TST* LUCKY STAR" }), // unknown
    m("Mama Rosa's", "Food", 31, 0.3, 2, { bank: "MAMA ROSAS", variants: ["mama rosas"] }), // unknown
    m("Bluebird", "Food", 8, 0.3, 3, { bank: "SQ *BLUEBIRD" }), // unknown
    m("Hana", "Food", 18, 0.3, 2, { bank: "HANA JAPANESE" }), // unknown
    m("Little Saigon", "Food", 14, 0.25, 2, { bank: "LITTLE SAIGON" }), // unknown
  ],
  Transportation: [
    m("Uber", "Transportation", 18, 0.4, 5, { bank: "UBER *TRIP", variants: ["uber ride", "uber to work"], alt: ["Bills"] }),
    m("Lyft", "Transportation", 16, 0.4, 3, { bank: "LYFT *RIDE", variants: ["lyft ride"] }),
    m("Shell", "Transportation", 45, 0.25, 4, { bank: "SHELL OIL", variants: ["shell gas"] }),
    m("Chevron", "Transportation", 48, 0.25, 3, { bank: "CHEVRON" }),
    m("City Parking", "Transportation", 12, 0.3, 3, { bank: "CITY OF PARKING", variants: ["parking"] }),
    m("Amtrak", "Transportation", 65, 0.3, 1, { bank: "AMTRAK TICKETS" }),
    m("Jiffy Lube", "Transportation", 70, 0.2, 0.5, { bank: "JIFFY LUBE" }),
    m("Citi Bike", "Transportation", 4.5, 0.1, 1, { bank: "CITI BIKE", variants: ["citibike"] }),
    m("Speedy Q", "Transportation", 40, 0.25, 2, { bank: "SPEEDY Q MART" }), // unknown
    m("Bayside Auto", "Transportation", 90, 0.4, 0.5, { bank: "BAYSIDE AUTO" }), // unknown
  ],
  Entertainment: [
    m("AMC Theatres", "Entertainment", 28, 0.3, 2, { bank: "AMC THEATRES", variants: ["amc movie"] }),
    m("Steam", "Entertainment", 20, 0.6, 2, { bank: "STEAM PURCHASE", variants: ["steam game"] }),
    m("Ticketmaster", "Entertainment", 95, 0.5, 0.8, { bank: "TICKETMASTER" }),
    m("Regal Cinemas", "Entertainment", 26, 0.3, 1.5, { bank: "REGAL CINEMAS", variants: ["regal"] }),
    m("PlayStation Store", "Entertainment", 30, 0.5, 1, { bank: "PLAYSTATION NETWORK", variants: ["playstation"] }),
    m("The Velvet Room", "Entertainment", 40, 0.4, 1, { bank: "TST* THE VELVET ROOM", variants: ["velvet room"], alt: ["Food"] }), // unknown
    m("Riverside Rec", "Entertainment", 30, 0.4, 1, { bank: "RIVERSIDE REC" }), // unknown
  ],
  Shopping: [
    m("Amazon", "Shopping", 38, 0.7, 6, { bank: "AMZN MKTP US", variants: ["amazon order"] }),
    m("Target", "Shopping", 42, 0.6, 4, { bank: "TARGET" }),
    m("Walmart", "Shopping", 46, 0.6, 3, { bank: "WALMART SUPERCENTER" }),
    m("Costco", "Shopping", 120, 0.5, 2, { bank: "COSTCO WHSE", alt: ["Food"] }),
    m("Best Buy", "Shopping", 150, 0.7, 1, { bank: "BEST BUY" }),
    m("IKEA", "Shopping", 110, 0.7, 0.6, { bank: "IKEA" }),
    m("Home Depot", "Shopping", 55, 0.7, 1, { bank: "THE HOME DEPOT", variants: ["home depot"] }),
    m("H&M", "Shopping", 40, 0.4, 1, { bank: "H&M" }),
    m("Zara", "Shopping", 55, 0.4, 1, { bank: "ZARA" }),
    m("Etsy", "Shopping", 30, 0.5, 1, { bank: "ETSY.COM", alt: ["Other"] }),
    m("Sephora", "Shopping", 45, 0.4, 1, { bank: "SEPHORA" }),
    m("Maple & Co", "Shopping", 45, 0.4, 1, { bank: "MAPLE & CO" }), // unknown
    m("Northgate", "Shopping", 60, 0.5, 1, { bank: "NORTHGATE" }), // unknown
    m("Willow Home", "Shopping", 70, 0.5, 1, { bank: "WILLOW HOME" }), // unknown
  ],
  Bills: [],
  Other: [
    m("Great Clips", "Other", 28, 0.2, 1, { bank: "GREAT CLIPS", variants: ["haircut"] }), // unknown name, "haircut" variant is lexicon
    m("CVS", "Other", 18, 0.6, 2, { bank: "CVS/PHARMACY", alt: ["Shopping"] }),
    m("Walgreens", "Other", 15, 0.6, 1, { bank: "WALGREENS", alt: ["Shopping"] }),
    m("ATM withdrawal", "Other", 60, 0.4, 1, { bank: "ATM WITHDRAWAL" }),
    m("Dry cleaning", "Other", 22, 0.3, 1, { bank: "PRESTIGE DRY CLEANING", variants: ["dry cleaner"] }),
    m("Donation", "Other", 50, 0.5, 0.5, { bank: "PP*CHARITY DONATION" }),
    m("USPS", "Other", 12, 0.5, 0.8, { bank: "USPS PO", variants: ["post office"] }),
    m("Dr. Patel", "Other", 40, 0.3, 0.5, { bank: "DR PATEL" }), // unknown
    m("Happy Paws", "Other", 65, 0.4, 0.5, { bank: "HAPPY PAWS" }), // unknown
  ],
};

/** Monthly bills, grouped so each user gets one or two of each kind. */
export const MONTHLY_MERCHANTS: Readonly<Record<string, MerchantSpec[]>> = {
  rent: [
    m("Rent", "Bills", 1800, 0, 0, { monthly: { jitter: 0 }, variants: ["rent payment", "monthly rent"] }),
    m("Greenfield Property Mgmt", "Bills", 1650, 0, 0, { monthly: { jitter: 0 }, bank: "GREENFIELD PROP MGMT" }), // unknown
  ],
  utilities: [
    m("PG&E", "Bills", 95, 0, 0, { monthly: { jitter: 0.25 }, bank: "PGANDE WEB ONLINE", variants: ["electric bill"] }),
    m("City Utilities", "Bills", 48, 0, 0, { monthly: { jitter: 0.1 }, bank: "CITY UTILITIES", variants: ["water bill"] }),
  ],
  phone: [
    m("Verizon", "Bills", 65, 0, 0, { monthly: { jitter: 0 }, bank: "VERIZON WRLS", variants: ["verizon wireless", "phone bill"] }),
    m("AT&T", "Bills", 70, 0, 0, { monthly: { jitter: 0 }, bank: "AT&T BILL PAYMENT" }),
    m("T-Mobile", "Bills", 60, 0, 0, { monthly: { jitter: 0 }, bank: "T-MOBILE" }),
  ],
  internet: [
    m("Comcast", "Bills", 79.99, 0, 0, { monthly: { jitter: 0 }, bank: "COMCAST CABLE", variants: ["xfinity"] }),
    m("Spectrum", "Bills", 74.99, 0, 0, { monthly: { jitter: 0 }, bank: "SPECTRUM" }),
    m("Sonic Fiber", "Bills", 50, 0, 0, { monthly: { jitter: 0 }, bank: "SONIC FIBER" }), // unknown
  ],
  insurance: [
    m("State Farm", "Bills", 120, 0, 0, { monthly: { jitter: 0 }, bank: "STATE FARM INSURANCE" }),
    m("Geico", "Bills", 105, 0, 0, { monthly: { jitter: 0 }, bank: "GEICO AUTO" }),
  ],
  subscriptions: [
    m("Netflix", "Entertainment", 15.49, 0, 0, { monthly: { jitter: 0 }, bank: "NETFLIX.COM", alt: ["Bills"] }),
    m("Spotify", "Entertainment", 11.99, 0, 0, { monthly: { jitter: 0 }, bank: "SPOTIFY USA", alt: ["Bills"] }),
    m("Hulu", "Entertainment", 7.99, 0, 0, { monthly: { jitter: 0 }, bank: "HULU" }),
    m("Disney+", "Entertainment", 13.99, 0, 0, { monthly: { jitter: 0 }, bank: "DISNEY PLUS" }),
    m("iCloud", "Bills", 2.99, 0, 0, { monthly: { jitter: 0 }, bank: "APPLE.COM/BILL", variants: ["icloud storage"] }),
    // Typed as plain "amazon" a third of the time, which only the amount and recurrence can tell apart from shopping.
    m("Amazon Prime", "Bills", 14.99, 0, 0, { monthly: { jitter: 0 }, bank: "AMAZON PRIME", variants: ["amazon"] }),
  ],
  gym: [
    m("Planet Fitness", "Bills", 24.99, 0, 0, { monthly: { jitter: 0 }, bank: "PLANET FITNESS", alt: ["Entertainment", "Other"] }),
    m("Iron Temple", "Bills", 45, 0, 0, { monthly: { jitter: 0 }, bank: "IRON TEMPLE", alt: ["Entertainment", "Other"] }), // unknown
  ],
  loan: [m("Lakeshore CU", "Bills", 320, 0, 0, { monthly: { jitter: 0 }, bank: "LAKESHORE CU LOAN PMT" })], // unknown
};

/** One-off descriptions people type for things without a fixed merchant. */
const ONE_OFFS: Readonly<Record<Category, { texts: string[]; median: number }>> = {
  Food: { texts: ["dinner with {who}", "lunch at work", "coffee and bagel", "groceries", "takeout {food}", "brunch with {who}", "{food} night", "snacks for the trip"], median: 24 },
  Transportation: { texts: ["gas", "parking downtown", "taxi to airport", "train ticket", "bus fare", "tolls", "car wash", "fuel for road trip"], median: 30 },
  Entertainment: { texts: ["movie night", "concert tickets", "bowling with {who}", "museum visit", "new video game", "comedy show", "arcade with {who}"], median: 35 },
  Shopping: { texts: ["new shoes", "headphones", "clothes", "books", "kitchen supplies", "furniture", "phone case", "present for {who}"], median: 45 },
  Bills: { texts: ["electric bill", "water bill", "internet bill", "phone bill", "insurance premium"], median: 90 },
  Other: { texts: ["haircut", "donation", "gift for {who}", "doctor visit", "vet visit", "laundry", "post office"], median: 35 },
};
const WHO = ["sam", "alex", "mom", "jordan", "priya", "li"];
const FOODS = ["pizza", "sushi", "thai", "tacos", "burgers", "ramen"];
const CITIES = ["SEATTLE WA", "PORTLAND OR", "AUSTIN TX", "DENVER CO", "BOSTON MA"];
/** Long tail: merchants a user visits once or a few times. Some templates carry a lexicon keyword, some don't. */
const TAIL: Readonly<Record<Category, { share: number; median: number; names: string[] }>> = {
  Food: { share: 0.45, median: 22, names: ["{A} Cafe", "{A} Kitchen", "{A} Bistro", "{A} Grill", "{A} Bakery", "{A} Noodle House", "{B}'s", "{A} Table", "Casa {B}"] },
  Transportation: { share: 0.12, median: 35, names: ["{A} Parking", "{A} Gas", "{A} Auto Repair", "{A} Motors", "{A} Fuel Stop", "{A} Cab Co"] },
  Entertainment: { share: 0.12, median: 30, names: ["{A} Cinema", "{A} Theater", "{A} Live", "{A} Games", "{A} Lounge", "{A} Bowl"] },
  Shopping: { share: 0.18, median: 50, names: ["{A} Outfitters", "{A} Boutique", "{A} Hardware", "{A} Books", "{A} Supply", "{A} & Co", "{A} Goods"] },
  Bills: { share: 0.03, median: 90, names: ["{A} Insurance", "{A} Energy", "{A} Water District"] },
  Other: { share: 0.1, median: 45, names: ["{A} Salon", "{A} Dental", "{A} Vet Clinic", "{A} Cleaners", "Dr. {B}", "{A} Studio"] },
};
const TAIL_A = ["Oak", "River", "Golden", "Silver", "Maple", "Harbor", "Sunset", "Blue Door", "Corner", "Union", "Elm", "Pine", "Summit", "Royal", "Juniper", "Cedar", "Copper", "Lantern", "Northside", "Willow"];
const TAIL_B = ["Patel", "Garcia", "Nguyen", "Kim", "Rossi", "Murphy", "Cohen", "Okafor", "Silva", "Novak"];
/** Share of everyday expenses that go to the long tail, and how often a tail merchant is revisited. */
const TAIL_RATE = 0.15;
const TAIL_REVISIT = 0.4;
const CATEGORY_MIX: Readonly<Record<Category, [number, number]>> = {
  Food: [6, 9],
  Transportation: [2, 4],
  Entertainment: [1, 3],
  Shopping: [3, 5],
  Bills: [0, 0],
  Other: [2, 3],
};

export interface SyntheticExpense {
  expense: Expense;
  /** Catalog name, "tail:<name>" for long-tail merchants, or "one-off". */
  merchant: string;
  /** True when this label comes from a habit change. */
  drifted: boolean;
}

export interface SyntheticUser {
  seed: number;
  style: "casual" | "bank" | "mixed";
  items: SyntheticExpense[];
  relabels: Record<string, Category>;
  drift: { merchant: string; fromDay: number; to: Category } | null;
}

export interface GenerateOptions {
  days?: number;
  /** Average regular (non-bill) expenses per day. */
  ratePerDay?: number;
  /** First day, YYYY-MM-DD. */
  start?: string;
}

const DAY_MS = 86_400_000;

function typo(rng: Rng, s: string): string {
  if (s.length < 5) return s;
  const i = 1 + Math.floor(rng() * (s.length - 2));
  const op = rng();
  if (op < 0.4) return s.slice(0, i) + s.slice(i + 1); // drop
  if (op < 0.7) return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2); // swap
  return s.slice(0, i) + s[i] + s.slice(i); // double
}

export function generateUser(seed: number, options: GenerateOptions = {}): SyntheticUser {
  const rng = mulberry32(seed * 7919 + 17);
  const days = options.days ?? 240;
  const rate = options.ratePerDay ?? 1.0;
  const startMs = Date.parse(`${options.start ?? "2026-01-01"}T00:00:00Z`);
  const styleRoll = rng();
  const style: SyntheticUser["style"] = styleRoll < 0.5 ? "casual" : styleRoll < 0.75 ? "bank" : "mixed";
  const cities = sample(rng, CITIES, 2);

  // Personal merchant set with Zipf-like weights.
  const regular: { spec: MerchantSpec; weight: number; stores: string[] }[] = [];
  for (const [category, [lo, hi]] of Object.entries(CATEGORY_MIX) as [Category, [number, number]][]) {
    const n = lo + Math.floor(rng() * (hi - lo + 1));
    sample(rng, REGULAR_MERCHANTS[category], n).forEach((spec, rank) => {
      const stores = [0, 1].map(() => String(1000 + Math.floor(rng() * 9000)));
      regular.push({ spec, weight: (spec.freq * (0.4 + 1.2 * rng())) / (1 + rank * 0.5), stores });
    });
  }
  const monthly: { spec: MerchantSpec; day: number; amount: number }[] = [];
  const addMonthly = (group: string, n: number) =>
    sample(rng, MONTHLY_MERCHANTS[group], n).forEach((spec) => {
      const day = group === "rent" ? 1 : 1 + Math.floor(rng() * 28);
      monthly.push({ spec, day, amount: spec.median });
    });
  addMonthly("rent", 1);
  addMonthly("utilities", 1 + Math.floor(rng() * 2));
  addMonthly("phone", 1);
  addMonthly("internet", 1);
  if (rng() < 0.6) addMonthly("insurance", 1);
  addMonthly("subscriptions", 1 + Math.floor(rng() * 3));
  if (rng() < 0.5) addMonthly("gym", 1);
  if (rng() < 0.3) addMonthly("loan", 1);

  // Personal habits: relabel an ambiguous merchant, and maybe change a habit later.
  const relabels: Record<string, Category> = {};
  const relabelable = [...regular.map((r) => r.spec), ...monthly.map((x) => x.spec)].filter((s) => s.alt?.length);
  if (relabelable.length && rng() < 0.5) {
    const spec = pick(rng, relabelable);
    relabels[spec.name] = pick(rng, spec.alt as Category[]);
  }
  let drift: SyntheticUser["drift"] = null;
  const driftable = regular.filter((r) => r.spec.alt?.length && !relabels[r.spec.name]).sort((a, b) => b.weight - a.weight);
  if (driftable.length && rng() < 0.35) {
    const spec = driftable[0].spec;
    drift = { merchant: spec.name, fromDay: Math.floor(days * (0.45 + 0.2 * rng())), to: pick(rng, spec.alt as Category[]) };
  }

  const describe = (spec: MerchantSpec, stores: string[]): string => {
    const bankStyle = style === "bank" || (style === "mixed" && rng() < 0.5);
    if (bankStyle) {
      let s = (spec.bank ?? spec.name).toUpperCase();
      if (!spec.monthly && rng() < 0.5) s += ` #${pick(rng, stores)}`;
      if (!spec.monthly && rng() < 0.4) s += ` ${pick(rng, cities)}`;
      return s;
    }
    let s = spec.variants && rng() < 0.35 ? pick(rng, spec.variants) : spec.name;
    const caseRoll = rng();
    s = caseRoll < 0.5 ? s.toLowerCase() : caseRoll < 0.9 ? s : s.toUpperCase();
    return rng() < 0.1 ? typo(rng, s) : s;
  };
  const categoryOf = (spec: MerchantSpec, day: number): { category: Category; drifted: boolean } => {
    if (drift && drift.merchant === spec.name && day >= drift.fromDay) return { category: drift.to, drifted: true };
    return { category: relabels[spec.name] ?? spec.category, drifted: false };
  };

  const raw: { day: number; minute: number; description: string; amount: number; category: Category; merchant: string; drifted: boolean }[] = [];
  const totalWeight = regular.reduce((s, r) => s + r.weight, 0);
  const tail: { spec: MerchantSpec; stores: string[] }[] = [];
  for (let day = 0; day < days; day++) {
    const date = new Date(startMs + day * DAY_MS);
    const dom = date.getUTCDate();
    for (const bill of monthly) {
      if (bill.day !== dom) continue;
      const jitter = bill.spec.monthly?.jitter ?? 0;
      const amount = Math.round(bill.amount * (1 + jitter * (2 * rng() - 1)) * 100) / 100;
      raw.push({ day, minute: 9 * 60 + Math.floor(rng() * 60), description: describe(bill.spec, []), amount, ...categoryOf(bill.spec, day), merchant: bill.spec.name });
    }
    // Weekend days are a bit busier.
    const weekday = date.getUTCDay();
    const dayRate = rate * (weekday === 0 || weekday === 6 ? 1.3 : 0.9);
    let n = 0;
    for (let k = 0; k < 4; k++) if (rng() < dayRate / 4) n++;
    for (let k = 0; k < n; k++) {
      const minute = 7 * 60 + Math.floor(rng() * 15 * 60);
      if (rng() < 0.08) {
        const category = pick(rng, Object.keys(ONE_OFFS) as Category[]);
        const spec = ONE_OFFS[category];
        const text = pick(rng, spec.texts).replace("{who}", pick(rng, WHO)).replace("{food}", pick(rng, FOODS));
        const amount = Math.round(spec.median * Math.exp(0.5 * gaussian(rng)) * 100) / 100;
        raw.push({ day, minute, description: text, amount, category, merchant: "one-off", drifted: false });
        continue;
      }
      if (rng() < TAIL_RATE) {
        let roll = rng();
        let category: Category = "Food";
        for (const c of Object.keys(TAIL) as Category[]) {
          roll -= TAIL[c].share;
          if (roll <= 0) {
            category = c;
            break;
          }
        }
        const known = tail.filter((t) => t.spec.category === category);
        let chosen = known.length && rng() < TAIL_REVISIT ? pick(rng, known) : null;
        if (!chosen) {
          const name = pick(rng, TAIL[category].names).replace("{A}", pick(rng, TAIL_A)).replace("{B}", pick(rng, TAIL_B));
          chosen = { spec: m(name, category, TAIL[category].median * (0.6 + 0.8 * rng()), 0.35, 0), stores: [String(1000 + Math.floor(rng() * 9000))] };
          tail.push(chosen);
        }
        const amount = Math.max(1, Math.round(chosen.spec.median * Math.exp(chosen.spec.spread * gaussian(rng)) * 100) / 100);
        raw.push({ day, minute, description: describe(chosen.spec, chosen.stores), amount, category, merchant: `tail:${chosen.spec.name}`, drifted: false });
        continue;
      }
      let roll = rng() * totalWeight;
      let chosen = regular[regular.length - 1];
      for (const r of regular) {
        roll -= r.weight;
        if (roll <= 0) {
          chosen = r;
          break;
        }
      }
      const amount = Math.max(1, Math.round(chosen.spec.median * Math.exp(chosen.spec.spread * gaussian(rng)) * 100) / 100);
      raw.push({ day, minute, description: describe(chosen.spec, chosen.stores), amount, ...categoryOf(chosen.spec, day), merchant: chosen.spec.name });
    }
  }
  raw.sort((a, b) => a.day - b.day || a.minute - b.minute);

  const items = raw.map((r, i): SyntheticExpense => {
    const createdAt = new Date(startMs + r.day * DAY_MS + r.minute * 60_000).toISOString();
    return {
      expense: {
        id: `u${seed}-${i}`,
        date: createdAt.slice(0, 10),
        amount: r.amount,
        category: r.category,
        description: r.description,
        createdAt,
        updatedAt: createdAt,
      },
      merchant: r.merchant,
      drifted: r.drifted,
    };
  });
  return { seed, style, items, relabels, drift };
}
